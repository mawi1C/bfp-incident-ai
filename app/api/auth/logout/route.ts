import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // status 303 ("See Other") explicitly tells the browser to follow this
  // redirect with a GET request, regardless of the original method. The
  // default (307) instead preserves the original POST, which would then
  // hit /login — a page route with no POST handler — causing a 405.
  const response = NextResponse.redirect(new URL("/login", req.url), 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}