"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { Platform } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PLATFORM_META } from "@/components/platform-meta";
import { toDateKey, monthLabel } from "@/lib/calendar-dates";
import { reschedulePostAction } from "@/app/(app)/w/[slug]/posts/actions";

type PostLite = {
  id: string;
  masterText: string | null;
  scheduledAt: Date | null;
  channelVariants: { id: string; socialAccount: { platform: Platform } }[];
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MAX_VISIBLE_PER_DAY = 2;

function PostChip({
  post,
  slug,
  onDragStart,
}: {
  post: PostLite;
  slug: string;
  onDragStart: (postId: string) => void;
}) {
  return (
    <Link
      href={`/w/${slug}/posts/${post.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", post.id);
        onDragStart(post.id);
      }}
      className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 text-[11px] leading-tight hover:border-primary hover:shadow-sm"
    >
      <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
        {post.channelVariants.slice(0, 3).map((v) => {
          const Icon = PLATFORM_META[v.socialAccount.platform].icon;
          return <Icon key={v.id} className="size-3" />;
        })}
      </span>
      <span className="truncate">{post.masterText || "(kein Text)"}</span>
    </Link>
  );
}

export function PostCalendar({
  slug,
  year,
  monthIndex,
  days,
  scheduledPosts,
  unscheduledPosts,
}: {
  slug: string;
  year: number;
  monthIndex: number;
  days: Date[];
  scheduledPosts: PostLite[];
  unscheduledPosts: PostLite[];
}) {
  const [byDate, setByDate] = useState<Record<string, PostLite[]>>(() => {
    const map: Record<string, PostLite[]> = {};
    for (const post of scheduledPosts) {
      if (!post.scheduledAt) continue;
      const key = toDateKey(post.scheduledAt);
      map[key] = [...(map[key] ?? []), post];
    }
    return map;
  });
  const [unscheduled, setUnscheduled] = useState(unscheduledPosts);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  function movePost(postId: string, toDateKeyValue: string | null) {
    let moved: PostLite | undefined;

    setByDate((prev) => {
      const next: Record<string, PostLite[]> = {};
      for (const [key, posts] of Object.entries(prev)) {
        const kept = posts.filter((p) => {
          if (p.id === postId) {
            moved = p;
            return false;
          }
          return true;
        });
        if (kept.length > 0) next[key] = kept;
      }
      return next;
    });

    setUnscheduled((prev) => {
      const kept = prev.filter((p) => {
        if (p.id === postId) {
          moved = moved ?? p;
          return false;
        }
        return true;
      });
      return kept;
    });

    if (!moved) return;

    if (toDateKeyValue) {
      setByDate((prev) => ({ ...prev, [toDateKeyValue]: [...(prev[toDateKeyValue] ?? []), moved!] }));
    } else {
      setUnscheduled((prev) => [moved!, ...prev]);
    }

    reschedulePostAction(slug, postId, toDateKeyValue).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Verschieben fehlgeschlagen.");
    });
  }

  function handleDrop(e: React.DragEvent, dateKey: string | null) {
    e.preventDefault();
    const postId = e.dataTransfer.getData("text/plain") || draggingId;
    if (postId) movePost(postId, dateKey);
    setDraggingId(null);
  }

  const prevMonth = monthIndex === 0 ? { y: year - 1, m: 12 } : { y: year, m: monthIndex };
  const nextMonth = monthIndex === 11 ? { y: year + 1, m: 1 } : { y: year, m: monthIndex + 2 };
  const todayKey = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel(year, monthIndex)}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" render={<Link href="?" />}>
            Heute
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            render={<Link href={`?month=${prevMonth.y}-${String(prevMonth.m).padStart(2, "0")}`} />}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            render={<Link href={`?month=${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}`} />}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, null)}
        className="flex min-h-16 flex-col gap-2 rounded-lg border border-dashed bg-muted/20 p-3"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Inbox className="size-3.5" /> Nicht geplant
        </span>
        {unscheduled.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">
            Entwürfe ohne Datum landen hier — auf einen Tag ziehen, um sie zu planen.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((post) => (
              <PostChip key={post.id} post={post} slug={slug} onDragStart={setDraggingId} />
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dateKey = toDateKey(day);
            const inMonth = day.getMonth() === monthIndex;
            const isToday = dateKey === todayKey;
            const posts = byDate[dateKey] ?? [];
            const expanded = expandedDay === dateKey;
            const visiblePosts = expanded ? posts : posts.slice(0, MAX_VISIBLE_PER_DAY);
            const hiddenCount = posts.length - visiblePosts.length;

            return (
              <div
                key={dateKey}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, dateKey)}
                className={`flex min-h-24 flex-col gap-1 border-r border-b p-1.5 last:border-r-0 ${
                  i % 7 === 6 ? "border-r-0" : ""
                } ${inMonth ? "bg-background" : "bg-muted/10"}`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-col gap-1">
                  {visiblePosts.map((post) => (
                    <PostChip key={post.id} post={post} slug={slug} onDragStart={setDraggingId} />
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(dateKey)}
                      className="text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      +{hiddenCount} mehr
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
