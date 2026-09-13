import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Next.js 16 renamed Middleware to Proxy; this file replaces middleware.ts.
// It runs on every request and gates the whole app behind the /login page,
// except /login itself and static assets.

// /setup is public too — it's the first-run "create the initial account"
// page. It's a no-op (redirects to /login) once any User already exists;
// that check happens in the page itself, not here, to keep this file
// free of DB calls.
const PUBLIC_PATHS = ["/login", "/setup"];

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return false;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    // Pre-multi-user cookies ({authenticated: true}, no userId) are still
    // a cryptographically valid JWT under the same secret, but every page
    // now treats "no userId" as logged-out — if this only checked the
    // signature, that mismatch produced a redirect loop (page: no userId
    // -> /login; proxy: valid signature -> bounce back to /).
    return typeof payload.userId === "string";
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isPublic && !(await hasValidSession(req))) {
    const loginUrl = new URL("/login", req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  // Deliberately NOT redirecting an already-"authed" visitor away from
  // /login here. hasValidSession() only checks the cookie's signature/
  // shape (by design — this file stays DB-free to remain Edge-
  // compatible), but /login's own getSessionUserId() call additionally
  // confirms the user still exists in the DB. A cookie that's shape-
  // valid but for a since-deleted/reset user would otherwise bounce
  // "/" -> "/login" (page: not a real user -> back to login) while this
  // proxy bounces "/login" -> "/" (shape-valid -> away from login),
  // an infinite loop. Only /login can safely make that call, since it's
  // the one place with the DB-verified answer.
  return NextResponse.next();
}

export const config = {
  // Skip proxy for API routes (they check auth themselves), Next internals,
  // and common static file extensions.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
