import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WorkspaceColorPicker } from "@/components/workspace-color-picker";
import { DeleteWorkspaceButton } from "@/components/delete-workspace-button";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-muted-foreground">Für diesen Workspace, nur für Owner sichtbar.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Farbe</CardTitle>
          <CardDescription>
            Hilft, den Workspace im Switcher und im Dashboard schnell zu erkennen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceColorPicker slug={slug} color={workspace.color} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Workspace löschen</CardTitle>
          <CardDescription>
            Entfernt alle Beiträge, Medien, Accounts und Freigabe-Links unwiderruflich. Das kann
            nicht rückgängig gemacht werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteWorkspaceButton slug={slug} name={workspace.name} />
        </CardContent>
      </Card>
    </div>
  );
}
