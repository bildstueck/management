import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember } from "@/lib/workspaces";
import { listSocialAccounts } from "@/lib/social-accounts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { AccountCard } from "@/components/account-card";

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
};

function tokenStatus(tokenExpiresAt: Date | null) {
  if (!tokenExpiresAt) return { label: "Aktiv", variant: "secondary" as const };
  const daysLeft = (tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return { label: "Abgelaufen – neu verbinden", variant: "destructive" as const };
  if (daysLeft < 7) return { label: "Läuft bald ab", variant: "destructive" as const };
  return { label: "Aktiv", variant: "secondary" as const };
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Verbindung abgebrochen.",
  connect_failed: "Verbindung fehlgeschlagen. Details im Server-Log.",
  missing_code: "Verbindung unvollständig (kein Code erhalten).",
};

export default async function AccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ connected?: string; count?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { connected, count, error } = await searchParams;
  const user = await requireUser();
  const workspace = await requireWorkspaceMember(slug, user.id);
  const accounts = await listSocialAccounts(workspace.id);
  const canManage = workspace.role === "OWNER";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Social Accounts</h1>
          <p className="text-muted-foreground">Facebook, Instagram und LinkedIn verbinden.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" render={<a href={`/api/connect/meta?workspace=${slug}`} />}>
              Facebook verbinden
            </Button>
            <Button
              variant="outline"
              render={<a href={`/api/connect/instagram?workspace=${slug}`} />}
            >
              Instagram verbinden
            </Button>
            <Button
              variant="outline"
              render={<a href={`/api/connect/linkedin?workspace=${slug}`} />}
            >
              LinkedIn verbinden
            </Button>
          </div>
        )}
      </div>

      {connected && (
        <p className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {count} Account(s) über{" "}
          {connected === "meta" ? "Facebook" : connected === "instagram" ? "Instagram" : "LinkedIn"}{" "}
          verbunden.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Verbindung fehlgeschlagen."}
        </p>
      )}

      {accounts.length === 0 ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Noch keine Accounts verbunden</CardTitle>
            <CardDescription>
              {canManage ? "Oben verbinden." : "Nur Owner können Accounts verbinden."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              slug={slug}
              account={account}
              platformLabel={PLATFORM_LABELS[account.platform]}
              status={tokenStatus(account.tokenExpiresAt)}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
