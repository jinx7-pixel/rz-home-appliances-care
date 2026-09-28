import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { eq, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import nodemailer, { type Transporter } from "nodemailer";
import type { AddressInfo } from "node:net";
import app from "../src/app.ts";
import {
  adminUsersTable,
  bookingsTable,
  customersTable,
  db,
  passwordResetTokensTable,
  pool,
  repairRequestsTable,
  reviewInvitationsTable,
  reviewsTable,
} from "@workspace/db";

process.env.NODE_ENV = "production";
process.env.APP_BASE_URL = "";
process.env.REPLIT_DEV_DOMAIN = "";
process.env.EMAIL_FROM = "care@example.test";
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test-user";
process.env.SMTP_APP_PASSWORD = "test-password";
process.env.SMTP_REQUIRE_TLS = "true";
process.env.SMTP_SECURE = "false";
delete process.env.BUSINESS_EMAIL;
process.env.OWNER_EMAIL = "owner@example.test";

const TEST_EMAIL_PREFIX = "auth-regression-";
const TEST_ADMIN_PREFIX = "repair-status-admin-";
const TEST_PASSWORD = "ValidPass1";
const TEST_ADMIN_PASSWORD = "AdminPass1";
const requireIpv6Loopback = process.env.REQUIRE_IPV6_LOOPBACK === "1";

let server: ReturnType<typeof app.listen>;
let ipv6Server: ReturnType<typeof app.listen> | undefined;
let baseUrl: string;
let ipv6BaseUrl: string | undefined;
let ipv6MappedBaseUrl: string | undefined;
let ipv6UnavailableReason: string | undefined;
let clientIp = "198.51.100.1";
let nextClientIpOctet = 1;

type CapturedEmail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
};

const sentEmails: CapturedEmail[] = [];
let emailDeliveryError: Error | undefined;
const fakeTransport = {
  async sendMail(payload: CapturedEmail) {
    if (emailDeliveryError) {
      throw emailDeliveryError;
    }
    sentEmails.push(payload);
    return { rejected: [] };
  },
  async verify() {},
} as unknown as Transporter;

mock.method(nodemailer, "createTransport", () => fakeTransport);

type JsonResponse = {
  response: Response;
  body: Record<string, unknown>;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function testEmail(label: string): string {
  return `${TEST_EMAIL_PREFIX}${label}-${randomUUID()}@example.test`;
}

async function request(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
  requestClientIp = clientIp,
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": requestClientIp,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  return {
    response,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

async function patch(
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": clientIp,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return {
    response,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

async function requestFromSource(
  path: string,
  body: Record<string, unknown>,
  sourceAddress: string,
  forwardedFor: string,
  targetBaseUrl = baseUrl,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL(path, targetBaseUrl);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const clientRequest = http.request(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        localAddress: sourceAddress,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          "x-forwarded-for": forwardedFor,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: response.statusCode ?? 0,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
          });
        });
      },
    );

    clientRequest.on("error", reject);
    clientRequest.end(payload);
  });
}

async function get(path: string, cookie?: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "x-forwarded-for": clientIp,
      ...(cookie ? { cookie } : {}),
    },
  });
  const text = await response.text();
  return {
    response,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

async function remove(path: string, cookie?: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: {
      "x-forwarded-for": clientIp,
      ...(cookie ? { cookie } : {}),
    },
  });
  const text = await response.text();
  return {
    response,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

function sessionCookie(response: Response): string {
  return cookieNamed(response, "rz_session");
}

function cookieNamed(response: Response, name: string): string {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie, `expected the login response to set a ${name} cookie`);
  return cookie.split(";", 1)[0];
}

async function createAccount(email = testEmail("account")): Promise<void> {
  const signup = await request("/api/auth/signup", {
    fullName: "Regression Customer",
    email,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  });
  assert.equal(signup.response.status, 201);
}

async function customerForEmail(email: string) {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.email, email))
    .limit(1);
  assert.ok(customer, `expected a customer record for ${email}`);
  return customer;
}

async function createAdminSession(): Promise<string> {
  const username = `${TEST_ADMIN_PREFIX}${randomUUID()}`;
  await db.insert(adminUsersTable).values({
    username,
    displayName: "Repair Status Admin",
    passwordHash: await bcrypt.hash(TEST_ADMIN_PASSWORD, 4),
  });

  const login = await request("/api/admin/auth/login", {
    username,
    password: TEST_ADMIN_PASSWORD,
  });
  assert.equal(login.response.status, 200);
  return cookieNamed(login.response, "rz_admin_session");
}

