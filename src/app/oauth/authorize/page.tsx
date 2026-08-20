import { getCurrentUser, getMyWorkspaces } from "@/lib/data";
import { findClient, redirectUriAllowed } from "@/lib/api/oauth";

import { approveConnection } from "./actions";

/**
 * Consent screen for the "Connect" flow.
 *
 * Deliberately OUTSIDE the `(app)` route group: this is an authorization
 * decision, and rendering it inside the full app shell (sidebar, command
 * palette, notifications) invites click-through. A bare page makes the user
 * read what they are approving.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const clientId = one("client_id");
  const redirectUri = one("redirect_uri");
  const state = one("state");
  const responseType = one("response_type") || "code";

  const client = findClient(clientId);

  // An unknown client or an unregistered redirect is rendered as an error HERE
  // and never bounced back. Redirecting an unvalidated `redirect_uri` — even
  // with an error code — turns this route into an open redirector, and an
  // attacker who can pick the destination can harvest whatever follows.
  if (!client || !redirectUriAllowed(client, redirectUri)) {
    return (
      <Shell title="This connection request isn’t valid">
        <p className="text-sm text-neutral-500">
          The application or its callback address isn’t registered with this
          workspace. Nothing has been shared. Close this page and start the
          connection again from the application.
        </p>
      </Shell>
    );
  }
  if (responseType !== "code") {
    return (
      <Shell title="Unsupported request">
        <p className="text-sm text-neutral-500">
          Only the authorization-code flow is supported.
        </p>
      </Shell>
    );
  }

  // Redirects to sign-in when anonymous.
  const me = await getCurrentUser();
  const mine = await getMyWorkspaces();
  const admined = mine.filter((w) => w.role === "admin");

  if (admined.length === 0) {
    return (
      <Shell title={`Connect ${client.name}`}>
        <p className="text-sm text-neutral-500">
          You’re signed in as <strong>{me.email}</strong>, but only workspace
          admins can connect an application. Ask an admin to do this, or have
          them make you an admin first.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={`Connect ${client.name}`}>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        <strong>{client.name}</strong> is asking to connect to your workspace. If
        you approve, it will be able to:
      </p>
      <ul className="my-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
        <li>• read and create issues, projects and comments</li>
        <li>• assign work to people in this workspace</li>
        <li>• receive events when issues change</li>
      </ul>
      <p className="text-xs text-neutral-500">
        This creates an API key named “{client.name}”. You can revoke it at any
        time from Settings → API, which immediately cuts off access.
      </p>

      <form action={approveConnection} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />

        {admined.length === 1 ? (
          <input type="hidden" name="workspace_id" value={admined[0].id} />
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-500">Workspace</span>
            <select
              name="workspace_id"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {admined.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Approve and connect
          </button>
          <a
            href="/"
            className="rounded-md px-4 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Cancel
          </a>
        </div>
        {admined.length === 1 ? (
          <p className="text-xs text-neutral-500">
            Connecting <strong>{admined[0].name}</strong> as {me.email}.
          </p>
        ) : null}
      </form>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}
