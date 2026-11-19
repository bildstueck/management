import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { listShareLinks } from "@/lib/share-links";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateShareLinkForm } from "@/components/create-share-link-form";
import { ShareLinkCard } from "@/components/share-link-card";

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);
  const links = await listShareLinks(workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Einladungslinks</h1>
        <p className="text-muted-foreground">Links für Kunden, ohne Account.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Neuer Link</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateShareLinkForm slug={slug} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 max-w-2xl">
        {links.length === 0 && <p className="text-muted-foreground">Noch keine Links erstellt.</p>}
        {links.map((link) => (
          <ShareLinkCard
            key={link.id}
            slug={slug}
            link={{ ...link, url: `${process.env.AUTH_URL ?? ""}/review/${link.token}` }}
          />
        ))}
      </div>
    </div>
  );
}
