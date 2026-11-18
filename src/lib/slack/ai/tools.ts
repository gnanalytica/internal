import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { PRIORITIES, STATUSES } from "@/lib/constants";
import { CHANNELS, DIRECTIONS, OUTCOMES, PROSPECT_KINDS, STAGES } from "@/lib/prospects/schema";

/**
 * The bot's tools: what the model is told (a JSON schema per tool, sent with
 * `strict: true` so the API holds the model to it) and what the server then
 * checks (a Zod schema per tool, with the limits strict mode can't express —
 * lengths, date shapes). Pure, so both halves are tested together and can't
 * drift.
 *
 * Inputs are small (a title, a status, a few lines), so they're left to the
 * API's buffered, validated tool-input streaming rather than
 * `eager_input_streaming`: there's no large parameter whose arrival would be
 * worth giving up server-side validation for.
 *
 * Each tool also says who may use it (`access`) and what it does (`effect`):
 * reads run at once, `write` runs at once and replies with the record's card,
 * and `confirm` changes an existing record only after the person who asked
 * clicks Confirm.
 */

export type ToolAccess = "anyone" | "linked";
export type ToolEffect = "read" | "write" | "confirm";

const STATUS_IDS = STATUSES.map((s) => s.id) as [string, ...string[]];
const PRIORITY_IDS = PRIORITIES.map((p) => p.id) as [string, ...string[]];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a yyyy-mm-dd date.");
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional();

/* ---------- JSON schema helpers (what the model sees) ---------- */

type JsonProp = Record<string, unknown>;
const s = (description: string): JsonProp => ({ type: "string", description });
const e = (values: readonly string[], description: string): JsonProp => ({ type: "string", enum: [...values], description });
const i = (description: string): JsonProp => ({ type: "integer", description });
const list = (description: string): JsonProp => ({ type: "array", items: { type: "string" }, description });

function objectSchema(properties: Record<string, JsonProp>, required: string[] = []): Anthropic.Tool.InputSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

const TASK_REF = "The task: its key as shown in Internal (e.g. VAL-12), its link, or its id.";
const PROJECT_REF = "A project's key (e.g. VAL) or name.";
const PERSON_REF = 'A teammate\'s name or email, or "me" for the person asking.';
const PROSPECT_REF = "The prospect: its registration number / ID from the sheet, or its exact name.";

/* ---------- the tools ---------- */

