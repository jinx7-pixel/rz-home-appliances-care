import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { eq, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import nodemailer, { type Transporter } from "nodemailer";
import type { AddressInfo } from "node:net";
import app from "../src/app.ts";
import { isInitialAdminBootstrapEligible } from "../src/routes/admin-auth.ts";
import router from "../src/routes/index.ts";
import {
  adminUsersTable,
  bookingsTable,
  customersTable,
  db,
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
const TEST_ADMIN_PASSWORD = "AdminPass1";
const requireIpv6Loopback = process.env.REQUIRE_IPV6_LOOPBACK === "1";

let server: ReturnType<typeof app.listen>;
let ipv6Server: ReturnType<typeof app.listen> | undefined;
let baseUrl: string;
let ipv6BaseUrl: string | undefined;
let ipv6MappedBaseUrl: string | undefined;
let ipv6UnavailableReason: string | undefined;
let clientIp = uniqueClientAddress();

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

router.get("/__test/unexpected-error", (_request, _response, next) => {
  next(new Error("Sensitive database diagnostic"));
});

type JsonResponse = {
  response: Response;
  body: Record<string, unknown>;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function originFor(targetBaseUrl = baseUrl): string {
  return new URL(targetBaseUrl).origin;
}

function testEmail(label: string): string {
  return `${TEST_EMAIL_PREFIX}${label}-${randomUUID()}@example.test`;
}

function uniqueClientAddress(): string {
  const token = randomUUID().replaceAll("-", "");
  const tail = Number.parseInt(token.slice(12, 16), 16) || 1;
  return `2001:db8:${token.slice(0, 4)}:${token.slice(4, 8)}:${token.slice(8, 12)}::${tail.toString(16)}`;
}

function uniqueLoopbackIpv4(): string {
  const token = randomUUID().replaceAll("-", "");
  const octet = (start: number) =>
    Number.parseInt(token.slice(start, start + 2), 16);
  return `127.${octet(0)}.${octet(2)}.${(octet(4) % 254) + 1}`;
}

async function request(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
  requestClientIp = clientIp,
  extraHeaders: Record<string, string> = {},
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: originFor(),
      "x-forwarded-for": requestClientIp,
      ...(cookie ? { cookie } : {}),
      ...extraHeaders,
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
      origin: originFor(),
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
          origin: originFor(targetBaseUrl),
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
      origin: originFor(),
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

function setCookieNamed(response: Response, name: string): string {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie, `expected the login response to set a ${name} cookie`);
  return cookie;
}

function cookieNamed(response: Response, name: string): string {
  return setCookieNamed(response, name).split(";", 1)[0];
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

async function cleanupTestData(): Promise<void> {
  sentEmails.length = 0;
  emailDeliveryError = undefined;

  await db
    .delete(repairRequestsTable)
    .where(like(repairRequestsTable.email, `${TEST_EMAIL_PREFIX}%`));

  await db
    .delete(adminUsersTable)
    .where(like(adminUsersTable.username, `${TEST_ADMIN_PREFIX}%`));
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
  clientIp = uniqueClientAddress();
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

test("ADMIN_PASSWORD bootstrap eligibility ends once an admin is initialized", () => {
  assert.equal(
    isInitialAdminBootstrapEligible(
      "admin",
      "bootstrap-pass",
      "bootstrap-pass",
      false,
    ),
    true,
  );
  assert.equal(
    isInitialAdminBootstrapEligible(
      "admin",
      "bootstrap-pass",
      "bootstrap-pass",
      true,
    ),
    false,
  );
  assert.equal(
    isInitialAdminBootstrapEligible(
      "owner",
      "bootstrap-pass",
      "bootstrap-pass",
      false,
    ),
    false,
  );
  assert.equal(
    isInitialAdminBootstrapEligible(
      "admin",
      "wrong-pass",
      "bootstrap-pass",
      false,
    ),
    false,
  );
  assert.equal(
    isInitialAdminBootstrapEligible(
      "admin",
      "bootstrap-pass",
      undefined,
      false,
    ),
    false,
  );
});

test("CORS is origin-restricted and admin mutations reject cross-origin requests", async () => {
  const previousBaseUrl = process.env.APP_BASE_URL;
  const productionOrigin = "https://navbar-builder.replit.app";
  const untrustedOrigin = "https://attacker.example";
  process.env.APP_BASE_URL = productionOrigin;

  try {
    const allowedOriginResponse = await fetch(`${baseUrl}/api/healthz`, {
      headers: { origin: productionOrigin },
    });
    assert.equal(
      allowedOriginResponse.headers.get("access-control-allow-origin"),
      productionOrigin,
    );

    const untrustedOriginResponse = await fetch(`${baseUrl}/api/healthz`, {
      headers: { origin: untrustedOrigin },
    });
    assert.equal(
      untrustedOriginResponse.headers.get("access-control-allow-origin"),
      null,
    );

    const allowedPreflight = await fetch(
      `${baseUrl}/api/admin/repair-requests/example`,
      {
        method: "OPTIONS",
        headers: {
          origin: productionOrigin,
          "access-control-request-method": "PATCH",
          "access-control-request-headers": "content-type,idempotency-key",
        },
      },
    );
    assert.equal(allowedPreflight.status, 204);
    assert.equal(
      allowedPreflight.headers.get("access-control-allow-origin"),
      productionOrigin,
    );
    assert.equal(
      allowedPreflight.headers.get("access-control-allow-credentials"),
      null,
    );
    assert.deepEqual(
      allowedPreflight.headers
        .get("access-control-allow-methods")
        ?.split(",")
        .map((method) => method.trim()),
      ["GET", "HEAD", "POST", "PATCH", "DELETE"],
    );
    assert.deepEqual(
      allowedPreflight.headers
        .get("access-control-allow-headers")
        ?.toLowerCase()
        .split(",")
        .map((header) => header.trim())
        .sort(),
      ["content-type", "idempotency-key"],
    );

    const untrustedPreflight = await fetch(
      `${baseUrl}/api/admin/repair-requests/example`,
      {
        method: "OPTIONS",
        headers: {
          origin: untrustedOrigin,
          "access-control-request-method": "PATCH",
          "access-control-request-headers": "content-type",
        },
      },
    );
    assert.equal(
      untrustedPreflight.headers.get("access-control-allow-origin"),
      null,
    );

    const requestId = await createRepairRequest();
    const adminCookie = await createAdminSession();
    const rejectedMutation = await fetch(
      `${baseUrl}/api/admin/repair-requests/${requestId}`,
      {
        method: "PATCH",
        headers: {
          origin: untrustedOrigin,
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ status: "contacted" }),
      },
    );
    assert.equal(rejectedMutation.status, 403);
    assert.equal((await repairRequestForId(requestId)).status, "pending");

    const rejectedWithoutOrigin = await fetch(
      `${baseUrl}/api/admin/repair-requests/${requestId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ status: "contacted" }),
      },
    );
    assert.equal(rejectedWithoutOrigin.status, 403);
    assert.equal((await repairRequestForId(requestId)).status, "pending");

    const unauthenticatedMutation = await patch(
      `/api/admin/repair-requests/${requestId}`,
      { status: "contacted" },
    );
    assert.equal(unauthenticatedMutation.response.status, 403);

    const configuredOriginOnDifferentHost = await fetch(
      `${baseUrl}/api/admin/repair-requests/${requestId}`,
      {
        method: "PATCH",
        headers: {
          origin: productionOrigin,
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ status: "contacted" }),
      },
    );
    assert.equal(configuredOriginOnDifferentHost.status, 403);
    assert.equal((await repairRequestForId(requestId)).status, "pending");

    const allowedMutation = await patch(
      `/api/admin/repair-requests/${requestId}`,
      { status: "contacted" },
      adminCookie,
    );
    assert.equal(allowedMutation.response.status, 200);
    assert.equal((await repairRequestForId(requestId)).status, "contacted");

    const allowedAdminList = await get(
      "/api/admin/repair-requests",
      adminCookie,
    );
    assert.equal(allowedAdminList.response.status, 200);
  } finally {
    process.env.APP_BASE_URL = previousBaseUrl;
  }
});

test("API responses include security headers and exact proxy trust settings", async () => {
  const response = await get("/api/healthz");
  assert.equal(response.response.status, 200);
  assert.equal(response.response.headers.get("x-powered-by"), null);
  assert.equal(
    response.response.headers.get("content-security-policy"),
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  assert.equal(response.response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(
    response.response.headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=()",
  );
  assert.equal(
    response.response.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );
  assert.equal(
    response.response.headers.get("strict-transport-security"),
    "max-age=31536000",
  );
  assert.deepEqual(app.get("trust proxy"), ["127.0.0.1/32", "::1/128"]);
});

test("request body limits and the error handler return safe JSON responses", async () => {
  const oversized = await request("/api/repair-requests", {
    customerName: "Anonymous Customer",
    phone: "9876543210",
    email: testEmail("oversized"),
    applianceType: "Washing Machine Repair",
    problemDescription: "x".repeat(40_000),
    address: "123 Test Street",
  });
  assert.equal(oversized.response.status, 413);
  assert.deepEqual(oversized.body, { error: "Request body is too large." });

  const malformed = await fetch(`${baseUrl}/api/repair-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: originFor(),
    },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "Invalid request body." });

  const unexpected = await get("/api/__test/unexpected-error");
  assert.equal(unexpected.response.status, 500);
  assert.deepEqual(unexpected.body, {
    error: "An unexpected server error occurred.",
  });
  assert.equal(
    JSON.stringify(unexpected.body).includes("Sensitive database diagnostic"),
    false,
  );
});

test("admin session cookies are Secure in production and non-Secure in development", async () => {
  const username = `${TEST_ADMIN_PREFIX}${randomUUID()}`;
  await db.insert(adminUsersTable).values({
    username,
    displayName: "Cookie Configuration Admin",
    passwordHash: await bcrypt.hash(TEST_ADMIN_PASSWORD, 4),
  });

  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const productionLogin = await request("/api/admin/auth/login", {
      username,
      password: TEST_ADMIN_PASSWORD,
    });
    assert.equal(productionLogin.response.status, 200);
    const productionCookie = setCookieNamed(
      productionLogin.response,
      "rz_admin_session",
    );
    assert.match(productionCookie, /;\s*HttpOnly(?:;|$)/i);
    assert.match(productionCookie, /;\s*Secure(?:;|$)/i);
    assert.match(productionCookie, /;\s*SameSite=Lax(?:;|$)/i);

    process.env.NODE_ENV = "development";
    const developmentLogin = await request("/api/admin/auth/login", {
      username,
      password: TEST_ADMIN_PASSWORD,
    });
    assert.equal(developmentLogin.response.status, 200);
    const developmentCookie = setCookieNamed(
      developmentLogin.response,
      "rz_admin_session",
    );
    assert.match(developmentCookie, /;\s*HttpOnly(?:;|$)/i);
    assert.doesNotMatch(developmentCookie, /;\s*Secure(?:;|$)/i);
    assert.match(developmentCookie, /;\s*SameSite=Lax(?:;|$)/i);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("rate limits trust forwarded IPs only from the configured proxy addresses", async () => {
  const trustedClient = uniqueClientAddress();
  const differentTrustedClient = uniqueClientAddress();
  const untrustedSource = uniqueLoopbackIpv4();
  const invalidRepairRequest = {
    customerName: "A",
    phone: "not-a-phone",
    email: "not-an-email",
    applianceType: "Repair",
    problemDescription: "Broken",
    address: "A",
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(
      "/api/repair-requests",
      invalidRepairRequest,
      undefined,
      trustedClient,
    );
    assert.equal(response.response.status, 400);
  }

  const trustedProxyLimited = await request(
    "/api/repair-requests",
    invalidRepairRequest,
    undefined,
    trustedClient,
  );
  assert.equal(trustedProxyLimited.response.status, 429);

  const differentClientResponse = await request(
    "/api/repair-requests",
    invalidRepairRequest,
    undefined,
    differentTrustedClient,
  );
  assert.equal(differentClientResponse.response.status, 400);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await requestFromSource(
      "/api/repair-requests",
      invalidRepairRequest,
      untrustedSource,
      uniqueClientAddress(),
    );
    assert.equal(response.status, 400);
  }

  const untrustedHeaderLimited = await requestFromSource(
    "/api/repair-requests",
    invalidRepairRequest,
    untrustedSource,
    uniqueClientAddress(),
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

  const invalidRepairRequest = {
    customerName: "A",
    phone: "not-a-phone",
    email: "not-an-email",
    applianceType: "Repair",
    problemDescription: "Broken",
    address: "A",
  };
  const trustedClient = uniqueClientAddress();
  const differentTrustedClient = uniqueClientAddress();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await requestFromSource(
      "/api/repair-requests",
      invalidRepairRequest,
      "::1",
      trustedClient,
      ipv6BaseUrl,
    );
    assert.equal(response.status, 400);
  }

  const limited = await requestFromSource(
    "/api/repair-requests",
    invalidRepairRequest,
    "::1",
    trustedClient,
    ipv6BaseUrl,
  );
  assert.equal(limited.status, 429);

  const differentClientResponse = await requestFromSource(
    "/api/repair-requests",
    invalidRepairRequest,
    "::1",
    differentTrustedClient,
    ipv6BaseUrl,
  );
  assert.equal(differentClientResponse.status, 400);
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

  const invalidRepairRequest = {
    customerName: "A",
    phone: "not-a-phone",
    email: "not-an-email",
    applianceType: "Repair",
    problemDescription: "Broken",
    address: "A",
  };
  const untrustedIpv6Source = `::ffff:${uniqueLoopbackIpv4()}`;
  const forwardedClient = uniqueClientAddress();
  assert.ok(ipv6MappedBaseUrl);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await requestFromSource(
      "/api/repair-requests",
      invalidRepairRequest,
      untrustedIpv6Source,
      forwardedClient,
      ipv6MappedBaseUrl,
    );
    assert.equal(response.status, 400);
  }

  const limited = await requestFromSource(
    "/api/repair-requests",
    invalidRepairRequest,
    untrustedIpv6Source,
    uniqueClientAddress(),
    ipv6MappedBaseUrl,
  );
  assert.equal(limited.status, 429);
});

test("admin login attempts are rate limited through the shared database bucket", async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request("/api/admin/auth/login", {
      username: "missing-admin-account",
      password: "incorrect-password",
    });
    assert.equal(response.response.status, 401);
  }

  const limited = await request("/api/admin/auth/login", {
    username: "missing-admin-account",
    password: "incorrect-password",
  });
  assert.equal(limited.response.status, 429);
});

test("removed customer auth, history, and booking routes stay unavailable", async () => {
  const statusOnly = async (
    path: string,
    method: "GET" | "POST" | "PATCH",
    body?: Record<string, unknown>,
  ) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: originFor(),
        "x-forwarded-for": clientIp,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response.status;
  };

  for (const path of [
    "/api/auth/signup",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/customer/bookings",
  ]) {
    assert.equal(await statusOnly(path, "POST", {}), 404, path);
  }

  for (const path of [
    "/api/auth/me",
    "/api/customer/repair-requests",
    "/api/customer/reviews/eligible",
  ]) {
    assert.equal(await statusOnly(path, "GET"), 404, path);
  }

  assert.equal(
    await statusOnly("/api/admin/bookings/RZ-removed", "PATCH", {
      status: "confirmed",
    }),
    404,
  );
});

