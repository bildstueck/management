"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Rows3, Images, Share2, Plug, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkspaceNav({
  slug,
  isOwner,
  variant = "sidebar",
}: {
  slug: string;
  isOwner: boolean;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const base = `/w/${slug}`;
  const tabs = [
    { href: base, label: "Übersicht", icon: LayoutDashboard },
    { href: `${base}/posts`, label: "Beiträge", icon: Rows3 },
    { href: `${base}/media`, label: "Material", icon: Images },
    ...(isOwner ? [{ href: `${base}/share`, label: "Freigabe", icon: Share2 }] : []),
    { href: `${base}/accounts`, label: "Accounts", icon: Plug },
    { href: `${base}/members`, label: "Mitglieder", icon: Users },
    ...(isOwner ? [{ href: `${base}/settings`, label: "Einstellungen", icon: Settings }] : []),
  ];

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active =
            tab.href === base ? pathname === base : pathname.startsWith(`${tab.href}/`) || pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {tabs.map((tab) => {
        const active =
          tab.href === base ? pathname === base : pathname.startsWith(`${tab.href}/`) || pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
