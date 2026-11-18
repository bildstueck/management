"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Rows3, Images } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReviewNav({
  token,
  variant = "sidebar",
  hasPending = false,
}: {
  token: string;
  variant?: "sidebar" | "mobile";
  hasPending?: boolean;
}) {
  const pathname = usePathname();
  const base = `/review/${token}`;
  const tabs = [
    { href: base, label: "Übersicht", icon: LayoutDashboard, dot: false },
    { href: `${base}/posts`, label: "Beiträge", icon: Rows3, dot: hasPending },
    { href: `${base}/media`, label: "Material", icon: Images, dot: false },
  ];

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {tab.label}
              {tab.dot && (
                <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-destructive" />
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {tab.label}
            {tab.dot && <span className="ml-auto size-2 rounded-full bg-destructive" />}
          </Link>
        );
      })}
    </nav>
  );
}
