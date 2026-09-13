import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

// Multi-user app: the session identifies which User is logged in, so
// every data query can be scoped to them.
type SessionPayload = {
  userId: string;
  expiresAt: number;
};

const COOKIE_NAME = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to your .env file (see .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(getSecretKey());
}

async function decrypt(session: string | undefined) {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session = await encrypt({ userId, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Reads and verifies the session cookie for the current request. */
export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  return decrypt(raw);
}

export async function isAuthenticated() {
  const session = await getSession();
  return typeof session?.userId === "string";
}

/** The logged-in user's id, or null if there's no valid session. Every
 *  data-access function in lib/market.ts, lib/portfolio.ts, etc. takes
 *  this as a scoping parameter — never trust a client-supplied userId.
 *
 *  Also confirms the id still exists in the DB. A cookie can be a
 *  cryptographically valid, unexpired JWT for a user that no longer
 *  exists — e.g. after a full DB reset (the SQLite→Postgres migration
 *  did this) or an admin deleting that account — since proxy.ts only
 *  checks the signature/shape, not DB state. Without this check, that
 *  stale-but-valid session sails past every page's `if (!userId)
 *  redirect("/login")` guard and only fails later as a raw Prisma
 *  foreign-key error (e.g. creating a WatchlistItem for a userId with
 *  no matching User row). Treating it as logged-out here instead routes
 *  it through the normal login flow. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const exists = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  });
  return exists ? session.userId : null;
}
