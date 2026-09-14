import { randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  authSessionsTable,
  customersTable,
  db,
  passwordResetTokensTable,
} from "@workspace/db";
import {
  AuthForgotPasswordBody,
  AuthLoginBody,
  AuthResetPasswordBody,
  AuthSignupBody,
} from "@workspace/api-zod";
import { sendPasswordResetEmail } from "../lib/repair-request-email";
import { logger } from "../lib/logger";
import {
  clearSessionCookie,
  getAuthenticatedCustomer,
  getSessionToken,
  hashSessionToken,
  SESSION_COOKIE,
} from "../lib/auth-session";

const router = Router();
const PASSWORD_RESET_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBERED_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_HASH_ROUNDS = 12;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitEntry>();

function clientKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function consumeRateLimit(
  request: Request,
  bucketName: string,
  limit: number,
  windowMs: number,
): boolean {
  const key = `${bucketName}:${clientKey(request)}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

function getSafeUser(customer: {
  id: string;
  fullName: string;
  email: string;
}) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
  };
}

function setSessionCookie(
  response: Response,
  token: string,
  maxAge: number,
): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

function getResetBaseUrl(request: Request): string | null {
  const configured = process.env.APP_BASE_URL?.trim();
  const origin = request.get("origin")?.trim();
  const developmentDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const candidate =
    configured ||
    origin ||
    (developmentDomain ? `https://${developmentDomain}` : null);

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getResetPathPrefix(request: Request): string {
  const configuredPath = process.env.APP_BASE_PATH?.trim();
  if (configuredPath) {
    return `/${configuredPath.replace(/^\/|\/$/g, "")}`;
  }

  const referer = request.get("referer")?.trim();
  if (!referer) return "";

  try {
    const path = new URL(referer).pathname;
    const forgotPathIndex = path.lastIndexOf("/forgot-password");
    return forgotPathIndex >= 0
      ? path.slice(0, forgotPathIndex).replace(/\/$/, "")
      : "";
  } catch {
    return "";
  }
}

async function createSession(
  customerId: string,
  rememberMe: boolean,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = new Date(
    now + (rememberMe ? REMEMBERED_SESSION_TTL_MS : SESSION_TTL_MS),
  );

  await db.insert(authSessionsTable).values({
    customerId,
    sessionHash: hashSessionToken(token),
    expiresAt,
  });

  return token;
}

router.post("/signup", async (request, response) => {
  if (!consumeRateLimit(request, "signup", 5, 15 * 60 * 1000)) {
    return response.status(429).json({
      error: "Too many signup attempts. Please try again later.",
    });
  }

  const parsed = AuthSignupBody.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: "Enter a valid name, email, and password.",
    });
  }

  const fullName = normalizeName(parsed.data.fullName);
  const email = normalizeEmail(parsed.data.email);

  if (fullName.length < 2) {
    return response.status(400).json({ error: "Enter your full name." });
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return response.status(400).json({ error: "Passwords do not match." });
  }

  if (!isStrongPassword(parsed.data.password)) {
    return response.status(400).json({
      error:
        "Password must be 8–128 characters and include uppercase, lowercase, and a number.",
    });
  }

  const existingCustomer = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.email, email))
    .limit(1);

  if (existingCustomer.length > 0) {
    return response
      .status(409)
      .json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(
    parsed.data.password,
    PASSWORD_HASH_ROUNDS,
  );

  try {
    await db.insert(customersTable).values({
      fullName,
      email,
      passwordHash,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return response
        .status(409)
        .json({ error: "An account with this email already exists." });
    }
    throw error;
  }

  return response
    .status(201)
    .json({ message: "Account created. You can now sign in." });
});

