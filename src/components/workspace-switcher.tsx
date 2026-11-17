"use client";

import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type WorkspaceSummary = { slug: string; name: string; color?: string };

function ColorDot({ color }: { color?: string }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color || "#6366f1" }}
    />
  );
}

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="w-full justify-between gap-1" />}
      >
        <span className="flex items-center gap-2 truncate">
          <ColorDot color={current.color} />
          {current.name}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.slug} render={<Link href={`/w/${workspace.slug}`} />}>
            <ColorDot color={workspace.color} />
            {workspace.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard" className="flex items-center gap-2" />}>
          <Plus className="size-3.5" /> Alle Workspaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
