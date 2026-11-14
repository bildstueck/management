import "server-only";
import { GRAPH_VERSION, GRAPH_BASE } from "@/lib/meta-graph";

// Meta Graph API — Facebook Login for Business, used for two separate
// Configurations under the same Meta app: one for Facebook Pages
// (META_CONFIG_ID), one for Instagram "Unified Login"
// (META_INSTAGRAM_CONFIG_ID). Meta retired the old standalone "Instagram
// API with Instagram Login" (api.instagram.com) for new apps in favor of
// Unified Login, which reuses this exact same facebook.com/dialog/oauth +
// graph.facebook.com/oauth/access_token flow — just a different
// Configuration, and no Facebook Page required for the Instagram one.

// Reference only — these are the permissions each Configuration must
// include; not sent directly as a `scope` param (see
// buildMetaAuthorizeUrl below).
export const META_PAGE_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"].join(
  ",",
);
export const META_INSTAGRAM_SCOPES = ["instagram_basic", "instagram_content_publish"].join(",");

function getAppCredentials() {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET must be set.");
  }
  return { clientId, clientSecret };
}

function getConfigId(envVar: "META_CONFIG_ID" | "META_INSTAGRAM_CONFIG_ID") {
  const configId = process.env[envVar];
  if (!configId) throw new Error(`${envVar} must be set.`);
  return configId;
}

function buildAuthorizeUrl(state: string, redirectUri: string, configId: string): string {
  const { clientId } = getAppCredentials();
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export function buildMetaAuthorizeUrl(state: string, redirectUri: string): string {
  return buildAuthorizeUrl(state, redirectUri, getConfigId("META_CONFIG_ID"));
}

export function buildInstagramAuthorizeUrl(state: string, redirectUri: string): string {
  return buildAuthorizeUrl(state, redirectUri, getConfigId("META_INSTAGRAM_CONFIG_ID"));
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

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
};

type MetaPagesResponse = {
  data: MetaPage[];
  paging?: { next?: string };
};

// Lists the Facebook Pages the user manages. Instagram connects separately
// via src/lib/oauth/instagram.ts (Instagram API with Instagram Login), so
// this no longer looks up a Page's linked Instagram Business account.
// Follows pagination defensively, but caps at a handful of pages — this is
// a connect-time call, not a sync job.
export async function listMetaPages(longLivedUserToken: string): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  let url: string | undefined = new URL(`${GRAPH_BASE}/me/accounts`).toString();
  const initialParams = new URLSearchParams({
    fields: "id,name,access_token",
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

export type AssignedInstagramAccount = { id: string; username: string };

// Instagram Unified Login: lists the Instagram professional accounts the
// Business Integration System User token was granted — no Facebook Page
// involved. See https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication.
export async function listAssignedInstagramAccounts(
  systemUserToken: string,
): Promise<AssignedInstagramAccount[]> {
  const url = new URL(`${GRAPH_BASE}/me/assigned_instagram_accounts`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", systemUserToken);

  const res = await fetch(url.toString());
  const body = (await res.json()) as { data: AssignedInstagramAccount[]; error?: unknown };
  if (!res.ok) {
    throw new Error(
      `Meta Graph API error (/me/assigned_instagram_accounts): ${JSON.stringify(body.error ?? body)}`,
    );
  }
  return body.data;
}

export async function fetchInstagramProfilePicture(
  instagramAccountId: string,
  systemUserToken: string,
): Promise<string | null> {
  const url = new URL(`${GRAPH_BASE}/${instagramAccountId}`);
  url.searchParams.set("fields", "profile_picture_url");
  url.searchParams.set("access_token", systemUserToken);

  const res = await fetch(url.toString());
  const body = (await res.json()) as { profile_picture_url?: string; error?: unknown };
  if (!res.ok) return null;
  return body.profile_picture_url ?? null;
}
