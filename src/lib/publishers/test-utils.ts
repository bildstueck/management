import { vi } from "vitest";

// Shared fetch-mocking helper for the publisher tests. Not a test file
// itself (no .test.ts suffix), so vitest doesn't try to run it directly.
export function fakeResponse(
  body: unknown,
  opts: { ok?: boolean; status?: number; headers?: Record<string, string> } = {},
) {
  const headers = opts.headers ?? {};
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(8),
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? headers[key] ?? null },
  };
}

export function mockFetchSequence(responses: unknown[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
