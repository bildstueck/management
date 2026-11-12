import "server-only";

// Meta Graph API — Facebook Login for Business flow (Pages + their linked
// Instagram Business/Creator accounts). Graph API version per Meta's
// changelog (https://developers.facebook.com/docs/graph-api/changelog) as of
// this writing; bump GRAPH_VERSION when Meta deprecates it.
const GRAPH_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

function getAppCredentials() {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET must be set.");
  }
  return { clientId, clientSecret };
}

export function buildMetaAuthorizeUrl(state: string, redirectUri: string): string {
  const { clientId } = getAppCredentials();
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

type MetaTokenResponse = { access_token: string; token_type: string; expires_in?: number };

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Meta Graph API error (${path}): ${JSON.stringify(body.error ?? body)}`);
  }
  return body as T;
}

export async function exchangeMetaCodeForToken(
  code: string,
  redirectUri: string,
): Promise<MetaTokenResponse> {
  const { clientId, clientSecret } = getAppCredentials();
  return graphGet<MetaTokenResponse>("/oauth/access_token", {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
}

// Exchanges a short-lived user token for a long-lived one (~60 days).
// Page access tokens fetched afterwards using this long-lived user token
// inherit a non-expiring/long lifetime from it.
export async function exchangeMetaForLongLivedToken(
  shortLivedToken: string,
): Promise<MetaTokenResponse> {
  const { clientId, clientSecret } = getAppCredentials();
  return graphGet<MetaTokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });
}

export type MetaPageWithInstagram = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
};

type MetaPagesResponse = {
  data: MetaPageWithInstagram[];
  paging?: { next?: string };
};

// Lists the Facebook Pages the user manages, with their linked Instagram
// Business/Creator account (if any). Follows pagination defensively, but
// caps at a handful of pages — this is a connect-time call, not a sync job.
export async function listMetaPagesWithInstagram(
  longLivedUserToken: string,
): Promise<MetaPageWithInstagram[]> {
  const pages: MetaPageWithInstagram[] = [];
  let url: string | undefined = new URL(`${GRAPH_BASE}/me/accounts`).toString();
  const initialParams = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
    access_token: longLivedUserToken,
  });
  url = `${url}?${initialParams.toString()}`;

  for (let page = 0; url && page < 10; page++) {
    const res = await fetch(url);
    const body = (await res.json()) as MetaPagesResponse & { error?: unknown };
    if (!res.ok) {
      throw new Error(`Meta Graph API error (/me/accounts): ${JSON.stringify(body.error ?? body)}`);
    }
    pages.push(...body.data);
    url = body.paging?.next;
  }

  return pages;
}