export const TOOL_SPECS = {
  search_tasks: {
    access: "anyone",
    effect: "read",
    label: "Searching tasks",
    description:
      "Find tasks in Internal. Use it whenever someone asks what tasks exist, who is on something, or what is in a status — " +
      "and to find a task's key before changing it. All filters are optional and combine.",
    input_schema: objectSchema({
      text: s("Words to look for in the task title."),
      project: s(PROJECT_REF),
      status: e([...STATUS_IDS, "open"], '"open" means anything not done or canceled.'),
      assignee: s(`${PERSON_REF} "unassigned" for tasks nobody owns.`),
      limit: i("How many to return, 1-20 (default 10)."),
    }),
    schema: z.strictObject({
      text: optText(200),
      project: optText(100),
      status: z.enum([...STATUS_IDS, "open"]).optional(),
      assignee: optText(200),
      limit: z.number().int().min(1).max(20).optional(),
    }),
  },
  get_task: {
    access: "anyone",
    effect: "read",
    label: "Reading the task",
    description: "Read one task in full: status, priority, assignee, project, due date, description and its latest comments.",
    input_schema: objectSchema({ task: s(TASK_REF) }, ["task"]),
    schema: z.strictObject({ task: text(500) }),
  },
  create_task: {
    access: "linked",
    effect: "write",
    label: "Creating the task",
    description:
      "Create a task in Internal when someone asks you to make, file or add one. It's created straight away as the person asking, " +
      "and they get its card — so only call it once you know the title. Leave out anything they didn't say.",
    input_schema: objectSchema(
      {
        title: s("A short, specific title."),
        description: s("Markdown. What needs doing and why, if they said."),
        project: s(PROJECT_REF),
        assignee: s(PERSON_REF),
        priority: e(PRIORITY_IDS, "Only if they said how urgent it is."),
        status: e(STATUS_IDS, "Defaults to backlog."),
        labels: list("Label names that already exist in Internal."),
        due_date: s("yyyy-mm-dd."),
      },
      ["title"],
    ),
    schema: z.strictObject({
      title: text(300),
      description: optText(8000),
      project: optText(100),
      assignee: optText(200),
      priority: z.enum(PRIORITY_IDS).optional(),
      status: z.enum(STATUS_IDS).optional(),
      labels: z.array(text(60)).max(10).optional(),
      due_date: isoDay.optional(),
    }),
  },
  update_task: {
    access: "linked",
    effect: "confirm",
    label: "Preparing the change",
    description:
      "Change an existing task's status, assignee, priority, title or due date. This does NOT change it yet: the person asking " +
      "gets Confirm / Cancel buttons, and the change happens only when they confirm. Say so; never say it's done.",
    input_schema: objectSchema(
      {
        task: s(TASK_REF),
        status: e(STATUS_IDS, "The new status."),
        assignee: s(`${PERSON_REF} "unassigned" to clear it.`),
        priority: e(PRIORITY_IDS, "The new priority."),
        title: s("The new title."),
        due_date: s('yyyy-mm-dd, or "none" to clear it.'),
      },
      ["task"],
    ),
    schema: z
      .strictObject({
        task: text(500),
        status: z.enum(STATUS_IDS).optional(),
        assignee: optText(200),
        priority: z.enum(PRIORITY_IDS).optional(),
        title: optText(300),
        due_date: z.union([isoDay, z.literal("none")]).optional(),
      })
      .refine((v) => [v.status, v.assignee, v.priority, v.title, v.due_date].some((x) => x !== undefined && x !== ""), {
        message: "Say what to change: status, assignee, priority, title or due_date.",
      }),
  },
  comment_on_task: {
    access: "linked",
    effect: "write",
    label: "Commenting",
    description: "Add a comment to a task as the person asking. It's posted straight away.",
    input_schema: objectSchema({ task: s(TASK_REF), body: s("The comment, in Markdown.") }, ["task", "body"]),
    schema: z.strictObject({ task: text(500), body: text(4000) }),
  },
  search_prospects: {
    access: "linked",
    effect: "read",
    label: "Searching prospects",
    description:
      "Find Valytica prospects (valuers, firms, RVOs, bank panel valuers, bank contacts) in the prospects sheet: " +
      "by name, city or ID, stage, who it's assigned to, or follow-ups that are due.",
    input_schema: objectSchema({
      text: s("Words to match in the name, city, firm or ID."),
      kind: e(PROSPECT_KINDS, "Only this type of prospect."),
      stage: e(STAGES, "Only prospects at this stage."),
      assigned: s(PERSON_REF),
      due: e(["overdue", "today", "week"], "Only prospects whose next step is overdue, due today, or due within a week."),
      limit: i("How many to return, 1-20 (default 10)."),
    }),
    schema: z.strictObject({
      text: optText(200),
      kind: z.enum(PROSPECT_KINDS).optional(),
      stage: z.enum(STAGES).optional(),
      assigned: optText(200),
      due: z.enum(["overdue", "today", "week"]).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
  },
  get_prospect: {
    access: "linked",
    effect: "read",
    label: "Reading the prospect",
    description: "Read one prospect: stage, next step, last touch, what they said on recent calls and messages, objections, contact routes.",
    input_schema: objectSchema({ prospect: s(PROSPECT_REF), kind: e(PROSPECT_KINDS, "Its type, if known.") }, ["prospect"]),
    schema: z.strictObject({ prospect: text(200), kind: z.enum(PROSPECT_KINDS).optional() }),
  },
  log_touch: {
    access: "linked",
    effect: "confirm",
    label: "Preparing the touch",
    description:
      "Log a call, message or meeting with a prospect: how, what they said, the outcome, and the follow-up. This does NOT log it yet: " +
      "the person asking gets Confirm / Cancel buttons. Say so; never say it's logged.",
    input_schema: objectSchema(
      {
        prospect: s(PROSPECT_REF),
        kind: e(PROSPECT_KINDS, "Its type, if known."),
        channel: e(CHANNELS, "How they were reached."),
        direction: e(DIRECTIONS, "Defaults to Outbound."),
        outcome: e(OUTCOMES, "What happened."),
        what_they_said: s("A short summary of what they said."),
        stage_after: e(STAGES, "The stage after this touch, if it moved. Leave out to keep the current stage."),
        next_step: s("The follow-up, if any."),
        next_step_date: s("When the follow-up is due, yyyy-mm-dd."),
        duration_min: i("Call or meeting length in minutes."),
      },
      ["prospect", "channel", "outcome", "what_they_said"],
    ),
    schema: z.strictObject({
      prospect: text(200),
      kind: z.enum(PROSPECT_KINDS).optional(),
      channel: z.enum(CHANNELS),
      direction: z.enum(DIRECTIONS).optional(),
      outcome: z.enum(OUTCOMES),
      what_they_said: z.string().trim().max(2000),
      stage_after: z.enum(STAGES).optional(),
      next_step: optText(500),
      next_step_date: isoDay.optional(),
      duration_min: z.number().int().min(0).max(600).optional(),
    }),
  },
  summarize_thread_to_task: {
    access: "linked",
    effect: "write",
    label: "Turning the thread into a task",
    description:
      "Turn the Slack thread you're in into a task, when someone asks to capture, file or track what the thread is about. " +
      "Write the title and the key points from the thread yourself; the thread's link is added for you, and the thread is " +
      "linked to the task so later updates reply here. Created straight away.",
    input_schema: objectSchema(
      {
        title: s("A short, specific title for the work the thread is about."),
        summary: s("One or two sentences: the problem or request."),
        key_points: list("The decisions, facts and asks from the thread, one per item."),
        project: s(PROJECT_REF),
        assignee: s(PERSON_REF),
        priority: e(PRIORITY_IDS, "Only if the thread says how urgent it is."),
      },
      ["title", "summary", "key_points"],
    ),
    schema: z.strictObject({
      title: text(300),
      summary: z.string().trim().max(2000),
      key_points: z.array(text(500)).max(15),
      project: optText(100),
      assignee: optText(200),
      priority: z.enum(PRIORITY_IDS).optional(),
    }),
  },
  get_my_work: {
    access: "linked",
    effect: "read",
    label: "Reading your work",
    description: "The person asking's open tasks (overdue and due soon first) and their prospect follow-ups due today or overdue.",
    input_schema: objectSchema({}),
    schema: z.strictObject({}),
  },
  project_status: {
    access: "anyone",
    effect: "read",
    label: "Reading the project",
    description: "A project's state: open, in progress, in review and blocked counts, overdue tasks, and what got done in the last 7 days.",
    input_schema: objectSchema({ project: s(PROJECT_REF) }, ["project"]),
    schema: z.strictObject({ project: text(100) }),
  },
} as const satisfies Record<
  string,
  { access: ToolAccess; effect: ToolEffect; label: string; description: string; input_schema: Anthropic.Tool.InputSchema; schema: z.ZodType }
>;

export type ToolName = keyof typeof TOOL_SPECS;
export type ToolInput<N extends ToolName> = z.output<(typeof TOOL_SPECS)[N]["schema"]>;

export const TOOL_NAMES = Object.keys(TOOL_SPECS) as ToolName[];

export const isToolName = (v: string): v is ToolName => Object.hasOwn(TOOL_SPECS, v);

/** The tool definitions for the API, in a fixed order (the order is part of the cached prefix). */
export function toolDefinitions(names: readonly ToolName[]): Anthropic.Tool[] {
  return TOOL_NAMES.filter((n) => names.includes(n)).map((name) => ({
    name,
    description: TOOL_SPECS[name].description,
    input_schema: TOOL_SPECS[name].input_schema,
    strict: true,
  }));
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Check a tool call's input on the server. Strict mode already holds the
 * model to the JSON schema; this adds the limits it can't express, and is
 * what stands between a malformed call and the database either way.
 */
export function parseToolInput<N extends ToolName>(name: N, input: unknown): Parsed<ToolInput<N>> {
  const r = (TOOL_SPECS[name].schema as z.ZodType).safeParse(input);
  if (r.success) return { ok: true, value: r.data as ToolInput<N> };
  const issue = r.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return { ok: false, error: `${where}${issue?.message ?? "Invalid input."}` };
}
