"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function WorkspaceNav({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const pathname = usePathname();
  const base = `/w/${slug}`;
  const tabs = [
    { href: base, label: "Übersicht" },
    { href: `${base}/posts`, label: "Beiträge" },
    ...(isOwner ? [{ href: `${base}/share`, label: "Freigabe" }] : []),
    { href: `${base}/accounts`, label: "Accounts" },
    { href: `${base}/members`, label: "Mitglieder" },
  ];

  return (
    <nav className="flex gap-1 border-b px-6">
      {tabs.map((tab) => {
        const active =
          tab.href === base ? pathname === base : pathname.startsWith(`${tab.href}/`) || pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
