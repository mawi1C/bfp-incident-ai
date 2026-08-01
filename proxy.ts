import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

// Gates every page behind a login screen backed by a signed session cookie.
// Still just one shared password for now (see app/login/page.tsx) — good
// enough to stop a stumbled-upon public URL from being wide open, not a
// substitute for real per-officer accounts. Worth upgrading later.
//
// NOTE: Next.js 16 renamed the "middleware" file convention to "proxy" —
// a leftover middleware.ts is silently ignored (no error, no enforcement),
// so this MUST be named proxy.ts with an exported `proxy` function, not
// middleware.ts / `middleware`, or none of this runs at all.

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.SESSION_SECRET;

  // If not configured, don't lock everyone out during local dev — just
  // pass through. Make sure this IS set before deploying anywhere public.
  if (!sessionSecret) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionToken(token, sessionSecret);

  if (isValid) {
    return NextResponse.next();
  }

  // API routes get a plain 401 (a redirect would break fetch() callers).
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};