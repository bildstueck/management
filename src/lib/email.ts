import nodemailer from "nodemailer";

// Minimal SMTP wrapper for notification emails (comment/approval on a
// client's share-link action — see src/lib/notifications.ts). Works with
// any SMTP provider (Postmark, SES, a self-hosted relay, ...); nothing
// provider-specific is assumed.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const client = getTransporter();
  if (!client) {
    console.warn(`[email] SMTP not configured — skipping email "${subject}" to ${to}.`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "Social Planner <no-reply@localhost>";
  try {
    await client.sendMail({ from, to, subject, html });
  } catch (error) {
    // Never let a notification failure break the action that triggered it.
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
  }
}
