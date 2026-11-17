import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toDateKey, monthLabel } from "@/lib/calendar-dates";

type PostLite = { id: string; scheduledAt: Date | null };

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Full-month overview for the client — every reviewable post with a date,
// past or upcoming, one dot per day. Clicking a day jumps to that post's
// card further down the same page (no separate detail route for clients).
export function ReviewCalendar({
  token,
  year,
  monthIndex,
  days,
  posts,
}: {
  token: string;
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
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{monthLabel(year, monthIndex)}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" render={<Link href={`/review/${token}`} />}>
            Heute
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            render={
              <Link href={`/review/${token}?month=${prevMonth.y}-${String(prevMonth.m).padStart(2, "0")}`} />
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            render={
              <Link href={`/review/${token}?month=${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}`} />
            }
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
              className="py-1 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
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
                className={`flex h-11 flex-col items-center justify-center gap-0.5 border-r border-b last:border-r-0 ${
                  inMonth ? "bg-background" : "bg-muted/10"
                } ${dayPosts.length > 0 ? "hover:bg-muted/40" : ""}`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-xs ${
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
                  className={`size-1.5 rounded-full ${dayPosts.length > 0 ? "bg-primary" : "bg-transparent"}`}
                />
              </div>
            );

            return dayPosts.length > 0 ? (
              <a key={dateKey} href={`#post-${dayPosts[0].id}`}>
                {cell}
              </a>
            ) : (
              <div key={dateKey}>{cell}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
