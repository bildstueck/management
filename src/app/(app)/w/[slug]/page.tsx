import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listPostsInRange, listUnscheduledPosts } from "@/lib/posts";
import { getMonthGrid } from "@/lib/calendar-dates";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostCalendar } from "@/components/post-calendar";

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
  const [scheduled, unscheduled] = await Promise.all([
    listPostsInRange(workspace.id, grid.gridStart, grid.gridEnd),
    listUnscheduledPosts(workspace.id),
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Link href={`/w/${workspace.slug}/posts`}>
          <Card className="gap-1 py-3 transition-colors hover:border-primary">
            <CardHeader className="gap-0 px-4">
              <CardTitle className="text-sm">Beiträge</CardTitle>
              <CardDescription className="text-xs">Feed & Instagram-Grid.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        {workspace.role === "OWNER" && (
          <Link href={`/w/${workspace.slug}/share`}>
            <Card className="gap-1 py-3 transition-colors hover:border-primary">
              <CardHeader className="gap-0 px-4">
                <CardTitle className="text-sm">Freigabe</CardTitle>
                <CardDescription className="text-xs">Links für Kunden-Freigaben.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
        <Link href={`/w/${workspace.slug}/accounts`}>
          <Card className="gap-1 py-3 transition-colors hover:border-primary">
            <CardHeader className="gap-0 px-4">
              <CardTitle className="text-sm">Social Accounts</CardTitle>
              <CardDescription className="text-xs">Facebook, Instagram, LinkedIn.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={`/w/${workspace.slug}/members`}>
          <Card className="gap-1 py-3 transition-colors hover:border-primary">
            <CardHeader className="gap-0 px-4">
              <CardTitle className="text-sm">Mitglieder</CardTitle>
              <CardDescription className="text-xs">Team-Zugriff verwalten.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <PostCalendar
        key={`${year}-${monthIndex}`}
        slug={slug}
        year={year}
        monthIndex={monthIndex}
        days={grid.days}
        scheduledPosts={scheduled}
        unscheduledPosts={unscheduled}
      />
    </div>
  );
}
