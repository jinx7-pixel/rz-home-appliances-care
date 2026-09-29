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
import { isRateLimited } from "../lib/rate-limit";

const router = Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export function isInitialAdminBootstrapEligible(
  username: string,
  submittedPassword: string,
  bootstrapPassword: string | undefined,
  adminAlreadyInitialized: boolean,
): boolean {
  return (
    !adminAlreadyInitialized &&
    username === "admin" &&
    Boolean(bootstrapPassword) &&
    submittedPassword === bootstrapPassword
  );
}

router.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

// ADMIN_PASSWORD is only accepted while the admin user table is uninitialized.
// Existing accounts are always authenticated against their stored bcrypt hash.
function clientKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function setAdminCookie(response: Response, token: string): void {
  setAdminSessionCookie(response, token);
}

router.post("/auth/login", async (request, response) => {
  if (
    await isRateLimited({
      scope: "admin-login",
      clientKey: clientKey(request),
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
    })
  ) {
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
  let [admin] = await db
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

  let passwordMatches = admin
    ? await bcrypt.compare(parsed.data.password, admin.passwordHash)
    : false;

  const bootstrapPassword = process.env.ADMIN_PASSWORD;
  if (
    username === "admin" &&
    bootstrapPassword &&
    parsed.data.password === bootstrapPassword &&
    !admin
  ) {
    const [initializedAdmin] = await db
      .select({ id: adminUsersTable.id })
      .from(adminUsersTable)
      .limit(1);

    if (
      isInitialAdminBootstrapEligible(
        username,
        parsed.data.password,
        bootstrapPassword,
        Boolean(initializedAdmin),
      )
    ) {
      const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
      await db.insert(adminUsersTable).values({
        username: "admin",
        displayName: "RZ Administrator",
        passwordHash,
        isActive: true,
      }).onConflictDoNothing({ target: adminUsersTable.username });

      // Another first-login request may have won the insert race. Only accept
      // the password if it matches the row that actually exists.
      [admin] = await db
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
      passwordMatches = admin
        ? await bcrypt.compare(parsed.data.password, admin.passwordHash)
        : false;
    }
  }

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