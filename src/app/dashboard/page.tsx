import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Willkommen, {session?.user?.name ?? session?.user?.email}</h1>
        <p className="text-muted-foreground">
          Projekt-Setup (Phase 0) ist abgeschlossen. Workspaces und Social-Account-Verbindungen folgen in Phase 1.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>Noch keine Workspaces vorhanden.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled>Neuen Workspace anlegen (Phase 1)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
