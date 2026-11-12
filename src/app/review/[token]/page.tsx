// Public, unauthenticated magic-link review page for external clients.
// Implemented in Phase 4 (Kollaboration & Freigabe) — see the plan.

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Freigabe-Link</h1>
        <p className="text-muted-foreground mt-2">
          Diese Review-Ansicht wird in Phase 4 implementiert.
        </p>
        <p className="mt-4 font-mono text-xs text-muted-foreground">Token: {token}</p>
      </div>
    </div>
  );
}
