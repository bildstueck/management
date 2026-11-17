import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listMembers } from "@/lib/members";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddMemberForm } from "@/components/add-member-form";
import { removeMemberAction, updateMemberRoleAction } from "./actions";

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const members = await listMembers(workspace.id);
  const canManage = workspace.role === "OWNER";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mitglieder</h1>
        <p className="text-muted-foreground">Team-Zugriff auf diesen Workspace.</p>
      </div>

      {canManage && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Mitglied hinzufügen</CardTitle>
            <CardDescription>Die Person muss bereits einen Team-Account haben.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddMemberForm slug={slug} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col divide-y rounded-md border max-w-2xl">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="font-medium">{member.user.name ?? member.user.email}</p>
              <p className="text-sm text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <form action={updateMemberRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="membershipId" value={member.id} />
                  <select
                    name="role"
                    defaultValue={member.role}
                    className="border-input h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="OWNER">Owner</option>
                  </select>
                  <Button type="submit" variant="outline" size="sm">
                    Ändern
                  </Button>
                </form>
              ) : (
                <Badge variant="secondary">{member.role === "OWNER" ? "Owner" : "Editor"}</Badge>
              )}
              {canManage && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="membershipId" value={member.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Entfernen
                  </Button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
