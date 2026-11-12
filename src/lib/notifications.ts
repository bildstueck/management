import "server-only";
import { listMembers } from "@/lib/members";
import { sendEmail } from "@/lib/email";

// Email notifications for the two client-facing events worth an internal
// heads-up: a client comments, or a client approves a post. Internal-only
// activity (team comments, drafting, scheduling) stays silent — those are
// actions the team already knows it took.

function postLink(slug: string, postId: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base}/w/${slug}/posts/${postId}`;
}

async function notifyMembers(workspaceId: string, subject: string, html: string) {
  const members = await listMembers(workspaceId);
  await Promise.all(members.map((m) => sendEmail(m.user.email, subject, html)));
}

export async function notifyClientComment(
  workspace: { id: string; slug: string; name: string },
  postId: string,
  postText: string,
  authorName: string,
  commentText: string,
) {
  const link = postLink(workspace.slug, postId);
  await notifyMembers(
    workspace.id,
    `Neuer Kommentar von ${authorName} — ${workspace.name}`,
    `<p><strong>${escapeHtml(authorName)}</strong> hat zu einem Beitrag kommentiert:</p>
     <p style="color:#666">„${escapeHtml(postText.slice(0, 120))}"</p>
     <blockquote style="border-left:3px solid #ddd;padding-left:10px;margin-left:0">${escapeHtml(commentText)}</blockquote>
     <p><a href="${link}">Beitrag ansehen</a></p>`,
  );
}

export async function notifyClientApproval(
  workspace: { id: string; slug: string; name: string },
  postId: string,
  postText: string,
  approverName: string,
) {
  const link = postLink(workspace.slug, postId);
  await notifyMembers(
    workspace.id,
    `${approverName} hat einen Beitrag freigegeben — ${workspace.name}`,
    `<p><strong>${escapeHtml(approverName)}</strong> hat diesen Beitrag freigegeben:</p>
     <p style="color:#666">„${escapeHtml(postText.slice(0, 120))}"</p>
     <p><a href="${link}">Beitrag ansehen</a></p>`,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
