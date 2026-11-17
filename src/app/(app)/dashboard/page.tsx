import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { getWorkspacesForUser } from "@/lib/workspaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";

export default async function DashboardPage() {
  const user = await requireUser();
  const workspaces = await getWorkspacesForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Willkommen, {user.name ?? user.email}</h1>
          <p className="text-muted-foreground">Wähle einen Workspace oder lege einen neuen an.</p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Noch keine Workspaces</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Lege deinen ersten Workspace an, um Social-Accounts zu verbinden.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={`/w/${workspace.slug}`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: workspace.color }}
                    />
                    {workspace.name}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
