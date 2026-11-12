"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
      className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 text-xs hover:border-primary"
    >
      {post.channelVariants.slice(0, 3).map((v) => {
        const Icon = PLATFORM_META[v.socialAccount.platform].icon;
        return <Icon key={v.id} className="size-3" />;
      })}
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel(year, monthIndex)}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`?month=${prevMonth.y}-${String(prevMonth.m).padStart(2, "0")}`} />}
          >
            ‹
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`?month=${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}`} />}
          >
            ›
          </Button>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, null)}
        className="flex min-h-14 flex-wrap gap-2 rounded-md border border-dashed p-2"
      >
        {unscheduled.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nicht geplante Entwürfe erscheinen hier — zum Planen auf einen Tag ziehen.
          </p>
        ) : (
          unscheduled.map((post) => (
            <PostChip key={post.id} post={post} slug={slug} onDragStart={setDraggingId} />
          ))
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const inMonth = day.getMonth() === monthIndex;
          const posts = byDate[dateKey] ?? [];
          return (
            <div
              key={dateKey}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dateKey)}
              className={`flex min-h-24 flex-col gap-1 rounded-md border p-1 ${
                inMonth ? "" : "opacity-40"
              } ${dateKey === todayKey ? "border-primary" : ""}`}
            >
              <span className="text-xs text-muted-foreground">{day.getDate()}</span>
              {posts.map((post) => (
                <PostChip key={post.id} post={post} slug={slug} onDragStart={setDraggingId} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