async function createRepairRequest(
  status: "pending" | "contacted" = "pending",
): Promise<string> {
  const requestId = `RZ-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await db.insert(repairRequestsTable).values({
    requestId,
    customerName: "Jane Customer",
    phone: "9876543210",
    email: testEmail("status"),
    applianceType: "Washing Machine",
    problemDescription: "The appliance does not start.",
    address: "123 Test Street",
    status,
    emailStatus: "pending",
  });
  return requestId;
}

async function repairRequestForId(requestId: string) {
  const [repairRequest] = await db
    .select()
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.requestId, requestId))
    .limit(1);
  assert.ok(repairRequest, `expected repair request ${requestId}`);
  return repairRequest;
}

async function bookingForId(bookingId: string) {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.bookingId, bookingId))
    .limit(1);
  assert.ok(booking, `expected booking ${bookingId}`);
  return booking;
}

async function cleanupTestData(): Promise<void> {
  sentEmails.length = 0;
  emailDeliveryError = undefined;

  await db
    .delete(repairRequestsTable)
    .where(like(repairRequestsTable.email, `${TEST_EMAIL_PREFIX}%`));

  await db
    .delete(adminUsersTable)
    .where(like(adminUsersTable.username, `${TEST_ADMIN_PREFIX}%`));

  await db
    .delete(customersTable)
    .where(like(customersTable.email, `${TEST_EMAIL_PREFIX}%`));
}

before(async () => {
  await cleanupTestData();
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Production calls app.listen(port) without a host, which uses the IPv6
    // wildcard on IPv6-capable hosts and accepts both native and mapped peers.
    ipv6Server = app.listen(0, "::");
    await new Promise<void>((resolve, reject) => {
      ipv6Server?.once("listening", resolve);
      ipv6Server?.once("error", reject);
    });
    const ipv6Address = ipv6Server.address() as AddressInfo;
    ipv6BaseUrl = `http://[::1]:${ipv6Address.port}`;
    ipv6MappedBaseUrl = `http://[::ffff:127.0.0.1]:${ipv6Address.port}`;
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    if (code !== "EAFNOSUPPORT" && code !== "EADDRNOTAVAIL") {
      throw error;
    }
    ipv6UnavailableReason = `IPv6 loopback is unavailable (${code})`;
    ipv6Server = undefined;
  }
});

beforeEach(async () => {
  await cleanupTestData();
  clientIp = `198.51.100.${nextClientIpOctet++}`;
});

