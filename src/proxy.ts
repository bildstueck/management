import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Next.js 16 renamed Middleware to Proxy (same behavior, new file name).
// This only does an optimistic, cookie-based auth check to redirect signed-out
// users to /login. It is NOT the security boundary — every page/action/route
// handler re-verifies the session itself (see the Data Access Layer pattern).

// Public routes: login, NextAuth's own API routes, the client-facing
// magic-link review routes (/review/[token]), and the cron routes GitHub
// Actions calls on a schedule — those check their own Bearer token
// (CRON_SECRET), same "proxy is optimistic, the route is the real check"
// pattern as /review.
const PUBLIC_PATHS = ["/login", "/api/auth", "/review", "/api/cron"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
