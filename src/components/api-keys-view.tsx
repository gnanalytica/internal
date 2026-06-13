"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plus, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  revokeApiKey,
  setWebhookActive,
} from "@/lib/actions";
import type { ApiKeyRow, WebhookRow } from "@/lib/data";
import { cn } from "@/lib/utils";

export function ApiKeysView({
  keys,
  webhooks,
  events,
  isAdmin,
  baseUrl,
}: {
  keys: ApiKeyRow[];
  webhooks: WebhookRow[];
  events: string[];
  isAdmin: boolean;
  baseUrl: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // Webhooks
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<Set<string>>(new Set());
  const [hookSecret, setHookSecret] = useState<string | null>(null);

  function addWebhook() {
    if (!/^https?:\/\//.test(hookUrl.trim())) {
      toast.error("Enter a valid http(s) URL.");
      return;
    }
    startTransition(async () => {
      try {
        const { secret } = await createWebhook(
          hookUrl,
          hookEvents.size ? [...hookEvents] : ["*"],
        );
        setHookSecret(secret);
        setHookUrl("");
        setHookEvents(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add webhook");
      }
    });
  }

  function toggleEvent(e: string) {
    setHookEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  function create() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const { key } = await createApiKey(name);
        setCreated(key);
        setName("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create key");
      }
    });
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke(id: string) {
    startTransition(async () => {
      await revokeApiKey(id);
      router.refresh();
    });
  }

  const apiUrl = `${baseUrl || "https://your-app"}/api/v1`;

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Settings" }, { label: "API" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound className="size-5 text-brand" />
            <h1 className="text-lg font-semibold">API keys</h1>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Keys grant full programmatic access to this workspace. Use them with the
            REST API and the MCP server.
          </p>

          {/* Quick start */}
          <div className="mb-6 rounded-xl border bg-muted/20 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Base URL
            </div>
            <code className="block break-all rounded-md bg-muted px-2 py-1.5 text-xs">
              {apiUrl}
            </code>
            <div className="mt-3 text-xs text-muted-foreground">
              Authenticate with{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                Authorization: Bearer &lt;key&gt;
              </code>
              . Try <code className="rounded bg-muted px-1 py-0.5">GET {apiUrl}/me</code>.
            </div>
          </div>

          {!isAdmin && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              Only workspace admins can create or revoke API keys.
            </p>
          )}

          {isAdmin && (
            <>
              {/* Newly created key (shown once) */}
              {created && (
                <div className="mb-4 rounded-xl border border-brand/40 bg-brand/5 p-4">
                  <div className="mb-1 text-sm font-medium">Your new API key</div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Copy it now — you won&apos;t be able to see it again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                      {created}
                    </code>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(created)}>
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <button
                    onClick={() => setCreated(null)}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Create */}
              <div className="mb-6 flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  placeholder="Key name (e.g. CI bot, Claude agent)"
                  className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand"
                />
                <Button className="h-9 gap-1.5" onClick={create} disabled={pending || !name.trim()}>
                  <Plus className="size-4" /> Create key
                </Button>
              </div>
            </>
          )}

          {/* Existing keys */}
          <div className="space-y-1.5">
            {keys.length === 0 ? (
              <p className="text-xs text-muted-foreground">No API keys yet.</p>
            ) : (
              keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{k.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <code>{k.keyPrefix}…</code> · created{" "}
                      {formatDistanceToNowStrict(new Date(k.createdAt), { addSuffix: true })}
                      {k.lastUsedAt
                        ? ` · last used ${formatDistanceToNowStrict(new Date(k.lastUsedAt), { addSuffix: true })}`
                        : " · never used"}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => revoke(k.id)}
                      aria-label="Revoke key"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Webhooks */}
          <div className="mt-10">
            <div className="mb-1 flex items-center gap-2">
              <Webhook className="size-5 text-brand" />
              <h2 className="text-base font-semibold">Webhooks</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              POST workspace events to your URL, signed with{" "}
              <code className="rounded bg-muted px-1 py-0.5">X-Internal-Signature</code>{" "}
              (HMAC-SHA256).
            </p>

            {hookSecret && (
              <div className="mb-4 rounded-xl border border-brand/40 bg-brand/5 p-4">
                <div className="mb-1 text-sm font-medium">Signing secret</div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Verify deliveries with this secret. Shown once.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                    {hookSecret}
                  </code>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(hookSecret)}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <button
                  onClick={() => setHookSecret(null)}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Done
                </button>
              </div>
            )}

            {isAdmin && (
              <div className="mb-4 rounded-xl border p-4">
                <input
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  placeholder="https://example.com/webhooks/internal"
                  className="mb-2 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand"
                />
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {events.map((e) => (
                    <button
                      key={e}
                      onClick={() => toggleEvent(e)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        hookEvents.has(e)
                          ? "border-brand bg-brand/10 text-brand"
                          : "text-muted-foreground",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {hookEvents.size === 0 ? "All events" : `${hookEvents.size} selected`}
                  </span>
                  <Button size="sm" className="gap-1.5" onClick={addWebhook} disabled={pending || !hookUrl.trim()}>
                    <Plus className="size-4" /> Add webhook
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {webhooks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No webhooks yet.</p>
              ) : (
                webhooks.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <Webhook className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{h.url}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.events.includes("*") ? "all events" : h.events.join(", ")}
                        {h.lastStatus != null
                          ? ` · last ${h.lastStatus === 0 ? "failed" : h.lastStatus}`
                          : " · no deliveries"}
                      </div>
                    </div>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => startTransition(() => setWebhookActive(h.id, !h.active).then(() => router.refresh()))}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            h.active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {h.active ? "Active" : "Paused"}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => startTransition(() => deleteWebhook(h.id).then(() => router.refresh()))}
                          aria-label="Delete webhook"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
