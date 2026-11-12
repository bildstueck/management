// Shared Meta Graph API constants — used by both the OAuth connect flow
// (src/lib/oauth/meta.ts) and the Facebook/Instagram publishers
// (src/lib/publishers/). Bump GRAPH_VERSION when Meta deprecates it; see
// https://developers.facebook.com/docs/graph-api/changelog.
export const GRAPH_VERSION = "v26.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