after(async () => {
  await cleanupTestData();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (ipv6Server) {
    await new Promise<void>((resolve, reject) => {
      ipv6Server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await pool.end();
});

test("signup validates input and rejects duplicate emails", async () => {
  const invalid = await request("/api/auth/signup", {
    fullName: "A",
    email: "not-an-email",
    password: "weak",
    confirmPassword: "different",
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.error, "Enter a valid name, email, and password.");

  const email = testEmail("duplicate");
  await createAccount(email);

  const duplicate = await request("/api/auth/signup", {
    fullName: "Another Customer",
    email: email.toUpperCase(),
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(
    duplicate.body.error,
    "An account with this email already exists.",
  );
});

test("signup rate limit allows five attempts and returns a generic 429 on the sixth", async () => {
  const invalidSignup = {
    fullName: "A",
    email: "not-an-email",
    password: "weak",
    confirmPassword: "different",
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request("/api/auth/signup", invalidSignup);
    assert.equal(response.response.status, 400);
    assert.equal(response.body.error, "Enter a valid name, email, and password.");
  }

  const limited = await request("/api/auth/signup", {
    ...invalidSignup,
    email: "signup-limit@example.test",
  });
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.body, {
    error: "Too many signup attempts. Please try again later.",
  });
  assert.doesNotMatch(
    JSON.stringify(limited.body),
    /signup-limit@example\.test|weak|different/i,
  );
});

test("login sets a secure session, /me reads it, and logout invalidates it", async () => {
  const email = testEmail("login");
  await createAccount(email);

  const invalid = await request("/api/auth/login", {
    email,
    password: "WrongPass1",
  });
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.body.error, "Invalid email or password.");

  const login = await request("/api/auth/login", {
    email: email.toUpperCase(),
    password: TEST_PASSWORD,
  });
  assert.equal(login.response.status, 200);
  const loginUser = login.body.user as {
    id: string;
    fullName: string;
    email: string;
  };
  assert.ok(loginUser.id);
  assert.equal(loginUser.fullName, "Regression Customer");
  assert.equal(loginUser.email, email);

  const cookie = sessionCookie(login.response);
  const setCookie = login.response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);

  const me = await get("/api/auth/me", cookie);
  assert.equal(me.response.status, 200);
  assert.equal(me.body.authenticated, true);
  assert.equal((me.body.user as { email: string }).email, email);

  const logout = await request("/api/auth/logout", undefined, cookie);
  assert.equal(logout.response.status, 200);
  assert.equal(logout.body.message, "Signed out successfully.");

  const afterLogout = await get("/api/auth/me", cookie);
  assert.deepEqual(afterLogout.body, { authenticated: false, user: null });
});

test("login rate limit allows ten attempts and returns a generic 429 on the eleventh", async () => {
  const loginAttempt = {
    email: "login-limit@example.test",
    password: "WrongPass1",
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request("/api/auth/login", loginAttempt);
    assert.equal(response.response.status, 401);
    assert.equal(response.body.error, "Invalid email or password.");
  }

  const limited = await request("/api/auth/login", loginAttempt);
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.body, {
    error: "Too many login attempts. Please try again later.",
  });
  assert.doesNotMatch(
    JSON.stringify(limited.body),
    /login-limit@example\.test|WrongPass1/i,
  );
});

test("rate limits trust forwarded IPs only from the configured proxy addresses", async () => {
  const invalidSignup = {
    fullName: "A",
    email: "not-an-email",
    password: "weak",
    confirmPassword: "different",
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(
      "/api/auth/signup",
      invalidSignup,
      undefined,
      "198.51.100.50",
    );
    assert.equal(response.response.status, 400);
  }

  const trustedProxyLimited = await request(
    "/api/auth/signup",
    invalidSignup,
    undefined,
    "198.51.100.50",
  );
  assert.equal(trustedProxyLimited.response.status, 429);

  const differentTrustedClient = await request(
    "/api/auth/signup",
    invalidSignup,
    undefined,
    "198.51.100.51",
  );
  assert.equal(differentTrustedClient.response.status, 400);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await requestFromSource(
      "/api/auth/signup",
      invalidSignup,
      "127.0.0.2",
      `203.0.113.${attempt + 1}`,
    );
    assert.equal(response.status, 400);
  }

  const untrustedHeaderLimited = await requestFromSource(
    "/api/auth/signup",
    invalidSignup,
    "127.0.0.2",
    "203.0.113.6",
  );
  assert.equal(untrustedHeaderLimited.status, 429);
});

test("rate limits trust forwarded IPs from the IPv6 loopback proxy path", async (t) => {
  if (!ipv6BaseUrl) {
    if (requireIpv6Loopback) {
      assert.fail(
        `Release validation requires IPv6 loopback sockets, but ${ipv6UnavailableReason ?? "IPv6 is unavailable"}.`,
      );
    }
    t.skip(ipv6UnavailableReason ?? "IPv6 loopback is unavailable");
    return;
  }

  const invalidSignup = {
    fullName: "A",
    email: "ipv6-trusted-limit@example.test",
    password: "weak",
    confirmPassword: "different",
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await requestFromSource(
      "/api/auth/signup",
      invalidSignup,
      "::1",
      "198.51.100.60",
      ipv6BaseUrl,
    );
    assert.equal(response.status, 400);
  }

  const limited = await requestFromSource(
    "/api/auth/signup",
    invalidSignup,
    "::1",
    "198.51.100.60",
    ipv6BaseUrl,
  );
  assert.equal(limited.status, 429);

  const differentTrustedClient = await requestFromSource(
    "/api/auth/signup",
    invalidSignup,
    "::1",
    "198.51.100.61",
    ipv6BaseUrl,
  );
  assert.equal(differentTrustedClient.status, 400);
});

test("rejects a forged forwarded IP from an untrusted IPv6 source", async (t) => {
  if (!ipv6BaseUrl) {
    if (requireIpv6Loopback) {
      assert.fail(
        `Release validation requires IPv6 loopback sockets, but ${ipv6UnavailableReason ?? "IPv6 is unavailable"}.`,
      );
    }
    t.skip(ipv6UnavailableReason ?? "IPv6 loopback is unavailable");
    return;
  }

  const invalidSignup = {
    fullName: "A",
    email: "ipv6-untrusted-limit@example.test",
    password: "weak",
    confirmPassword: "different",
  };
  const untrustedIpv6Source = "::ffff:127.0.0.2";
  assert.ok(ipv6MappedBaseUrl);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await requestFromSource(
      "/api/auth/signup",
      invalidSignup,
      untrustedIpv6Source,
      "203.0.113.60",
      ipv6MappedBaseUrl,
    );
    assert.equal(response.status, 400);
  }

  const limited = await requestFromSource(
    "/api/auth/signup",
    invalidSignup,
    untrustedIpv6Source,
    "203.0.113.61",
    ipv6MappedBaseUrl,
  );
  assert.equal(limited.status, 429);
});

