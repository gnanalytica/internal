import { PROSPECT_KINDS, type ProspectKind } from "@/lib/prospects/schema";
import { isConfidentialDepartment } from "@/lib/departments";
import { parseIssueKey, type IssueKey } from "./parse";

/**
 * Which app record an internal.gnanalytica.com link points at, and how much of
 * it a Slack preview may show. Pure (links.test.ts); handlers/unfurl.ts reads
 * the record and builds the card.
 *
 * The URL shapes are the app's own:
 *   /issues/<uuid>                       a task (a key, /issues/VAL-12, works too)
 *   /projects/<uuid>[/<area>]            a project, or one of its tabs
 *   /projects/<uuid>/sales?rec=<k>:<id>  a Valytica prospect (also /prospects?rec=…)
 *   /projects/<uuid>/sales?deal=<uuid>   a deal
 *   /pages/<uuid>                        a doc page
 */

export type AppLink =
  | { type: "issue"; id: string }
  | { type: "issue_key"; key: IssueKey }
  | { type: "project"; id: string; area: string | null }
  | { type: "page"; id: string }
  | { type: "prospect"; ref: string; kind: ProspectKind; id: string }
  | { type: "deal"; id: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s);

/** "valuer:IBBI/RV/02/2019/1" → its kind and sheet id, or null. */
export function parseProspectRef(ref: string): { kind: ProspectKind; id: string } | null {
  const i = ref.indexOf(":");
  if (i <= 0) return null;
  const kind = ref.slice(0, i);
  const id = ref.slice(i + 1).trim();
  if (!id || !(PROSPECT_KINDS as readonly string[]).includes(kind)) return null;
  return { kind: kind as ProspectKind, id };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * The record a link points at, or null when it isn't one of the app's record
 * pages (or isn't on one of `hosts`).
 */
export function parseAppLink(raw: string, hosts: readonly string[]): AppLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!hosts.includes(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split("/").filter(Boolean).map(safeDecode);
  const rec = url.searchParams.get("rec");
  const prospect = rec ? parseProspectRef(rec) : null;

  switch (parts[0]) {
    case "issues": {
      const x = parts[1];
      if (!x) return null;
      if (isUuid(x)) return { type: "issue", id: x.toLowerCase() };
      const key = parseIssueKey(x);
      return key ? { type: "issue_key", key } : null;
    }
    case "pages":
      return parts[1] && isUuid(parts[1]) ? { type: "page", id: parts[1].toLowerCase() } : null;
    case "prospects":
      return prospect && rec ? { type: "prospect", ref: rec, ...prospect } : null;
    case "projects": {
      const id = parts[1];
      if (!id || !isUuid(id)) return null;
      if (prospect && rec) return { type: "prospect", ref: rec, ...prospect };
      const deal = url.searchParams.get("deal");
      if (deal && isUuid(deal)) return { type: "deal", id: deal.toLowerCase() };
      return { type: "project", id: id.toLowerCase(), area: parts[2] ?? null };
    }
    default:
      return null;
  }
}

/** The hostnames links are recognised on: production's, plus wherever this deployment lives. */
export function appHosts(appUrl: string): string[] {
  const hosts = new Set(["internal.gnanalytica.com"]);
  try {
    hosts.add(new URL(appUrl).hostname.toLowerCase());
  } catch {
    // appUrl is always absolute; nothing to add if it isn't.
  }
  return [...hosts];
}

/* ---------- what a preview may show ---------- */


/** Whether a link is to something the web app keeps from members. */
export function isConfidentialLink(link: AppLink, inConfidentialProject: boolean): boolean {
  if (inConfidentialProject) return true;
  // The web's department rule (Finance today); owners also see Finance, but not in a shared channel.
  if (link.type === "project" && link.area && isConfidentialDepartment(link.area)) return true;
  return false;
}

/** Who shared the link, as the app knows them. */
export type LinkSharer = { linked: false } | { linked: true; isAdmin: boolean };

/**
 * How much a preview shows. An unfurl is seen by everyone in the channel, so it
 * follows the stricter rule: someone Slack can't place in the app gets the
 * title only; a member gets the full card unless the record is confidential
 * (Finance, a confidential project), which only an admin unfurls in full.
 */
export function unfurlDetail(sharer: LinkSharer, confidential: boolean): "full" | "title" {
  if (!sharer.linked) return "title";
  if (confidential && !sharer.isAdmin) return "title";
  return "full";
}
