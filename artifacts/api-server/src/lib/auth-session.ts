import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import {
  authSessionsTable,
  customersTable,
  db,
} from "@workspace/db";

export const SESSION_COOKIE = "rz_session";

export type AuthenticatedCustomer = {
  id: string;
  fullName: string;
  email: string;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (!sessionCookie) return null;

  try {
    return decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function getAuthenticatedCustomer(
  request: Request,
  response?: Response,
): Promise<AuthenticatedCustomer | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const [session] = await db
    .select({
      sessionId: authSessionsTable.id,
      customerId: customersTable.id,
      fullName: customersTable.fullName,
      email: customersTable.email,
      expiresAt: authSessionsTable.expiresAt,
    })
    .from(authSessionsTable)
    .innerJoin(
      customersTable,
      eq(authSessionsTable.customerId, customersTable.id),
    )
    .where(eq(authSessionsTable.sessionHash, hashSessionToken(token)))
    .limit(1);

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await db
        .delete(authSessionsTable)
        .where(eq(authSessionsTable.id, session.sessionId));
    }
    if (response) clearSessionCookie(response);
    return null;
  }

  return {
    id: session.customerId,
    fullName: session.fullName,
    email: session.email,
  };
}