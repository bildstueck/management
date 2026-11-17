import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toDateKey, monthLabel } from "@/lib/calendar-dates";

type PostLite = { id: string; scheduledAt: Date | null };

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Quick-glance month view for the workspace overview — a purple dot marks a
// day with a scheduled post, and the whole cell links straight to it. No
// drag-and-drop here; that's what Beiträge → Kalender is for.
export function MiniCalendar({
  slug,
  year,
  monthIndex,
  days,
  posts,
}: {
  slug: string;
  year: number;
  monthIndex: number;
  days: Date[];
  posts: PostLite[];
}) {
  const byDate: Record<string, PostLite[]> = {};
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const key = toDateKey(post.scheduledAt);
    (byDate[key] ??= []).push(post);
  }

  const todayKey = toDateKey(new Date());
  const prevMonth = monthIndex === 0 ? { y: year - 1, m: 12 } : { y: year, m: monthIndex };
  const nextMonth = monthIndex === 11 ? { y: year + 1, m: 1 } : { y: year, m: monthIndex + 2 };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Anstehende Beiträge</h2>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            {monthLabel(year, monthIndex)}
          </span>
          <Button variant="outline" size="sm" render={<Link href={`/w/${slug}`} />}>
            Heute
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            render={<Link href={`/w/${slug}?month=${prevMonth.y}-${String(prevMonth.m).padStart(2, "0")}`} />}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            render={<Link href={`/w/${slug}?month=${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}`} />}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = toDateKey(day);
            const inMonth = day.getMonth() === monthIndex;
            const isToday = dateKey === todayKey;
            const dayPosts = byDate[dateKey] ?? [];

            const cell = (
              <div
                className={`flex h-16 flex-col items-center justify-center gap-1 border-r border-b last:border-r-0 ${
                  inMonth ? "bg-background" : "bg-muted/10"
                } hover:bg-muted/40`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-destructive font-semibold text-white"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {day.getDate()}
                </span>
                <span
                  className={`size-2 rounded-full ${dayPosts.length > 0 ? "bg-primary" : "bg-transparent"}`}
                />
              </div>
            );

            return (
              <Link
                key={dateKey}
                href={
                  dayPosts.length > 0
                    ? `/w/${slug}/posts/${dayPosts[0].id}`
                    : `/w/${slug}/posts/new?date=${dateKey}`
                }
              >
                {cell}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
