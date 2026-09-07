import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Next.js 16 renamed Middleware to Proxy; this file replaces middleware.ts.
// It runs on every request and gates the whole app behind the /login page,
// except /login itself and static assets.

const PUBLIC_PATHS = ["/login"];

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return false;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  try {
    await jwtVerify(cookie, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const authed = await hasValidSession(req);

  if (!isPublic && !authed) {
    const loginUrl = new URL("/login", req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && authed) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip proxy for API routes (they check auth themselves), Next internals,
  // and common static file extensions.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
