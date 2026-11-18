import Image from "next/image";
import { getShareLinkByToken } from "@/lib/share-links";
import { isShareLinkUnlocked } from "@/lib/share-link-session";
import { listPostsByStatus } from "@/lib/posts";
import { PasswordGate } from "@/components/review/password-gate";
import { ReviewNav } from "@/components/review/review-nav";

function WorkspaceBadge({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </div>
  );
}

export default async function ReviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);

  if (!link) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center border-b px-6 py-3">
          <Image
            src="/brand/bildstueck-mark.png"
            alt="bildstueck"
            width={689}
            height={416}
            priority
            className="h-6 w-auto"
          />
        </header>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Link ungültig oder abgelaufen</h1>
            <p className="mt-2 text-muted-foreground">
              Bitte frag die Agentur nach einem neuen Einladungslink.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (link.passwordHash && !(await isShareLinkUnlocked(link.id))) {
    return <PasswordGate token={token} />;
  }

  const pending = await listPostsByStatus(link.workspaceId, ["PENDING_APPROVAL"]);
  const hasPending = pending.length > 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Image
          src="/brand/bildstueck-mark.png"
          alt="bildstueck"
          width={689}
          height={416}
          priority
          className="h-6 w-auto"
        />
        {link.recipientName && (
          <span className="ml-3 truncate text-sm text-muted-foreground">{link.recipientName}</span>
        )}
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex flex-col gap-2 border-b p-3 lg:hidden">
          <WorkspaceBadge name={link.workspace.name} color={link.workspace.color} />
          <ReviewNav token={token} variant="mobile" hasPending={hasPending} />
        </div>
        <aside className="hidden w-64 shrink-0 flex-col gap-3 border-r p-4 lg:flex">
          <WorkspaceBadge name={link.workspace.name} color={link.workspace.color} />
          <ReviewNav token={token} hasPending={hasPending} />
        </aside>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
