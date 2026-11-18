import Image from "next/image";
import { getShareLinkByToken } from "@/lib/share-links";
import { isShareLinkUnlocked } from "@/lib/share-link-session";
import { PasswordGate } from "@/components/review/password-gate";
import { ReviewNav } from "@/components/review/review-nav";

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
        <div className="flex gap-1 overflow-x-auto border-b p-3 lg:hidden">
          <ReviewNav token={token} variant="mobile" />
        </div>
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r p-4 lg:flex">
          <ReviewNav token={token} />
        </aside>
        <main className="mx-auto min-w-0 w-full max-w-md flex-1 overflow-x-hidden p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