test("forgot password returns the same response for known and unknown emails", async () => {
  const email = testEmail("forgot");
  await createAccount(email);

  const existing = await request("/api/auth/forgot-password", { email });
  const unknown = await request("/api/auth/forgot-password", {
    email: testEmail("unknown"),
  });

  assert.equal(existing.response.status, 202);
  assert.equal(unknown.response.status, 202);
  assert.deepEqual(existing.body, unknown.body);
  assert.equal(
    existing.body.message,
    "If an account exists for this email, a password reset link has been sent.",
  );
});

test("forgot-password rate limit allows five attempts and returns a generic 429 on the sixth", async () => {
  const forgotAttempt = { email: "forgot-limit@example.test" };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request("/api/auth/forgot-password", forgotAttempt);
    assert.equal(response.response.status, 202);
    assert.equal(
      response.body.message,
      "If an account exists for this email, a password reset link has been sent.",
    );
  }

  const limited = await request("/api/auth/forgot-password", forgotAttempt);
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.body, {
    error: "Too many reset attempts. Please try again later.",
  });
  assert.doesNotMatch(
    JSON.stringify(limited.body),
    /forgot-limit@example\.test|password|credentials/i,
  );
});

test("reset password enforces expiry, is single-use, replaces the password, and invalidates sessions", async () => {
  const email = testEmail("reset");
  await createAccount(email);

  const login = await request("/api/auth/login", {
    email,
    password: TEST_PASSWORD,
  });
  const oldCookie = sessionCookie(login.response);
  const customer = await customerForEmail(email);

  const expiredToken = `expired-${randomUUID()}`;
  await db.insert(passwordResetTokensTable).values({
    customerId: customer.id,
    tokenHash: hashToken(expiredToken),
    expiresAt: new Date(Date.now() - 1_000),
  });
  const expired = await request("/api/auth/reset-password", {
    token: expiredToken,
    password: "NewValid2",
    confirmPassword: "NewValid2",
  });
  assert.equal(expired.response.status, 400);
  assert.equal(expired.body.error, "This reset link is invalid or has expired.");

  const token = `valid-${randomUUID()}`;
  await db.insert(passwordResetTokensTable).values({
    customerId: customer.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
  });

  const reset = await request("/api/auth/reset-password", {
    token,
    password: "NewValid2",
    confirmPassword: "NewValid2",
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.message, "Your password has been reset. You can now sign in.");

  const invalidatedSession = await get("/api/auth/me", oldCookie);
  assert.deepEqual(invalidatedSession.body, { authenticated: false, user: null });

  const reused = await request("/api/auth/reset-password", {
    token,
    password: "AnotherValid3",
    confirmPassword: "AnotherValid3",
  });
  assert.equal(reused.response.status, 400);
  assert.equal(reused.body.error, "This reset link is invalid or has expired.");

  const oldPassword = await request("/api/auth/login", {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(oldPassword.response.status, 401);

  const newPassword = await request("/api/auth/login", {
    email,
    password: "NewValid2",
  });
  assert.equal(newPassword.response.status, 200);
});

test("reset-password rate limit allows eight attempts and returns a generic 429 on the ninth", async () => {
  const resetAttempt = {
    token: `invalid-${randomUUID()}`,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await request("/api/auth/reset-password", resetAttempt);
    assert.equal(response.response.status, 400);
    assert.equal(response.body.error, "This reset link is invalid or has expired.");
  }

  const limited = await request("/api/auth/reset-password", resetAttempt);
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.body, {
    error: "Too many reset attempts. Please try again later.",
  });
  assert.doesNotMatch(
    JSON.stringify(limited.body),
    /invalid-|ValidPass1|credentials/i,
  );
});

test("admin repair status saves stay silent for pending, contacted, and unchanged statuses", async () => {
  const requestId = await createRepairRequest();
  const adminCookie = await createAdminSession();

  const pending = await patch(
    `/api/admin/repair-requests/${requestId}`,
    { status: "pending" },
    adminCookie,
  );
  assert.equal(pending.response.status, 200);

  const contacted = await patch(
    `/api/admin/repair-requests/${requestId}`,
    { status: "contacted" },
    adminCookie,
  );
  assert.equal(contacted.response.status, 200);
  assert.equal(contacted.body.status, "contacted");

  const unchanged = await patch(
    `/api/admin/repair-requests/${requestId}`,
    { adminNotes: "Internal follow-up" },
    adminCookie,
  );
  assert.equal(unchanged.response.status, 200);
  assert.equal(unchanged.body.status, "contacted");
  assert.equal(sentEmails.length, 0);
});

test("admin repair status emails contain the exact customer update for each notified transition", async () => {
  const requestId = await createRepairRequest();
  const adminCookie = await createAdminSession();

  for (const status of ["in_progress", "completed"] as const) {
    const updated = await patch(
      `/api/admin/repair-requests/${requestId}`,
      { status },
      adminCookie,
    );
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.status, status);
  }

  const cancellationReason = "Customer is unavailable for the scheduled visit.";
  const cancelled = await patch(
    `/api/admin/repair-requests/${requestId}`,
    { status: "cancelled", cancellationReason },
    adminCookie,
  );
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.status, "cancelled");

  assert.equal(sentEmails.length, 3);
  const [inProgress, completed, cancelledEmail] = sentEmails;
  assert.equal(
    inProgress.subject,
    `Your Repair Request Is Now In Progress – ${requestId}`,
  );
  assert.equal(
    inProgress.text,
    [
      "Hi Jane Customer,",
      "",
      `Your repair request ${requestId} is now in progress. Our team is currently working on your repair request.`,
      "",
      "We will keep you updated if any additional information is required.",
      "",
      "Service type: Washing Machine",
      `Request ID: ${requestId}`,
      "For support, contact RZ Home Appliances Care at +91 80738 48334.",
      "Support email: owner@example.test",
      "",
      "Thank you,",
      "RZ Home Appliances Care",
    ].join("\n"),
  );
  assert.match(inProgress.html, /Your repair request is now in progress/);
  assert.match(inProgress.html, /Service type:<\/strong> Washing Machine/);

  assert.equal(
    completed.subject,
    `Your Repair Request Has Been Completed – ${requestId}`,
  );
  assert.equal(
    completed.text,
    [
      "Hi Jane Customer,",
      "",
      `Your repair request ${requestId} has been completed. Thank you for choosing RZ Home Appliances Care.`,
      "",
      "Service type: Washing Machine",
      `Request ID: ${requestId}`,
      "For support, contact RZ Home Appliances Care at +91 80738 48334.",
      "Support email: owner@example.test",
      "",
      "Thank you,",
      "RZ Home Appliances Care",
    ].join("\n"),
  );
  assert.match(completed.html, /Your repair request has been completed/);

  assert.equal(
    cancelledEmail.subject,
    `Update About Your Repair Request – ${requestId}`,
  );
  assert.equal(
    cancelledEmail.text,
    [
      "Hi Jane Customer,",
      "",
      `Your repair request ${requestId} has been cancelled.`,
      "",
      `Reason: ${cancellationReason}`,
      "",
      "Service type: Washing Machine",
      `Request ID: ${requestId}`,
      "For support, contact RZ Home Appliances Care at +91 80738 48334.",
      "Support email: owner@example.test",
      "",
      "Thank you,",
      "RZ Home Appliances Care",
    ].join("\n"),
  );
  assert.match(cancelledEmail.html, /Your repair request has been cancelled/);
  assert.match(cancelledEmail.html, /<strong>Reason:<\/strong> Customer is unavailable/);
  const savedRequest = await repairRequestForId(requestId);
  for (const message of sentEmails) {
    assert.equal(message.to, savedRequest.email);
    assert.equal(message.replyTo, "owner@example.test");
  }
});

