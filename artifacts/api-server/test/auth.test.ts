import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { eq, like } from "drizzle-orm";
import type { AddressInfo } from "node:net";
import app from "../src/app.ts";
import {
  customersTable,
  db,
  passwordResetTokensTable,
  pool,
  repairRequestsTable,
} from "@workspace/db";

process.env.NODE_ENV = "production";
process.env.APP_BASE_URL = "";
process.env.REPLIT_DEV_DOMAIN = "";
delete process.env.BUSINESS_EMAIL;
delete process.env.EMAIL_FROM;

const TEST_EMAIL_PREFIX = "auth-regression-";
const TEST_PASSWORD = "ValidPass1";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
let clientIp = "198.51.100.1";
let nextClientIpOctet = 1;

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

async function requestFromSource(
  path: string,
  body: Record<string, unknown>,
  sourceAddress: string,
  forwardedFor: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL(path, baseUrl);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const clientRequest = http.request(
      {
        hostname: url.hostname,
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

function sessionCookie(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies.find((value) => value.startsWith("rz_session="));
  assert.ok(cookie, "expected the login response to set a session cookie");
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

async function cleanupTestData(): Promise<void> {
  await db
    .delete(repairRequestsTable)
    .where(like(repairRequestsTable.email, `${TEST_EMAIL_PREFIX}%`));

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

test("anonymous repair requests are accepted without an auth cookie", async () => {
  const email = testEmail("repair");
  const submission = await request("/api/repair-requests", {
    customerName: "Anonymous Customer",
    phone: "9876543210",
    email,
    applianceType: "Washing Machine Repair",
    problemDescription: "The appliance does not start.",
    address: "123 Test Street",
  });

  assert.equal(submission.response.status, 502);
  assert.match(
    String(submission.body.error),
    /request was saved, but we could not send the confirmation email/i,
  );

  const [savedRequest] = await db
    .select()
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.email, email))
    .limit(1);
  assert.ok(savedRequest);
  assert.equal(savedRequest.emailStatus, "failed");
});