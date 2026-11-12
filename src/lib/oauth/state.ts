import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Signed, stateless OAuth "state" parameter: carries which workspace/user
// initiated the connect flow so the callback can verify it (CSRF + replay
// protection) without needing a server-side session table.

export type OAuthState = {
  workspaceSlug: string;
  userId: string;
  nonce: string;
  issuedAt: number;
};

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes to complete the OAuth dance

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createOAuthState(workspaceSlug: string, userId: string): string {
  const state: OAuthState = {
    workspaceSlug,
    userId,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyOAuthState(token: string): OAuthState | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (Date.now() - state.issuedAt > MAX_AGE_MS) return null;
    return state;
  } catch {
    return null;
  }
}
