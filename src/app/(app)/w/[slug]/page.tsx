import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import {
  listPostsByStatus,
  listRecentClientActivity,
  listPostsInRange,
} from "@/lib/posts";
import { getMonthGrid } from "@/lib/calendar-dates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { MiniCalendar } from "@/components/mini-calendar";

const relativeFormatter = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

function relativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return relativeFormatter.format(diffDay, "day");
}

function PostList({
  slug,
  posts,
  emptyLabel,
}: {
  slug: string;
  posts: { id: string; masterText: string | null }[];
  emptyLabel: string;
}) {
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/w/${slug}/posts/${post.id}`}
          className="rounded-md border px-3 py-2 text-sm hover:border-primary"
        >
          <p className="line-clamp-2">
            {post.masterText || <span className="text-muted-foreground">(kein Text)</span>}
          </p>
        </Link>
      ))}
    </div>
  );
}

export default async function WorkspaceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const { month } = await searchParams;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);

  const now = new Date();
  const [yearStr, monthStr] = (
    month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  ).split("-");
  const year = Number(yearStr) || now.getFullYear();
  const monthIndex = (Number(monthStr) || now.getMonth() + 1) - 1;
  const grid = getMonthGrid(year, monthIndex);

  const [pending, approved, scheduled, activity] = await Promise.all([
    listPostsByStatus(workspace.id, ["PENDING_APPROVAL"]),
    listPostsByStatus(workspace.id, ["APPROVED"]),
    listPostsInRange(workspace.id, grid.gridStart, grid.gridEnd),
    listRecentClientActivity(workspace.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          {workspace.name}
          <Badge variant="secondary">{workspace.role === "OWNER" ? "Owner" : "Editor"}</Badge>
        </h1>
        <p className="text-muted-foreground">
          Beiträge planen, von Kunden freigeben lassen und automatisch veröffentlichen.
        </p>
      </div>

      {activity.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Letzte Rückmeldungen</h2>
            {activity.map((event) => {
              const approvedEvent = event.toStatus === "APPROVED";
              return (
                <Link
                  key={event.id}
                  href={`/w/${slug}/posts/${event.postId}`}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  {approvedEvent ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  )}
                  <span className="flex-1">
                    <span className="font-medium">{event.actorName ?? "Kunde"}</span>{" "}
                    {approvedEvent ? "hat freigegeben: " : "hat abgelehnt: "}
                    <span className="text-muted-foreground">
                      {event.post.masterText?.slice(0, 60) || "(kein Text)"}
                    </span>
                    {!approvedEvent && event.note && (
                      <span className="block text-xs text-amber-600">
                        {event.note.replace(/^Abgelehnt:\s*/, "")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(event.createdAt)}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Wartet auf Freigabe ({pending.length})
            </h2>
            <PostList slug={slug} posts={pending} emptyLabel="Nichts wartet gerade auf Freigabe." />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Freigegeben ({approved.length})
            </h2>
            <PostList
              slug={slug}
              posts={approved}
              emptyLabel="Nichts freigegeben, das noch terminiert werden muss."
            />
          </CardContent>
        </Card>
      </div>

      <MiniCalendar
        key={`${year}-${monthIndex}`}
        slug={slug}
        year={year}
        monthIndex={monthIndex}
        days={grid.days}
        posts={scheduled}
      />
    </div>
  );
}
