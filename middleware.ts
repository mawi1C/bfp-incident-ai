import { NextRequest, NextResponse } from "next/server";

// Lightweight access control: a single shared username/password for the
// whole app, enforced via standard HTTP Basic Auth (the browser shows its
// own native login prompt — no custom login page/session code needed).
//
// This is intentionally minimal — good enough to stop a stumbled-upon public
// URL from being open to anyone, not a substitute for real per-officer
// accounts with individual audit trails. Worth upgrading to proper auth
// (e.g. Supabase Auth) once more than a handful of people use this.

export function middleware(req: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASSWORD;

  // If not configured, don't accidentally lock everyone out in local dev —
  // just pass through. Make sure these ARE set before deploying anywhere
  // public.
  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    if (user === expectedUser && pass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BFP-NCR Incident Dashboard"' },
  });
}

// Protect every route except Next.js internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};