import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// Lets a password-protected share link stay "unlocked" for a visitor across
// requests without any login — a short signed cookie scoped to that one
// share link, not a session for the app itself.

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function unlockCookieName(shareLinkId: string) {
  return `review_unlock_${shareLinkId}`;
}

export async function markShareLinkUnlocked(shareLinkId: string) {
  const token = `${shareLinkId}.${sign(shareLinkId)}`;
  const store = await cookies();
  store.set(unlockCookieName(shareLinkId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/review",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function isShareLinkUnlocked(shareLinkId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(unlockCookieName(shareLinkId))?.value;
  if (!token) return false;

  const [id, signature] = token.split(".");
  if (id !== shareLinkId) return false;

  const expected = sign(shareLinkId);
  const a = Buffer.from(signature ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const REVIEWER_NAME_COOKIE = "reviewer_name";

export async function getReviewerName(): Promise<string> {
  const store = await cookies();
  return store.get(REVIEWER_NAME_COOKIE)?.value ?? "";
}

export async function setReviewerName(name: string) {
  const store = await cookies();
  store.set(REVIEWER_NAME_COOKIE, name, {
    httpOnly: false, // read back client-side to prefill the name field
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/review",
    maxAge: 60 * 60 * 24 * 30,
  });
}