router.post("/login", async (request, response) => {
  if (!consumeRateLimit(request, "login", 10, 15 * 60 * 1000)) {
    return response.status(429).json({
      error: "Too many login attempts. Please try again later.",
    });
  }

  const parsed = AuthLoginBody.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: "Enter a valid email and password.",
    });
  }

  const email = normalizeEmail(parsed.data.email);
  const [customer] = await db
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      email: customersTable.email,
      passwordHash: customersTable.passwordHash,
    })
    .from(customersTable)
    .where(eq(customersTable.email, email))
    .limit(1);

  const passwordMatches = customer
    ? await bcrypt.compare(parsed.data.password, customer.passwordHash)
    : false;

  if (!customer || !passwordMatches) {
    return response.status(401).json({ error: "Invalid email or password." });
  }

  const token = await createSession(customer.id, parsed.data.rememberMe ?? false);
  setSessionCookie(
    response,
    token,
    parsed.data.rememberMe
      ? REMEMBERED_SESSION_TTL_MS
      : SESSION_TTL_MS,
  );

  return response.json({ user: getSafeUser(customer) });
});

router.post("/logout", async (request, response) => {
  const token = getSessionToken(request);
  if (token) {
    await db
      .delete(authSessionsTable)
      .where(eq(authSessionsTable.sessionHash, hashSessionToken(token)));
  }

  clearSessionCookie(response);
  return response.json({ message: "Signed out successfully." });
});

router.post("/forgot-password", async (request, response) => {
  if (!consumeRateLimit(request, "forgot-password", 5, 15 * 60 * 1000)) {
    return response.status(429).json({
      error: "Too many reset attempts. Please try again later.",
    });
  }

  const parsed = AuthForgotPasswordBody.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const email = normalizeEmail(parsed.data.email);
  const [customer] = await db
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      email: customersTable.email,
    })
    .from(customersTable)
    .where(eq(customersTable.email, email))
    .limit(1);

  if (customer) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.customerId, customer.id));
    await db.insert(passwordResetTokensTable).values({
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    const baseUrl = getResetBaseUrl(request);
    if (baseUrl) {
      try {
        const resetPath = `${getResetPathPrefix(request)}/reset-password`;
        const resetUrl = new URL(resetPath, baseUrl);
        resetUrl.searchParams.set("token", rawToken);
        await sendPasswordResetEmail({
          email: customer.email,
          fullName: customer.fullName,
          resetLink: resetUrl.toString(),
        });
      } catch (error) {
        logger.error({ err: error }, "Password reset email delivery failed");
      }
    } else {
      logger.error("Password reset email skipped because APP_BASE_URL is missing");
    }
  }

  return response.status(202).json({ message: PASSWORD_RESET_MESSAGE });
});

router.post("/reset-password", async (request, response) => {
  if (!consumeRateLimit(request, "reset-password", 8, 15 * 60 * 1000)) {
    return response.status(429).json({
      error: "Too many reset attempts. Please try again later.",
    });
  }

  const parsed = AuthResetPasswordBody.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: "Use a valid reset link and enter a valid password.",
    });
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return response.status(400).json({ error: "Passwords do not match." });
  }

  if (!isStrongPassword(parsed.data.password)) {
    return response.status(400).json({
      error:
        "Password must be 8–128 characters and include uppercase, lowercase, and a number.",
    });
  }

  const passwordHash = await bcrypt.hash(
    parsed.data.password,
    PASSWORD_HASH_ROUNDS,
  );
  const tokenHash = hashSessionToken(parsed.data.token);

  try {
    await db.transaction(async (transaction) => {
      const now = new Date();
      const [claimedToken] = await transaction
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokensTable.tokenHash, tokenHash),
            isNull(passwordResetTokensTable.usedAt),
            gt(passwordResetTokensTable.expiresAt, now),
          ),
        )
        .returning({ customerId: passwordResetTokensTable.customerId });

      if (!claimedToken) {
        throw new Error("INVALID_RESET_TOKEN");
      }

      await transaction
        .update(customersTable)
        .set({ passwordHash })
        .where(eq(customersTable.id, claimedToken.customerId));
      await transaction
        .delete(authSessionsTable)
        .where(eq(authSessionsTable.customerId, claimedToken.customerId));
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RESET_TOKEN") {
      return response
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
    }
    throw error;
  }

  return response.json({
    message: "Your password has been reset. You can now sign in.",
  });
});

router.get("/me", async (request, response) => {
  const customer = await getAuthenticatedCustomer(request, response);
  if (!customer) {
    return response.json({ authenticated: false, user: null });
  }

  return response.json({
    authenticated: true,
    user: getSafeUser(customer),
  });
});

export default router;