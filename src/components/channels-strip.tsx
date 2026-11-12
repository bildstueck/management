import Link from "next/link";
import { PLATFORM_META } from "@/components/platform-meta";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Platform } from "@prisma/client";

type Account = {
  id: string;
  platform: Platform;
  displayName: string;
  avatarUrl: string | null;
  tokenExpiresAt: Date | null;
};

function isExpiringSoon(tokenExpiresAt: Date | null) {
  if (!tokenExpiresAt) return false;
  return tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

// Compact row of every connected account, shown above the Feed/Kalender/Grid
// views so it's always clear which channels a post could go out on.
export function ChannelsStrip({ slug, accounts }: { slug: string; accounts: Account[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-muted/30 px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">Verbundene Kanäle:</span>
      {accounts.length === 0 ? (
        <Link href={`/w/${slug}/accounts`} className="text-xs text-primary hover:underline">
          Noch keine — jetzt verbinden
        </Link>
      ) : (
        <>
          {accounts.map((account) => {
            const Icon = PLATFORM_META[account.platform].icon;
            const warn = isExpiringSoon(account.tokenExpiresAt);
            return (
              <Link
                key={account.id}
                href={`/w/${slug}/accounts`}
                className="flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs hover:border-primary"
                title={warn ? "Zugang läuft bald ab" : undefined}
              >
                <Avatar className="size-4">
                  <AvatarImage src={account.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">
                    {account.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Icon className="size-3" />
                {account.displayName}
                {warn && <span className="size-1.5 rounded-full bg-destructive" />}
              </Link>
            );
          })}
          <Link
            href={`/w/${slug}/accounts`}
            className="shrink-0 text-xs text-primary hover:underline"
          >
            + Verbinden
          </Link>
        </>
      )}
    </div>
  );
}
