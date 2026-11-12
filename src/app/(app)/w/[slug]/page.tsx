import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          {workspace.name}
          <Badge variant="secondary">{workspace.role === "OWNER" ? "Owner" : "Editor"}</Badge>
        </h1>
        <p className="text-muted-foreground">
          Beiträge, Kalender und Freigaben folgen in Phase 2–4. Aktuell: Accounts verbinden und
          Team verwalten.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={`/w/${workspace.slug}/accounts`}>
          <Card className="transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle>Social Accounts</CardTitle>
              <CardDescription>Facebook, Instagram und LinkedIn verbinden.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={`/w/${workspace.slug}/members`}>
          <Card className="transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle>Mitglieder</CardTitle>
              <CardDescription>Team-Zugriff auf diesen Workspace verwalten.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
