import { GRAPH_BASE } from "@/lib/meta-graph";

// Tiny shared Graph API client for the Facebook/Instagram publishers.
// `base` defaults to the Facebook Graph API host; the Instagram publisher
// passes IG_GRAPH_BASE (graph.instagram.com) instead — see
// src/lib/instagram-graph.ts.
export async function graphPost(
  path: string,
  body: Record<string, string | boolean>,
  base: string = GRAPH_BASE,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) params.set(key, String(value));

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return res.json();
}

export async function graphGet(
  path: string,
  params: Record<string, string>,
  base: string = GRAPH_BASE,
): Promise<Record<string, unknown>> {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  return res.json();
}

export function graphError(body: Record<string, unknown>): string | null {
  const error = body.error as { message?: string } | undefined;
  return error?.message ?? null;
}
