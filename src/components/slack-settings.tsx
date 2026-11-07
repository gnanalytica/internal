"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, Hash, Link2, Lock, Pencil, Plus, Send, Sparkles, Trash2, TriangleAlert, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { sendTestSlack, setSlackWebhook } from "@/lib/actions";
import { PROSPECT_STAGE_OPTIONS, SLACK_EVENT_GROUPS, SLACK_RULE_PRESETS, slackEventLabel } from "@/lib/slack/events";
import { deleteSlackRule, linkMySlack, saveSlackRule, sendSlackRuleTest, unlinkMySlack } from "@/lib/slack/settings-actions";
import type { SlackChannelOption, SlackConnection, SlackRuleRow } from "@/lib/slack/settings-data";
import { draftFromPreset, draftFromRule, draftProblem, emptyDraft, toggleEvent, type RuleDraft } from "@/lib/slack/rule-draft";
import { TONES } from "@/lib/tones";
import { cn } from "@/lib/utils";

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

const field =
  "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

type ProjectOption = { id: string; name: string; key: string };

export function SlackSettings({
  connection,
  rules,
  channels,
  projects,
  slackUserId,
  myEmail,
  isAdmin,
  legacyConnected,
  webhookUrl,
}: {
  connection: SlackConnection;
  rules: SlackRuleRow[];
  channels: SlackChannelOption[];
  projects: ProjectOption[];
  slackUserId: string | null;
  myEmail: string;
  isAdmin: boolean;
  legacyConnected: boolean;
  webhookUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<RuleDraft | null>(null);

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

  const live = connection.configured && connection.ok;
  const projectName = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.name ?? "A deleted project") : "All projects");

  const save = (d: RuleDraft) =>
    run(async () => {
      const res = await saveSlackRule({
        id: d.id,
        channelId: d.channelId,
        projectId: d.projectId,
        events: d.events,
        minProspectStage: d.minProspectStage,
      });
      setDraft(null);
      if (!res.botInChannel) toast.warning("Saved. Invite @Internal to that channel so it can post there.");
      else toast.success("Rule saved");
    });

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Settings" }, { label: "Slack" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-10">
          <div className="mb-6 flex items-center gap-3">
            <SlackIcon className="size-9" />
            <div>
              <h2 className="text-sm font-semibold">Slack</h2>
              <p className="text-sm text-muted-foreground">
                Post tasks, deals, prospects, requests and feedback to the channels that care, and act on them from
                Slack.
              </p>
            </div>
            <ConnectionChip connection={connection} />
          </div>

          {connection.configured && !connection.ok && (
            <p className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              The bot token is set but Slack rejected it ({connection.error}). Check <code>SLACK_BOT_TOKEN</code> in
              Vercel and redeploy.
            </p>
          )}

          <SetupSteps open={!live} webhookUrl={webhookUrl} />

          {/* ---- your account ---- */}
          <section className="mt-8">
            <h3 className="mb-1 text-sm font-semibold">Your Slack account</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Buttons in Slack act as you once your account is linked. It links itself the first time you click one, if
              your Slack email is {myEmail}.
            </p>
            <AccountLink slackUserId={slackUserId} live={live} pending={pending} run={run} />
          </section>

          {/* ---- channel rules ---- */}
          <section className="mt-10">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-semibold">Channels</h3>
              {isAdmin && live && !draft && (
                <Button size="sm" variant="outline" className="ml-auto h-7 gap-1.5" onClick={() => setDraft(emptyDraft())}>
                  <Plus className="size-3.5" /> Add channel
                </Button>
              )}
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Each channel hears the events ticked for it. Later events for the same record reply in its thread.
            </p>

            {isAdmin && live && !draft && (
              <div className="mb-4 flex flex-wrap gap-2">
                {SLACK_RULE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setDraft(draftFromPreset(p.id, channels, projects) ?? emptyDraft())}
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs hover:border-brand/50 hover:bg-brand/5"
                  >
                    <Sparkles className="size-3.5 shrink-0 text-brand" />
                    <span>
                      <span className="font-medium">#{p.channelName}</span>
                      <span className="text-muted-foreground"> ← {p.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {draft && (
              <RuleEditor
                draft={draft}
                setDraft={setDraft}
                channels={channels}
                projects={projects}
                pending={pending}
                onSave={() => save(draft)}
                onCancel={() => setDraft(null)}
              />
            )}

            <div className="space-y-1.5">
              {rules.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "No channels yet." : "No channels yet. An admin sets these up."}
                </p>
              ) : (
                rules.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                    <Hash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {r.slackChannelName}
                        <span className="font-normal text-muted-foreground"> · {projectName(r.projectId)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.events.map((e) => (
                          <span key={e} className={cn("rounded-full px-1.5 py-0.5 text-[11px]", TONES.gray.chip)}>
                            {slackEventLabel(e)}
                            {e === "prospect.stage_changed" && r.filters.minProspectStage
                              ? ` (from ${r.filters.minProspectStage})`
                              : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          disabled={pending || !live}
                          onClick={() => run(() => sendSlackRuleTest(r.id), `Test sent to #${r.slackChannelName}`)}
                        >
                          <Send className="size-3.5" /> Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          disabled={pending || !live}
                          onClick={() => setDraft(draftFromRule(r))}
                          aria-label={`Edit #${r.slackChannelName}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => run(() => deleteSlackRule(r.id), "Rule removed")}
                          aria-label={`Remove #${r.slackChannelName}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {!isAdmin && rules.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Only admins can change where notifications go.</p>
            )}
          </section>

          {isAdmin && (
            <LegacyWebhook connected={legacyConnected} pending={pending} run={run} />
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionChip({ connection }: { connection: SlackConnection }) {
  if (!connection.configured)
    return <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-medium", TONES.gray.chip)}>Not set up</span>;
  if (!connection.ok)
    return (
      <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONES.amber.chip)}>
        <TriangleAlert className="size-3.5" /> Token rejected
      </span>
    );
  return (
    <span
      className={cn("ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONES.green.chip)}
      title={connection.teamUrl ?? undefined}
    >
      <CircleCheck className="size-3.5" /> @{connection.botName} in {connection.team}
    </span>
  );
}

function SetupSteps({ open, webhookUrl }: { open: boolean; webhookUrl: string }) {
  const code = "rounded bg-muted px-1 font-mono text-xs";
  return (
    <details open={open} className="group rounded-xl border bg-muted/20 p-4 text-sm">
      <summary className="cursor-pointer font-medium marker:text-muted-foreground">Setup (a workspace admin, once)</summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
        <li>
          At{" "}
          <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            api.slack.com/apps
          </a>{" "}
          choose <strong>Create New App → From a manifest</strong>, pick the workspace and paste{" "}
          <code className={code}>slack/manifest.json</code> from the repo.
        </li>
        <li>
          <strong>Install to Workspace</strong> and allow the permissions.
        </li>
        <li>
          Copy the <strong>Bot User OAuth Token</strong> (OAuth &amp; Permissions) and the <strong>Signing Secret</strong>{" "}
          (Basic Information) into Vercel as <code className={code}>SLACK_BOT_TOKEN</code> and{" "}
          <code className={code}>SLACK_SIGNING_SECRET</code>.
        </li>
        <li>Redeploy, then check the event URL is verified in the app&apos;s Event Subscriptions: <code className={code}>{webhookUrl}</code>.</li>
        <li>
          In each channel that should hear from Internal, type <code className={code}>/invite @Internal</code>, then add it
          below.
        </li>
        <li>Everyone links their Slack account under “Your Slack account” (or just clicks a button in Slack).</li>
      </ol>
    </details>
  );
}

function AccountLink({
  slackUserId,
  live,
  pending,
  run,
}: {
  slackUserId: string | null;
  live: boolean;
  pending: boolean;
  run: (fn: () => Promise<unknown>, ok?: string) => void;
}) {
  const [other, setOther] = useState("");
  if (slackUserId)
    return (
      <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
        <CircleCheck className="size-4 text-emerald-500" />
        <span>
          Linked to Slack member <code className="rounded bg-muted px-1 font-mono text-xs">{slackUserId}</code>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1 text-xs text-muted-foreground"
          disabled={pending}
          onClick={() => run(() => unlinkMySlack(), "Unlinked")}
        >
          <Unlink className="size-3.5" /> Unlink
        </Button>
      </div>
    );
  const link = (input?: string) =>
    run(async () => {
      const res = await linkMySlack(input);
      if (res.status === "linked") toast.success("Slack account linked");
      else if (res.status === "confirm-sent") {
        toast.success("Check Slack: Internal sent you a message to confirm.");
        setOther("");
      } else toast.error(input ? "No Slack member with that email or ID." : "No Slack member has your email. Try your Slack email below.");
    });
  return (
    <div className="space-y-2">
      <Button size="sm" className="gap-1.5" disabled={pending || !live} onClick={() => link()}>
        <Link2 className="size-4" /> Link my Slack account
      </Button>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Different email in Slack? Enter it, or your member ID (U…):</span>
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="you@example.com or U0123ABCD"
            className={field}
          />
        </label>
        <Button size="sm" variant="outline" className="h-9" disabled={pending || !live || !other.trim()} onClick={() => link(other)}>
          Send confirmation
        </Button>
      </div>
    </div>
  );
}

function RuleEditor({
  draft,
  setDraft,
  channels,
  projects,
  pending,
  onSave,
  onCancel,
}: {
  draft: RuleDraft;
  setDraft: (d: RuleDraft) => void;
  channels: SlackChannelOption[];
  projects: ProjectOption[];
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const problem = draftProblem(draft);
  const chosen = channels.find((c) => c.id === draft.channelId);
  return (
    <div className="mb-4 rounded-xl border p-4">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Channel</span>
          <select value={draft.channelId} onChange={(e) => setDraft({ ...draft, channelId: e.target.value })} className={field}>
            <option value="">Pick a channel…</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isPrivate ? "🔒 " : "#"}
                {c.name}
                {c.isMember ? "" : " (invite @Internal)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Project</span>
          <select
            value={draft.projectId ?? ""}
            onChange={(e) => setDraft({ ...draft, projectId: e.target.value || null })}
            className={field}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {chosen && !chosen.isMember && (
        <p className="-mt-2 mb-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          {chosen.isPrivate ? <Lock className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
          Internal isn&apos;t in #{chosen.name} yet — type /invite @Internal there.
        </p>
      )}
      {channels.length === 0 && (
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          No channels to show. Invite @Internal to a channel in Slack, then reload.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {SLACK_EVENT_GROUPS.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{g.label}</legend>
            <div className="space-y-1">
              {g.events.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.events.includes(e.id)}
                    onChange={() => setDraft(toggleEvent(draft, e.id))}
                    className="size-4 accent-brand"
                  />
                  {e.label}
                </label>
              ))}
              {g.id === "sales" && draft.events.includes("prospect.stage_changed") && (
                <label className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
                  from
                  <select
                    value={draft.minProspectStage ?? ""}
                    onChange={(ev) => setDraft({ ...draft, minProspectStage: ev.target.value || null })}
                    className="h-7 rounded-md border bg-background px-1.5 text-xs"
                  >
                    <option value="">any stage</option>
                    {PROSPECT_STAGE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s} and later
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {problem && <span className="mr-auto text-xs text-muted-foreground">{problem}</span>}
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={pending || Boolean(problem)}>
          {draft.id ? "Save" : "Add channel"}
        </Button>
      </div>
    </div>
  );
}

/** The original one-channel Incoming Webhook, kept for workspaces without the bot. */
function LegacyWebhook({
  connected,
  pending,
  run,
}: {
  connected: boolean;
  pending: boolean;
  run: (fn: () => Promise<unknown>, ok?: string) => void;
}) {
  const [url, setUrl] = useState("");
  return (
    <details className="mt-10 rounded-xl border p-4 text-sm">
      <summary className="cursor-pointer font-medium marker:text-muted-foreground">
        Simple incoming webhook {connected ? "· connected" : ""}
      </summary>
      <p className="mt-2 mb-3 text-muted-foreground">
        Before the bot: one Incoming Webhook URL that gets a line for each new task and notification. Leave it empty if
        the bot is set up.
      </p>
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
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            aria-label="Incoming Webhook URL"
            className={cn(field, "flex-1")}
          />
          <Button size="sm" className="h-9" disabled={pending || !url.trim()} onClick={() => run(() => setSlackWebhook(url), "Slack connected")}>
            Connect
          </Button>
        </div>
      )}
    </details>
  );
}
