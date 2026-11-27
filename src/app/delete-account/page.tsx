import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete your account — Gnanalytica Internal",
};

/**
 * Public (no sign-in) page that Google Play links to from the app's Data
 * safety section: how to ask for an Internal account and its data to be
 * deleted. Excluded from the session redirect in src/proxy.ts.
 */
export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-sm leading-6">
      <h1 className="text-2xl font-semibold">Delete your Gnanalytica Internal account</h1>
      <p className="mt-2 text-muted-foreground">
        Gnanalytica Internal (web and Android app) is published by Gnanalytica Technologies LLP.
      </p>

      <h2 className="mt-8 text-base font-semibold">How to ask</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          Email <a className="underline" href="mailto:contact@gnanalytica.com?subject=Delete%20my%20Internal%20account">contact@gnanalytica.com</a>{" "}
          from the address you sign in with, with the subject &ldquo;Delete my Internal account&rdquo;.
        </li>
        <li>We confirm the request is yours and reply within 7 days.</li>
        <li>Your account and its data are deleted within 30 days of that reply.</li>
      </ol>
      <p className="mt-3 text-muted-foreground">You can also ask a workspace admin to remove you from a workspace at any time.</p>

      <h2 className="mt-8 text-base font-semibold">What is deleted</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Your sign-in account: name, email and password.</li>
        <li>Your profile, notification settings and API keys.</li>
        <li>Your membership of every workspace.</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">What is kept</h2>
      <p className="mt-2">
        Work you created inside a shared workspace — tasks, comments, documents and records — belongs to that workspace and
        stays for its other members, no longer linked to your account. If you are the only member of a workspace, it is
        deleted with your account.
      </p>
    </main>
  );
}
