import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import {
  adminSessionsTable,
  adminUsersTable,
  db,
} from "@workspace/db";
import { hashSessionToken } from "./auth-session";

export { hashSessionToken };

export const ADMIN_SESSION_COOKIE = "rz_admin_session";
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AuthenticatedAdmin = {
  id: string;
  username: string;
  displayName: string;
};

export function getAdminSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));

  if (!sessionCookie) return null;

  try {
    return decodeURIComponent(
      sessionCookie.slice(ADMIN_SESSION_COOKIE.length + 1),
    );
  } catch {
    return null;
  }
}

export function clearAdminSessionCookie(response: Response): void {
  response.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function createAdminSession(adminUserId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(adminSessionsTable).values({
    adminUserId,
    sessionHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
  });
  return token;
}

export function setAdminSessionCookie(
  response: Response,
  token: string,
): void {
  response.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  });
}

export async function getAuthenticatedAdmin(
  request: Request,
  response?: Response,
): Promise<AuthenticatedAdmin | null> {
  const token = getAdminSessionToken(request);
  if (!token) return null;

  const [session] = await db
    .select({
      sessionId: adminSessionsTable.id,
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      displayName: adminUsersTable.displayName,
      expiresAt: adminSessionsTable.expiresAt,
    })
    .from(adminSessionsTable)
    .innerJoin(
      adminUsersTable,
      eq(adminSessionsTable.adminUserId, adminUsersTable.id),
    )
    .where(
      and(
        eq(adminSessionsTable.sessionHash, hashSessionToken(token)),
        eq(adminUsersTable.isActive, true),
        gt(adminSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    if (response) clearAdminSessionCookie(response);
    return null;
  }

  return {
    id: session.id,
    username: session.username,
    displayName: session.displayName,
  };
}