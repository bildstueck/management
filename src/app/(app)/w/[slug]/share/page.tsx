import { requireUser } from "@/lib/dal";
import { requireWorkspaceRole } from "@/lib/workspaces";
import { listShareLinks } from "@/lib/share-links";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateShareLinkForm } from "@/components/create-share-link-form";
import { CopyButton } from "@/components/copy-button";
import { deleteShareLinkAction } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const workspace = await requireWorkspaceRole(slug, user.id, ["OWNER"]);
  const links = await listShareLinks(workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Einladungslinks</h1>
        <p className="text-muted-foreground">
          Lade Kunden ohne Account zu diesem Workspace ein. Sie sehen Beiträge, die bereits
          &bdquo;Zur Freigabe&rdquo; eingereicht wurden, können kommentieren, freigeben und eigene
          Medien hochladen.
        </p>
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
        {links.map((link) => {
          const url = `${process.env.AUTH_URL ?? ""}/review/${link.token}`;
          return (
            <Card key={link.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-mono text-sm">{url}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {link.passwordHash && <Badge variant="secondary">Passwortgeschützt</Badge>}
                    {link.expiresAt && (
                      <Badge variant="secondary">Läuft ab: {dateFormatter.format(link.expiresAt)}</Badge>
                    )}
                    {link.canComment && <Badge variant="secondary">Kommentare</Badge>}
                    {link.canApprove && <Badge variant="secondary">Freigabe</Badge>}
                    {link.canEdit && <Badge variant="secondary">Bearbeiten</Badge>}
                    {link.canUpload && <Badge variant="secondary">Medien-Upload</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <CopyButton value={url} />
                  <form action={deleteShareLinkAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={link.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Löschen
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