test("admin repair status remains updated when the customer email fails", async () => {
  const requestId = await createRepairRequest();
  const adminCookie = await createAdminSession();
  emailDeliveryError = new Error("simulated SMTP failure");

  const updated = await patch(
    `/api/admin/repair-requests/${requestId}`,
    { status: "in_progress" },
    adminCookie,
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.status, "in_progress");

  const savedRequest = await repairRequestForId(requestId);
  assert.equal(savedRequest.status, "in_progress");
  assert.equal(sentEmails.length, 0);
});

test("repeated and concurrent attempts for one repair transition send only one customer email", async () => {
  const requestId = await createRepairRequest();
  const adminCookie = await createAdminSession();

  const concurrentUpdates = await Promise.all([
    patch(
      `/api/admin/repair-requests/${requestId}`,
      { status: "in_progress" },
      adminCookie,
    ),
    patch(
      `/api/admin/repair-requests/${requestId}`,
      { status: "in_progress" },
      adminCookie,
    ),
  ]);
  assert.deepEqual(
    concurrentUpdates.map(({ response }) => response.status),
    [200, 200],
  );

  const repeated = await patch(
    `/api/admin/repair-requests/${requestId}`,
    { status: "in_progress" },
    adminCookie,
  );
  assert.equal(repeated.response.status, 200);
  assert.equal(sentEmails.length, 1);
  assert.equal((await repairRequestForId(requestId)).status, "in_progress");
});

