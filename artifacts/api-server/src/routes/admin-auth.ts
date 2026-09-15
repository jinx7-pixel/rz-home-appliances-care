import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  AdminAuthLoginBody,
  AdminAuthLoginResponse,
  AdminAuthMeResponse,
} from "@workspace/api-zod";
import { adminSessionsTable, adminUsersTable, db } from "@workspace/db";
import {
  clearAdminSessionCookie,
  createAdminSession,
  getAdminSessionToken,
  getAuthenticatedAdmin,
  hashSessionToken,
  setAdminSessionCookie,
} from "../lib/admin-auth";

const router = Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, number[]>();

// Temporary development access is seeded as the "admin" row in admin_users with
// a bcrypt hash. Disable that row or replace its password_hash before production;
// plaintext credentials must never be stored in source, client code, or responses.
function clientKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  const key = clientKey(request);
  const recentAttempts = (loginAttempts.get(key) ?? []).filter(
    (timestamp) => now - timestamp < LOGIN_WINDOW_MS,
  );

  if (recentAttempts.length >= LOGIN_MAX_ATTEMPTS) {
    loginAttempts.set(key, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  loginAttempts.set(key, recentAttempts);
  return false;
}

function setAdminCookie(response: Response, token: string): void {
  setAdminSessionCookie(response, token);
}

router.post("/auth/login", async (request, response) => {
  if (isRateLimited(request)) {
    return response.status(429).json({
      error: "Too many admin login attempts. Please try again later.",
    });
  }

  const parsed = AdminAuthLoginBody.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: "Enter a valid admin username and password.",
    });
  }

  const username = parsed.data.username.trim().toLowerCase();
  const [admin] = await db
    .select({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      displayName: adminUsersTable.displayName,
      passwordHash: adminUsersTable.passwordHash,
      isActive: adminUsersTable.isActive,
    })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username))
    .limit(1);

  const passwordMatches = admin
    ? await bcrypt.compare(parsed.data.password, admin.passwordHash)
    : false;

  if (!admin || !admin.isActive || !passwordMatches) {
    return response.status(401).json({ error: "Invalid admin credentials." });
  }

  const token = await createAdminSession(admin.id);
  setAdminCookie(response, token);

  return response.json(
    AdminAuthLoginResponse.parse({
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
      },
    }),
  );
});

router.post("/auth/logout", async (request, response) => {
  const token = getAdminSessionToken(request);
  if (token) {
    await db
      .delete(adminSessionsTable)
      .where(eq(adminSessionsTable.sessionHash, hashSessionToken(token)));
  }

  clearAdminSessionCookie(response);
  return response.json({ message: "Signed out successfully." });
});

router.get("/auth/me", async (request, response) => {
  const admin = await getAuthenticatedAdmin(request, response);
  return response.json(
    AdminAuthMeResponse.parse({
      authenticated: Boolean(admin),
      admin,
    }),
  );
});

export default router;