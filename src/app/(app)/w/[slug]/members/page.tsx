import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listMembers } from "@/lib/members";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMemberForm } from "@/components/add-member-form";
import { MemberRow } from "@/components/member-row";

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
          <MemberRow key={member.id} slug={slug} member={member} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}