test("guest repair requests remain successful when notification email fails", async () => {
  const email = testEmail("repair");
  emailDeliveryError = new Error("simulated SMTP failure");
  let submission: JsonResponse;
  try {
    submission = await request("/api/repair-requests", {
      customerName: "Anonymous Customer",
      phone: "9876543210",
      email,
      applianceType: "Washing Machine Repair",
      problemDescription: "The appliance does not start.",
      address: "123 Test Street",
    });
  } finally {
    emailDeliveryError = undefined;
  }

  assert.equal(submission.response.status, 201);
  assert.equal(submission.body.success, true);
  assert.match(String(submission.body.requestId), /^RZ-[A-F0-9]{12}$/);
  assert.match(
    String(submission.body.message),
    /request is saved.*no need to submit again/i,
  );

  const savedRequest = await repairRequestForId(
    String(submission.body.requestId),
  );
  assert.equal(savedRequest.email, email);
  assert.equal(savedRequest.customerId, null);
  assert.equal(savedRequest.emailStatus, "failed");
});

test("guest repair emails go only to the owner and current form email", async () => {
  const currentEmail = testEmail("guest-current");
  const previousEmail = testEmail("guest-previous");
  const submission = await request("/api/repair-requests", {
    customerName: "Current Guest",
    phone: "9876543210",
    email: currentEmail.toUpperCase(),
    applianceType: "Refrigerator Repair",
    problemDescription: "The refrigerator is no longer cooling.",
    address: "123 Current Guest Street",
  });

  assert.equal(submission.response.status, 201);
  const savedRequest = await repairRequestForId(
    String(submission.body.requestId),
  );
  assert.equal(savedRequest.customerId, null);
  assert.equal(savedRequest.email, currentEmail);
  assert.equal(sentEmails.length, 2);

  const ownerMessage = sentEmails.find(
    (message) => message.to === "owner@example.test",
  );
  const customerMessage = sentEmails.find(
    (message) => message.to === currentEmail,
  );
  assert.ok(ownerMessage);
  assert.ok(customerMessage);
  assert.equal(ownerMessage.replyTo, currentEmail);
  assert.equal(customerMessage.replyTo, "owner@example.test");
  assert.ok(sentEmails.every((message) => message.to !== previousEmail));
});

test("authenticated contact submissions keep form contact details and attach to the session customer", async () => {
  const email = testEmail("contact-authenticated");
  const otherEmail = testEmail("contact-other-customer");
  await createAccount(email);
  await createAccount(otherEmail);

  const login = await request("/api/auth/login", {
    email,
    password: TEST_PASSWORD,
    rememberMe: true,
  });
  assert.equal(login.response.status, 200);
  const cookie = sessionCookie(login.response);

  const submission = await request(
    "/api/repair-requests",
    {
      customerName: "Untrusted Form Name",
      phone: "9876543210",
      email: otherEmail,
      applianceType: "Washing Machine Repair",
      problemDescription: "The appliance does not start.",
      address: "123 Test Street",
    },
    cookie,
  );
    assert.equal(submission.response.status, 201);

    const savedRequest = await repairRequestForId(
      String(submission.body.requestId),
    );
    const customer = await customerForEmail(email);
    assert.equal(savedRequest.customerId, customer.id);
    assert.equal(savedRequest.customerName, "Untrusted Form Name");
    assert.equal(savedRequest.email, otherEmail);
    assert.equal(savedRequest.emailStatus, "sent");
    assert.ok(
      sentEmails.some((message) =>
        message.text.includes("Customer type: Registered Customer"),
      ),
    );
    assert.deepEqual(
      new Set(sentEmails.map((message) => message.to)),
      new Set(["owner@example.test", otherEmail]),
    );
    assert.ok(sentEmails.every((message) => message.to !== email));

    const ownRequests = await get("/api/customer/repair-requests", cookie);
    assert.equal(ownRequests.response.status, 200);
    assert.ok(
      (ownRequests.body as unknown[]).some(
        (item) =>
          (item as { requestId?: string }).requestId ===
          submission.body.requestId,
      ),
    );

    const otherLogin = await request("/api/auth/login", {
      email: otherEmail,
      password: TEST_PASSWORD,
      rememberMe: true,
    });
    assert.equal(otherLogin.response.status, 200);
    const otherRequests = await get(
      "/api/customer/repair-requests",
      sessionCookie(otherLogin.response),
    );
    assert.equal(otherRequests.response.status, 200);
    assert.equal((otherRequests.body as unknown[]).length, 0);
});

