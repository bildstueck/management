"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PostsViewTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/w/${slug}/posts`;
  const tabs = [
    { href: base, label: "Feed" },
    { href: `${base}/calendar`, label: "Kalender" },
    { href: `${base}/grid`, label: "Instagram Grid" },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <Button
          key={tab.href}
          variant={pathname === tab.href ? "default" : "outline"}
          size="sm"
          render={<Link href={tab.href} />}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
