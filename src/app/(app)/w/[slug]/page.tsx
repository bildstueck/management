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
          Beiträge planen, von Kunden freigeben lassen und automatisch veröffentlichen.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Link href={`/w/${workspace.slug}/posts`}>
          <Card className="transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle>Beiträge</CardTitle>
              <CardDescription>Feed, Kalender, Instagram-Grid.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        {workspace.role === "OWNER" && (
          <Link href={`/w/${workspace.slug}/share`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>Freigabe</CardTitle>
                <CardDescription>Links für Kunden-Freigaben verwalten.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
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
