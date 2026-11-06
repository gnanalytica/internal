/**
 * What people type at the bot, read without any I/O: the `/internal`
 * subcommands, task keys, and Slack's message markup. Pure, so the rules can
 * be unit-tested (parse.test.ts).
 */

export type IssueKey = { projectKey: string; number: number };

export type InternalCommand =
  | { kind: "help" }
  | { kind: "new"; title: string }
  | { kind: "search"; query: string }
  | { kind: "mine" }
  | { kind: "issue"; key: IssueKey }
  | { kind: "prospect"; query: string };

/** "VAL-123", "val-7" — a project key (letters, then letters or digits) and a number. */
const KEY_RE = /^([A-Za-z][A-Za-z0-9]{0,9})-(\d{1,7})$/;

export function parseIssueKey(input: string): IssueKey | null {
  const m = KEY_RE.exec(input.trim());
  if (!m) return null;
  const number = Number(m[2]);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  return { projectKey: m[1].toUpperCase(), number };
}

export const formatIssueKey = (k: IssueKey): string => `${k.projectKey}-${k.number}`;

/**
 * `/internal …`. Nothing (or `help`) is help; a known word is its subcommand;
 * a lone task key opens that task; anything else is a search, so
 * `/internal login loop` does what it looks like.
 */
export function parseCommand(text: string): InternalCommand {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return { kind: "help" };
  const sp = t.indexOf(" ");
  const head = (sp < 0 ? t : t.slice(0, sp)).toLowerCase();
  const rest = sp < 0 ? "" : t.slice(sp + 1).trim();
  switch (head) {
    case "help":
    case "?":
      return { kind: "help" };
    case "new":
    case "create":
      return { kind: "new", title: rest };
    case "search":
    case "find":
      return rest ? { kind: "search", query: rest } : { kind: "help" };
    case "mine":
    case "me":
    case "my":
      return { kind: "mine" };
    case "prospect":
    case "prospects":
      return rest ? { kind: "prospect", query: rest } : { kind: "help" };
  }
  const key = sp < 0 ? parseIssueKey(t) : null;
  if (key) return { kind: "issue", key };
  return { kind: "search", query: t };
}

/* ---------- Slack message markup ---------- */

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">" };

/**
 * Slack's mrkdwn as plain Markdown: `<url|label>` → `[label](url)`, `<url>` →
 * url, `<#C123|general>` → #general, `<!here>` → @here, a user mention to
 * `@name` when `names` knows them (else `@someone`), and the three escaped
 * characters back. Used for task descriptions and comments made from Slack.
 */
export function slackToMarkdown(text: string, names: ReadonlyMap<string, string> = new Map()): string {
  const out = text.replace(/<([^<>]+)>/g, (_, inner: string) => {
    const bar = inner.indexOf("|");
    const target = bar < 0 ? inner : inner.slice(0, bar);
    const label = bar < 0 ? "" : inner.slice(bar + 1);
    if (target.startsWith("@")) {
      const id = target.slice(1);
      return `@${names.get(id) ?? (label || "someone")}`;
    }
    if (target.startsWith("#")) return `#${label || target.slice(1)}`;
    if (target.startsWith("!subteam^")) return `@${label.replace(/^@/, "") || "group"}`;
    if (target.startsWith("!")) {
      const word = target.slice(1).split("^")[0];
      return ["here", "channel", "everyone"].includes(word) ? `@${word}` : label || "";
    }
    return label && label !== target ? `[${label}](${target})` : target;
  });
  return out.replace(/&(amp|lt|gt);/g, (m) => ENTITIES[m] ?? m);
}

/** The Slack user ids mentioned in a message (`<@U123>`), so their names can be looked up. */
export function mentionedSlackUsers(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)) ids.add(m[1]);
  return [...ids];
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * A task title from a message: its first non-empty line, with Markdown links
 * reduced to their labels and emphasis marks dropped, clipped to fit.
 */
export function titleFromText(markdown: string, max = 120): string {
  const line =
    markdown
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const plain = line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[>#\-*•\s]+/, "")
    .replace(/[*_~`]/g, "")
    .trim();
  return clip(plain, max);
}

/**
 * The rows whose name (or id) matches a typed query, best first: an exact
 * name, then a name starting with it, then a word starting with it, then the
 * name containing it anywhere. Ties keep their order.
 */
export function rankByName<T extends { name: string; id: string }>(rows: readonly T[], query: string, limit = 5): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (r: T): number => {
    const n = r.name.trim().toLowerCase();
    if (n === q || r.id.toLowerCase() === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[\s,.&()-]+/).some((w) => w.startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return -1;
  };
  return rows
    .map((r, i) => ({ r, i, s: score(r) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.r);
}
