import { daysBetween, dueBucket, inFocus, isAssignedTo, isOpen, myTasks, type ProspectRow } from "./stats";

/**
 * The morning Slack nudge: who has prospect follow-ups due today or overdue.
 *
 * The point is a habit — open Today every morning — so the message is short:
 * one block per person, a handful of names, and a link. People with nothing
 * due are left out rather than told so, and a day when nobody has anything
 * posts nothing at all.
 *
 * Pure: rows, people and today are passed in, so the grouping and the text are
 * unit-tested without the sheet, the database or Slack.
 */

/** How many follow-ups each person's block names before "+N more". */
export const TOP_ITEMS = 5;

export type ReminderItem = {
  name: string;
  nextStep: string;
  /** The next-step date, yyyy-mm-dd; always on or before today. */
  date: string;
  overdue: boolean;
};

export type ReminderPerson = {
  person: string;
  overdue: number;
  today: number;
  /** Oldest first, as the Today page orders them. */
  top: ReminderItem[];
};

export type Reminder = {
  today: string;
  people: ReminderPerson[];
  /** Open follow-ups that are due with nobody's name on them. */
  unassigned: { overdue: number; today: number };
  /**
   * Whether anything counted sits outside the focus states, which the Today
   * page hides by default — the link then opens All India so the counts match.
   */
  outsideFocus: boolean;
};

/**
 * Group due follow-ups by person. `people` is the workspace's members by the
 * name the team writes in `assigned`; anyone the sheet names who isn't a member
 * (an intern without an account) gets a block too, by the name as written.
 * Each row lands in one block only, even when two names share a first name.
 */
export function buildReminder(input: { rows: ProspectRow[]; people: string[]; today: string }): Reminder {
  const { rows, today } = input;
  const named = [...input.people, ...rows.map((r) => r.assigned.trim()).filter(Boolean)];
  // Members come first, so "Sandeep Kumar" from the workspace wins over a bare
  // "sandeep" typed in the sheet.
  const people = named.filter((p, i) => named.findIndex((o) => isAssignedTo(o, p)) === i);

  const claimed = new Set<string>();
  let outsideFocus = false;
  const blocks: ReminderPerson[] = [];
  for (const person of people) {
    const due = myTasks(rows, person, today).filter((t) => t.reason !== "new" && !claimed.has(key(t.row)));
    if (!due.length) continue;
    for (const t of due) {
      claimed.add(key(t.row));
      if (!inFocus(t.row)) outsideFocus = true;
    }
    blocks.push({
      person,
      overdue: due.filter((t) => t.reason === "overdue").length,
      today: due.filter((t) => t.reason === "today").length,
      top: due.slice(0, TOP_ITEMS).map(({ row, reason }) => ({ name: row.name, nextStep: row.nextStep, date: row.nextStepDate!, overdue: reason === "overdue" })),
    });
  }

  const unassigned = { overdue: 0, today: 0 };
  for (const r of rows) {
    if (r.assigned.trim() || !isOpen(r)) continue;
    const bucket = dueBucket(r.nextStepDate, today);
    if (bucket !== "overdue" && bucket !== "today") continue;
    unassigned[bucket] += 1;
    if (!inFocus(r)) outsideFocus = true;
  }

  // Most overdue first: the person furthest behind is the one the nudge is for.
  blocks.sort((a, b) => b.overdue - a.overdue || b.today - a.today || a.person.localeCompare(b.person));
  return { today, people: blocks, unassigned, outsideFocus };
}

const key = (r: ProspectRow) => `${r.kind}:${r.id}`;

/** Slack mrkdwn treats these three as control characters in plain text. */
export function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu 5 Nov" for a yyyy-mm-dd date. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function counts(overdue: number, today: number): string {
  return [overdue && `${overdue} overdue`, today && `${today} due today`].filter(Boolean).join(", ");
}

function itemLine(item: ReminderItem, today: string): string {
  const late = daysBetween(item.date, today);
  const when = item.overdue ? `${late}d overdue` : "today";
  const step = item.nextStep.trim() ? ` — ${escapeMrkdwn(item.nextStep.trim())}` : "";
  return `• ${escapeMrkdwn(item.name)}${step} _(${when})_`;
}

/**
 * The Slack message (mrkdwn), or null when nobody has anything due — a quiet
 * day posts nothing rather than a "nothing to do" that trains people to skip it.
 * `prospectsUrl` is the absolute URL of the prospects page the link opens —
 * Valytica's Sales tab, linked directly rather than through the `/prospects`
 * redirect. `mention` renders a person's name; it defaults to bold, and is
 * where a Slack `<@U123>` mention would go if the app ever stores Slack user
 * IDs.
 */
export function reminderText(
  reminder: Reminder,
  prospectsUrl: string,
  mention: (person: string) => string = (p) => `*${escapeMrkdwn(p)}*`,
): string | null {
  const { people, unassigned, today } = reminder;
  if (!people.length && !unassigned.overdue && !unassigned.today) return null;

  const blocks = people.map((p) => {
    const lines = [`${mention(p.person)} — ${counts(p.overdue, p.today)}`, ...p.top.map((i) => itemLine(i, today))];
    const more = p.overdue + p.today - p.top.length;
    if (more > 0) lines.push(`_+${more} more_`);
    return lines.join("\n");
  });
  if (unassigned.overdue || unassigned.today) {
    blocks.push(`*Unassigned* — ${counts(unassigned.overdue, unassigned.today)}, nobody's name on them yet`);
  }

  const link = `${prospectsUrl}${reminder.outsideFocus ? "?scope=all" : ""}`;
  return [`:sunrise: *Prospect follow-ups for ${shortDate(today)}*`, ...blocks, `<${link}|Open Today in Prospects →>`].join("\n\n");
}
