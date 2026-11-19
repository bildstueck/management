"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { MembershipRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/(app)/w/[slug]/members/actions";

type Member = {
  id: string;
  role: MembershipRole;
  user: { name: string | null; email: string };
};

export function MemberRow({
  slug,
  member,
  canManage,
}: {
  slug: string;
  member: Member;
  canManage: boolean;
}) {
  const [role, setRole] = useState(member.role);
  const [removed, setRemoved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function changeRole(next: MembershipRole) {
    const previous = role;
    setRole(next);
    startTransition(async () => {
      try {
        await updateMemberRoleAction(slug, member.id, next);
        toast.success("Rolle geändert.");
      } catch (error) {
        setRole(previous);
        toast.error(error instanceof Error ? error.message : "Ändern fehlgeschlagen.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await removeMemberAction(slug, member.id);
        setRemoved(true);
        toast.success("Mitglied entfernt.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Entfernen fehlgeschlagen.");
      }
    });
  }

  if (removed) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="font-medium">{member.user.name ?? member.user.email}</p>
        <p className="text-sm text-muted-foreground">{member.user.email}</p>
      </div>
      <div className="flex items-center gap-2">
        {canManage ? (
          <select
            value={role}
            disabled={isPending}
            onChange={(e) => changeRole(e.target.value as MembershipRole)}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs disabled:opacity-60"
          >
            <option value="EDITOR">Editor</option>
            <option value="OWNER">Owner</option>
          </select>
        ) : (
          <Badge variant="secondary">{role === "OWNER" ? "Owner" : "Editor"}</Badge>
        )}
        {canManage && (
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={remove}>
            Entfernen
          </Button>
        )}
      </div>
    </div>
  );
}
