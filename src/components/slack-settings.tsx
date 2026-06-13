"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { sendTestSlack, setSlackWebhook } from "@/lib/actions";

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#36C5F0" d="M5.5 15.5a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5Zm1.25 0a2.5 2.5 0 0 1 5 0v6.25a2.5 2.5 0 0 1-5 0V15.5Z" />
      <path fill="#2EB67D" d="M9.25 5.5a2.5 2.5 0 1 1 2.5-2.5v2.5h-2.5Zm0 1.25a2.5 2.5 0 0 1 0 5H3a2.5 2.5 0 0 1 0-5h6.25Z" />
      <path fill="#ECB22E" d="M18.5 9.25a2.5 2.5 0 1 1 2.5 2.5h-2.5v-2.5Zm-1.25 0a2.5 2.5 0 0 1-5 0V3a2.5 2.5 0 0 1 5 0v6.25Z" />
      <path fill="#E01E5A" d="M14.75 18.5a2.5 2.5 0 1 1-2.5 2.5v-2.5h2.5Zm0-1.25a2.5 2.5 0 0 1 0-5H21a2.5 2.5 0 0 1 0 5h-6.25Z" />
    </svg>
  );
}

export function SlackSettings({
  connected,
  isAdmin,
}: {
  connected: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Settings" }, { label: "Slack" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-8 py-10">
          <div className="mb-6 flex items-center gap-3">
            <SlackIcon className="size-9" />
            <div>
              <h2 className="text-sm font-semibold">Slack</h2>
              <p className="text-sm text-muted-foreground">
                Post a message to a Slack channel when issues are created.
              </p>
            </div>
            {connected && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="size-3.5" /> Connected
              </span>
            )}
          </div>

          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">
              Only admins can configure the Slack integration.
            </p>
          ) : (
            <>
              {connected ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={pending}
                    onClick={() => run(() => sendTestSlack(), "Test sent to Slack")}
                  >
                    <Send className="size-4" /> Send test message
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => run(() => setSlackWebhook(""), "Disconnected")}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="text-xs font-medium">Incoming Webhook URL</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/…"
                      className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </label>
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={pending || !url.trim()}
                    onClick={() => run(() => setSlackWebhook(url), "Slack connected")}
                  >
                    Connect
                  </Button>
                </div>
              )}

              {/* Setup instructions */}
              <div className="mt-8 rounded-xl border bg-muted/20 p-4 text-sm">
                <h3 className="mb-2 font-medium">How to get a webhook URL</h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>
                    Go to{" "}
                    <a
                      href="https://api.slack.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      api.slack.com/apps
                    </a>{" "}
                    → <strong>Create New App</strong> → From scratch, in your workspace.
                  </li>
                  <li>
                    Open <strong>Incoming Webhooks</strong> → toggle it <strong>On</strong>.
                  </li>
                  <li>
                    Click <strong>Add New Webhook to Workspace</strong>, pick the channel,
                    and authorize.
                  </li>
                  <li>
                    Copy the <strong>Webhook URL</strong> (starts with{" "}
                    <code className="rounded bg-muted px-1 font-mono text-xs">
                      https://hooks.slack.com/services/…
                    </code>
                    ) and paste it above.
                  </li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
