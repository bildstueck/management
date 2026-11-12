import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listPostsInRange, listUnscheduledPosts } from "@/lib/posts";
import { getMonthGrid } from "@/lib/calendar-dates";
import { PostCalendar } from "@/components/post-calendar";

export default async function CalendarPage({
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
    <PostCalendar
      key={`${year}-${monthIndex}`}
      slug={slug}
      year={year}
      monthIndex={monthIndex}
      days={grid.days}
      scheduledPosts={scheduled}
      unscheduledPosts={unscheduled}
    />
  );
}
