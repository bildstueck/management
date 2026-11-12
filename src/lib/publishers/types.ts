// Shared types for the per-platform publishers (src/lib/publishers/*).
// A publisher takes one channel's resolved content and talks to that
// platform's API directly — it doesn't know about Prisma/the DB; the
// worker (src/workers/publish.ts) is what persists the result.

export type PublishMedia = { type: "IMAGE" | "VIDEO"; url: string };

export type PublishInput = {
  accessToken: string;
  externalAccountId: string; // Page ID / IG Business Account ID / LinkedIn member or "org:{id}"
  text: string;
  media: PublishMedia[];
};

export type PublishResult =
  | { success: true; externalPostId: string }
  | { success: false; error: string };
