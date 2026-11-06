import { SLACK_RULE_PRESETS, isSlackEventType, type SlackEventType } from "./events";

/**
 * The channel-rule editor's state on Settings › Slack, and how a preset or a
 * saved rule becomes one. Pure, so the settings component stays a view.
 */

export type RuleDraft = {
  id?: string;
  channelId: string;
  projectId: string | null;
  events: SlackEventType[];
  minProspectStage: string | null;
};

export const emptyDraft = (): RuleDraft => ({ channelId: "", projectId: null, events: [], minProspectStage: null });

/** A saved rule, ready to edit. Unknown event ids (from a newer deploy) are dropped. */
export function draftFromRule(rule: {
  id: string;
  slackChannelId: string;
  projectId: string | null;
  events: string[];
  filters: { minProspectStage?: string } | null;
}): RuleDraft {
  return {
    id: rule.id,
    channelId: rule.slackChannelId,
    projectId: rule.projectId,
    events: rule.events.filter(isSlackEventType),
    minProspectStage: rule.filters?.minProspectStage ?? null,
  };
}

/**
 * A preset, resolved against this workspace: its channel by name among those
 * the bot can see (left blank to pick when it isn't there), and its project by
 * key (all projects when the workspace has no such project).
 */
export function draftFromPreset(
  presetId: string,
  channels: { id: string; name: string }[],
  projects: { id: string; key: string }[],
): RuleDraft | null {
  const p = SLACK_RULE_PRESETS.find((x) => x.id === presetId);
  if (!p) return null;
  return {
    channelId: channels.find((c) => c.name === p.channelName)?.id ?? "",
    projectId: p.projectKey ? (projects.find((x) => x.key === p.projectKey)?.id ?? null) : null,
    events: [...p.events],
    minProspectStage: p.filters.minProspectStage ?? null,
  };
}

/** Toggle one event in a draft, keeping the catalogue's order out of it (order doesn't matter). */
export function toggleEvent(draft: RuleDraft, event: SlackEventType): RuleDraft {
  const has = draft.events.includes(event);
  const events = has ? draft.events.filter((e) => e !== event) : [...draft.events, event];
  return {
    ...draft,
    events,
    // The stage filter only means something while prospect events are on.
    minProspectStage: events.includes("prospect.stage_changed") ? draft.minProspectStage : null,
  };
}

/** Why a draft can't be saved yet, or null when it can. */
export function draftProblem(draft: RuleDraft): string | null {
  if (!draft.channelId) return "Pick a channel.";
  if (draft.events.length === 0) return "Pick at least one event.";
  return null;
}