test("booking creation and status emails use the exact booking customer", async () => {
  const email = testEmail("booking-current");
  const previousEmail = testEmail("booking-previous");
  await createAccount(email);

  const login = await request("/api/auth/login", {
    email,
    password: TEST_PASSWORD,
    rememberMe: true,
  });
  assert.equal(login.response.status, 200);
  const customerCookie = sessionCookie(login.response);

  const submission = await request(
    "/api/customer/bookings",
    {
      phone: "9876543210",
      applianceType: "LED TV Repair",
      problemDescription: "The television powers on but shows no picture.",
      preferredDate: "2026-10-20",
      preferredTime: "10:00 AM - 12:00 PM",
      address: "123 Booking Test Street",
      additionalNotes: "Please call before arrival.",
    },
    customerCookie,
  );
  assert.equal(submission.response.status, 201);

  const booking = await bookingForId(String(submission.body.bookingId));
  const customer = await customerForEmail(email);
  assert.equal(booking.customerId, customer.id);
  assert.equal(booking.email, email);
  assert.deepEqual(
    new Set(sentEmails.map((message) => message.to)),
    new Set(["owner@example.test", email]),
  );
  assert.ok(sentEmails.every((message) => message.to !== previousEmail));

  sentEmails.length = 0;
  const adminCookie = await createAdminSession();
  const updated = await patch(
    `/api/admin/bookings/${booking.bookingId}`,
    { status: "confirmed" },
    adminCookie,
  );
  assert.equal(updated.response.status, 200);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, booking.email);
  assert.equal(sentEmails[0].replyTo, "owner@example.test");
  assert.ok(sentEmails[0].to !== previousEmail);

  process.env.APP_BASE_URL = "https://care.example.test";
  sentEmails.length = 0;
  const completed = await patch(
    `/api/admin/bookings/${booking.bookingId}`,
    { status: "completed" },
    adminCookie,
  );
  assert.equal(completed.response.status, 200);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, booking.email);
  const bookingToken = sentEmails[0].text.match(/token=([a-f0-9]{64})/)?.[1];
  assert.ok(bookingToken);
  const bookingTarget = await get(
    `/api/customer/review-target?token=${bookingToken}`,
  );
  assert.equal(bookingTarget.response.status, 200);
  assert.equal(bookingTarget.body.sourceType, "booking");
  process.env.APP_BASE_URL = "";
});

test("public reviews expose only approved reviews and review APIs enforce authentication", async () => {
  const publicReviews = await get("/api/reviews?limit=100");
  assert.equal(publicReviews.response.status, 200);
  assert.ok(Array.isArray(publicReviews.body));
  const approvedReviews = await db
    .select({ reviewId: reviewsTable.reviewId })
    .from(reviewsTable)
    .where(eq(reviewsTable.status, "approved"));
  const approvedIds = new Set(approvedReviews.map((review) => review.reviewId));
  for (const review of publicReviews.body as Array<{ reviewId?: string }>) {
    assert.ok(review.reviewId);
    assert.ok(approvedIds.has(review.reviewId));
  }

  const eligible = await get("/api/customer/reviews/eligible");
  assert.equal(eligible.response.status, 401);

  const target = await get("/api/customer/review-target?requestId=RZ-not-owned");
  assert.equal(target.response.status, 401);

  const submission = await request("/api/customer/reviews", {
    requestId: "RZ-not-owned",
    rating: 5,
    reviewMessage: "A helpful repair service.",
    showFirstName: false,
  });
  assert.equal(submission.response.status, 401);

  const adminReviews = await get("/api/admin/reviews");
  assert.equal(adminReviews.response.status, 403);
});

