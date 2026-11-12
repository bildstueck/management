import { GRAPH_BASE } from "@/lib/meta-graph";

// Tiny shared Graph API client for the Facebook/Instagram publishers.
export async function graphPost(
  path: string,
  body: Record<string, string | boolean>,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) params.set(key, String(value));

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return res.json();
}

export async function graphGet(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  return res.json();
}

export function graphError(body: Record<string, unknown>): string | null {
  const error = body.error as { message?: string } | undefined;
  return error?.message ?? null;
}