test("admin repair status saves stay silent for pending, contacted, and unchanged statuses", async () => {
  const requestId = await createRepairRequest();
  const adminCookie = await createAdminSession();
  const listed = await get(
    `/api/admin/repair-requests?search=${encodeURIComponent(requestId)}`,
    adminCookie,
  );
  assert.equal(listed.response.status, 200);
  assert.ok(
    (listed.body as unknown[]).some(
      (item) => (item as { requestId?: string }).requestId === requestId,
    ),
  );

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

test("repair submissions are idempotent for the same key and payload", async () => {
  const email = testEmail("idempotent");
  const body = {
    customerName: "Anonymous Customer",
    phone: "9876543210",
    email,
    applianceType: "Washing Machine Repair",
    problemDescription: "The appliance does not start.",
    address: "123 Test Street",
  };
  const headers = { "Idempotency-Key": "repair-form-submit-0001" };

  const first = await request(
    "/api/repair-requests",
    body,
    undefined,
    undefined,
    headers,
  );
  assert.equal(first.response.status, 201);
  const emailsAfterFirstSubmission = sentEmails.length;

  const replay = await request(
    "/api/repair-requests",
    body,
    undefined,
    undefined,
    headers,
  );
  assert.equal(replay.response.status, 201);
  assert.equal(replay.body.requestId, first.body.requestId);
  assert.equal(sentEmails.length, emailsAfterFirstSubmission);

  const savedRows = await db
    .select()
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.email, email));
  assert.equal(savedRows.length, 1);

  const changedPayload = await request(
    "/api/repair-requests",
    { ...body, customerName: "Different Customer" },
    undefined,
    undefined,
    headers,
  );
  assert.equal(changedPayload.response.status, 409);
  assert.equal(sentEmails.length, emailsAfterFirstSubmission);
  const rowsAfterConflict = await db
    .select()
    .from(repairRequestsTable)
    .where(eq(repairRequestsTable.email, email));
  assert.equal(rowsAfterConflict.length, 1);
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

test("legacy booking review invitations and admin review details remain available", async () => {
  const customerEmail = testEmail("legacy-booking");
  const bookingId = `RZB-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const token = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
  const [customer] = await db
    .insert(customersTable)
    .values({
      fullName: "Legacy Booking Customer",
      email: customerEmail,
      passwordHash: "unused-review-test-hash",
    })
    .returning({ id: customersTable.id });
  assert.ok(customer);

  try {
    await db.insert(bookingsTable).values({
      bookingId,
      customerId: customer.id,
      customerName: "Legacy Booking Customer",
      email: customerEmail,
      phone: "9876543210",
      applianceType: "LED TV Repair",
      problemDescription: "The television powers on but shows no picture.",
      preferredDate: "2025-01-15",
      preferredTime: "10:00 AM - 12:00 PM",
      address: "456 Legacy Booking Street",
      status: "completed",
    });
    await db.insert(reviewInvitationsTable).values({
      tokenHash: hashToken(token),
      customerId: customer.id,
      customerEmail,
      requestId: null,
      bookingId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const target = await get(`/api/customer/review-target?token=${token}`);
    assert.equal(target.response.status, 200);
    assert.equal(target.body.sourceType, "booking");
    assert.equal(target.body.sourceId, bookingId);
    assert.equal(target.body.existingReview, null);

    const submitted = await request("/api/customer/reviews", {
      token,
      rating: 5,
      reviewMessage: "The old booking review link still works as expected.",
      showFirstName: false,
    });
    assert.equal(submitted.response.status, 201);
    assert.equal(submitted.body.sourceType, "booking");
    assert.equal(submitted.body.sourceId, bookingId);

    const adminCookie = await createAdminSession();
    const adminReviews = await get(
      `/api/admin/reviews?search=${encodeURIComponent(bookingId)}`,
      adminCookie,
    );
    assert.equal(adminReviews.response.status, 200);
    const review = (adminReviews.body as unknown[]).find(
      (item) => (item as { sourceId?: string }).sourceId === bookingId,
    ) as
      | {
          sourceType: string;
          relatedStatus: string;
          relatedAddress: string | null;
        }
      | undefined;
    assert.ok(review);
    assert.equal(review.sourceType, "booking");
    assert.equal(review.relatedStatus, "completed");
    assert.equal(review.relatedAddress, "456 Legacy Booking Street");
  } finally {
    await db.delete(reviewsTable).where(eq(reviewsTable.bookingId, bookingId));
    await db
      .delete(reviewInvitationsTable)
      .where(eq(reviewInvitationsTable.bookingId, bookingId));
    await db.delete(bookingsTable).where(eq(bookingsTable.bookingId, bookingId));
    await db.delete(customersTable).where(eq(customersTable.id, customer.id));
  }
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