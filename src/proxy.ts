import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Next.js 16 renamed Middleware to Proxy (same behavior, new file name).
// This only does an optimistic, cookie-based auth check to redirect signed-out
// users to /login. It is NOT the security boundary — every page/action/route
// handler re-verifies the session itself (see the Data Access Layer pattern).

// Public routes: login, NextAuth's own API routes, and the client-facing
// magic-link review routes added in Phase 4 (/review/[token]).
const PUBLIC_PATHS = ["/login", "/api/auth", "/review"];

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
