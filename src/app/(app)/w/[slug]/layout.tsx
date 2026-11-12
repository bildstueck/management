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
  const workspace = await requireWorkspaceMember(slug, user.id);
  const workspaces = await getWorkspacesForUser(user.id);

  return (
    <div className="flex flex-1 flex-col -m-6">
      <div className="flex items-center gap-3 px-6 py-3">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>
      <WorkspaceNav slug={slug} />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
