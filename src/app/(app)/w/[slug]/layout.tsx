import { requireUser } from "@/lib/dal";
import { requireWorkspaceMember, getWorkspacesForUser } from "@/lib/workspaces";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { WorkspaceNav } from "@/components/workspace-nav";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const [workspace, workspaces] = await Promise.all([
    requireWorkspaceMember(slug, user.id),
    getWorkspacesForUser(user.id),
  ]);

  return (
    <div className="flex flex-1 flex-col -m-6 lg:flex-row">
      <div className="flex flex-col gap-2 border-b p-3 lg:hidden">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
        <WorkspaceNav slug={slug} isOwner={workspace.role === "OWNER"} variant="mobile" />
      </div>
      <aside className="hidden w-56 shrink-0 flex-col gap-4 border-r p-4 lg:flex">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
        <WorkspaceNav slug={slug} isOwner={workspace.role === "OWNER"} />
      </aside>
      <div className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-6">{children}</div>
    </div>
  );
}
