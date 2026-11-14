import "server-only";
import { IG_GRAPH_BASE } from "@/lib/instagram-graph";

// Instagram API with Instagram Login — connects an Instagram professional
// (Business/Creator) account directly, with no Facebook Page required. This
// is a separate product/host from Facebook Login for Business
// (src/lib/oauth/meta.ts): its own app credentials, its own OAuth host
// (instagram.com, not facebook.com), and its own token exchange.
// See https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login.

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",");

function getAppCredentials() {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET must be set.");
  }
  return { clientId, clientSecret };
}

export function buildInstagramAuthorizeUrl(state: string, redirectUri: string): string {
  const { clientId } = getAppCredentials();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

type ShortLivedTokenResponse = {
  data: [{ access_token: string; user_id: string; permissions: string }];
};

// The authorization code's redirect sometimes has a trailing "#_" fragment
// that isn't part of the code itself.
function cleanCode(code: string): string {
  return code.replace(/#_$/, "");
}

export async function exchangeInstagramCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; userId: string }> {
  const { clientId, clientSecret } = getAppCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: cleanCode(code),
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Instagram token exchange failed: ${JSON.stringify(json.error_message ?? json)}`);
  }
  const data = (json as ShortLivedTokenResponse).data?.[0];
  if (!data) throw new Error(`Instagram token exchange failed: unexpected response ${JSON.stringify(json)}`);
  return { accessToken: data.access_token, userId: data.user_id };
}

type LongLivedTokenResponse = { access_token: string; token_type: string; expires_in: number };

export async function exchangeInstagramForLongLivedToken(
  shortLivedToken: string,
): Promise<LongLivedTokenResponse> {
  const { clientSecret } = getAppCredentials();
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Instagram long-lived token exchange failed: ${JSON.stringify(json.error ?? json)}`);
  }
  return json as LongLivedTokenResponse;
}

// A long-lived token can be refreshed (resetting its ~60-day expiry) once
// it's at least 24h old and hasn't expired yet — used by the daily
// token-refresh cron, same pattern as LinkedIn's refresh.
export async function refreshInstagramLongLivedToken(
  longLivedToken: string,
): Promise<LongLivedTokenResponse> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Instagram token refresh failed: ${JSON.stringify(json.error ?? json)}`);
  }
  return json as LongLivedTokenResponse;
}

export type InstagramProfile = { id: string; username: string; profile_picture_url?: string };

export async function fetchInstagramProfile(
  userId: string,
  accessToken: string,
): Promise<InstagramProfile> {
  const url = new URL(`${IG_GRAPH_BASE}/${userId}`);
  url.searchParams.set("fields", "id,username,profile_picture_url");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Instagram profile fetch failed: ${JSON.stringify(json.error ?? json)}`);
  }
  return json as InstagramProfile;
}