test("guest completion emails contain a secure review link and guest reviews are moderated once", async () => {
  const previousBaseUrl = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://care.example.test";
  try {
    const requestId = await createRepairRequest("pending");
    const adminCookie = await createAdminSession();
    sentEmails.length = 0;

    const completed = await patch(
      `/api/admin/repair-requests/${requestId}`,
      { status: "completed" },
      adminCookie,
    );
    assert.equal(completed.response.status, 200);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, (await repairRequestForId(requestId)).email);
    assert.match(sentEmails[0].text, /Leave a review: https:\/\/care\.example\.test\/customer\/review\?token=/);
    assert.match(sentEmails[0].html, /Leave a Review/);

    const token = sentEmails[0].text.match(/token=([a-f0-9]{64})/)?.[1];
    assert.ok(token);
    const invalid = await get("/api/customer/review-target?token=invalid-token");
    assert.equal(invalid.response.status, 404);
    const mismatched = await get(
      `/api/customer/review-target?token=${token}&requestId=RZ-other-source`,
    );
    assert.equal(mismatched.response.status, 403);
    const target = await get(`/api/customer/review-target?token=${token}`);
    assert.equal(target.response.status, 200);
    assert.equal(target.body.sourceId, requestId);
    assert.equal(target.body.existingReview, null);

    const submitted = await request("/api/customer/reviews", {
      token,
      rating: 5,
      reviewMessage: "The technician explained everything and repaired it carefully.",
      showFirstName: false,
    });
    assert.equal(submitted.response.status, 201);
    assert.equal(submitted.body.status, "pending");
    assert.equal(submitted.body.sourceId, requestId);

    const duplicate = await request("/api/customer/reviews", {
      token,
      rating: 5,
      reviewMessage: "This second submission must not be accepted.",
      showFirstName: false,
    });
    assert.equal(duplicate.response.status, 409);

    const adminReviews = await get("/api/admin/reviews", adminCookie);
    assert.equal(adminReviews.response.status, 200);
    const review = (adminReviews.body as unknown[]).find(
      (item) => (item as { sourceId?: string }).sourceId === requestId,
    ) as { reviewId: string; customerId: string | null } | undefined;
    assert.ok(review);
    assert.equal(review.customerId, null);

    const approved = await patch(
      `/api/admin/reviews/${review.reviewId}`,
      { status: "approved" },
      adminCookie,
    );
    assert.equal(approved.response.status, 200);
    const publicReviews = await get("/api/reviews?limit=100");
    assert.ok(
      (publicReviews.body as unknown[]).some(
        (item) => (item as { reviewId?: string }).reviewId === review.reviewId,
      ),
    );

    const hidden = await patch(
      `/api/admin/reviews/${review.reviewId}`,
      { status: "hidden", adminNotes: "Hidden during moderation test." },
      adminCookie,
    );
    assert.equal(hidden.response.status, 200);
    const hiddenPublicReviews = await get("/api/reviews?limit=100");
    assert.ok(
      !(hiddenPublicReviews.body as unknown[]).some(
        (item) => (item as { reviewId?: string }).reviewId === review.reviewId,
      ),
    );
    const deleted = await remove(
      `/api/admin/reviews/${review.reviewId}`,
      adminCookie,
    );
    assert.equal(deleted.response.status, 204);
    const deletedDetail = await get(
      `/api/admin/reviews/${review.reviewId}`,
      adminCookie,
    );
    assert.equal(deletedDetail.response.status, 404);

    const expiredRequestId = await createRepairRequest("pending");
    const expiredCompletion = await patch(
      `/api/admin/repair-requests/${expiredRequestId}`,
      { status: "completed" },
      adminCookie,
    );
    assert.equal(expiredCompletion.response.status, 200);
    const expiredToken = sentEmails[sentEmails.length - 1].text.match(/token=([a-f0-9]{64})/)?.[1];
    assert.ok(expiredToken);
    const [invitation] = await db
      .select({ id: reviewInvitationsTable.id })
      .from(reviewInvitationsTable)
      .where(eq(reviewInvitationsTable.tokenHash, hashToken(expiredToken)))
      .limit(1);
    assert.ok(invitation);
    await db
      .update(reviewInvitationsTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(reviewInvitationsTable.id, invitation.id));
    const expired = await get(`/api/customer/review-target?token=${expiredToken}`);
    assert.equal(expired.response.status, 404);
  } finally {
    process.env.APP_BASE_URL = previousBaseUrl;
  }
});