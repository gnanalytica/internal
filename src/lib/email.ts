import "server-only";

/**
 * Outbound email, behind a provider check.
 *
 * No mail provider is provisioned for this workspace yet, so everything here
 * no-ops until one is — the same shape as `isAiConfigured` and
 * `isGithubConnected`. That keeps the digest shippable now and makes turning it
 * on a matter of setting two env vars rather than writing code.
 *
 * Wired for Resend because it is the usual pick on Vercel, but the surface is
 * one `fetch`; swapping providers means changing this file only. Provision it
 * through the Vercel Marketplace (`vercel integration`) rather than by hand so
 * the keys land in the project's environment.
 */

const ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Absolute base for links in emails; without it a digest is a list of dead text. */
export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Best-effort send. Never throws: a failed digest must not fail the cron run
 * that is also sending everyone else's.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
