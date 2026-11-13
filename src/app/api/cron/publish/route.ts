import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPost } from "@/lib/publish-post";

// Hit on a schedule by .github/workflows/cron.yml (GitHub Actions, free —
// Vercel's own Hobby-plan cron only runs once a day, too coarse for
// "publish at a specific time"). Not behind the Next.js auth proxy (see
// src/proxy.ts's PUBLIC_PATHS) — this route is its own security boundary
// via the Bearer token below, the same pattern as the public /review routes.
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
  });

  const results = [];
  for (const post of due) {
    const outcome = await publishPost(post.id);
    results.push({ postId: post.id, ...outcome });
  }

  return NextResponse.json({ processed: results.length, results });
}
