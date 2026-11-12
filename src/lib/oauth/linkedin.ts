import "server-only";

// LinkedIn OAuth2 + OpenID Connect. Endpoints per LinkedIn's discovery
// document (https://www.linkedin.com/oauth/.well-known/openid-configuration).
const AUTHORIZATION_ENDPOINT = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";
const ORGANIZATION_ACLS_ENDPOINT = "https://api.linkedin.com/v2/organizationAcls";

// Company Page scopes (r_organization_admin, w_organization_social, ...)
// require LinkedIn's Community Management API product approval. Requesting
// an unapproved scope makes the *whole* authorization request fail, so these
// are opt-in via env var once that approval comes through (see README).
const BASE_SCOPES = ["openid", "profile", "email", "w_member_social"];
const ORGANIZATION_SCOPES = ["r_organization_admin", "w_organization_social"];

export function getLinkedInScopes(): string[] {
  return process.env.LINKEDIN_ORGANIZATION_SCOPES_ENABLED === "true"
    ? [...BASE_SCOPES, ...ORGANIZATION_SCOPES]
    : BASE_SCOPES;
}

function getAppCredentials() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET must be set.");
  }
  return { clientId, clientSecret };
}

export function buildLinkedInAuthorizeUrl(state: string, redirectUri: string): string {
  const { clientId } = getAppCredentials();
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", getLinkedInScopes().join(" "));
  return url.toString();
}

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
};

async function postForm<T>(url: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`LinkedIn API error (${url}): ${JSON.stringify(body)}`);
  }
  return body as T;
}

export async function exchangeLinkedInCodeForToken(
  code: string,
  redirectUri: string,
): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = getAppCredentials();
  return postForm<LinkedInTokenResponse>(TOKEN_ENDPOINT, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

export async function refreshLinkedInAccessToken(
  refreshToken: string,
): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = getAppCredentials();
  return postForm<LinkedInTokenResponse>(TOKEN_ENDPOINT, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

export type LinkedInUserInfo = {
  sub: string;
  name: string;
  picture?: string;
  email?: string;
};

export async function fetchLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`LinkedIn API error (/v2/userinfo): ${JSON.stringify(body)}`);
  }
  return body as LinkedInUserInfo;
}

export type LinkedInOrganization = { id: string; name: string; logoUrl?: string };

// Requires the Community Management API (r_organization_admin). Returns an
// empty list rather than throwing if that product isn't approved yet, so the
// connect flow still works for personal-profile-only posting.
export async function fetchLinkedInAdminOrganizations(
  accessToken: string,
): Promise<LinkedInOrganization[]> {
  const url = new URL(ORGANIZATION_ACLS_ENDPOINT);
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("role", "ADMINISTRATOR");
  url.searchParams.set("projection", "(elements*(organization~(id,localizedName)))");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];

    const body = (await res.json()) as {
      elements?: { "organization~"?: { id: string; localizedName: string } }[];
    };
    return (body.elements ?? [])
      .map((el) => el["organization~"])
      .filter((org): org is { id: string; localizedName: string } => !!org)
      .map((org) => ({ id: org.id, name: org.localizedName }));
  } catch {
    return [];
  }
}
