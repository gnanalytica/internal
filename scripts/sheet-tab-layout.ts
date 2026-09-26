/**
 * Group the spreadsheet's 18 tabs into four blocks: order them, colour them,
 * and optionally hide the reference-data ones.
 *
 * The complaint was "too many tabs", and the count is not really the problem —
 * documentation, live dashboards, master data, reference lookups and research
 * working-state all sit in one flat strip with nothing telling them apart, so
 * every tab competes equally for attention.
 *
 * Nothing here is destructive and nothing is renamed. Hiding is safe for the
 * app: `listTabs` asks only for title/sheetId/gridProperties and never filters
 * on `hidden`, so a hidden tab still syncs and still feeds every formula, and
 * nothing in the codebase reads a tab by position. A hidden tab comes back with
 * a right-click on the tab strip.
 *
 * `pnpm sheet:tab-layout` — dry run, prints the before and after strip.
 *   `--apply`     write it
 *   `--no-hide`   colour and reorder only; hide nothing
 *   `--hide-meta` also hide README and Scoring Model (read once, never again)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";

const APPLY = process.argv.includes("--apply");
const NO_HIDE = process.argv.includes("--no-hide");
const HIDE_META = process.argv.includes("--hide-meta");

type Group = {
  name: string;
  color: { red: number; green: number; blue: number };
  swatch: string;
  hide: boolean;
  tabs: string[];
};

const GROUPS: Group[] = [
  {
    name: "Work",
    swatch: "green",
    color: { red: 0.06, green: 0.53, blue: 0.42 },
    hide: false,
    tabs: ["People", "Companies", "Priority Dashboard"],
  },
  {
    name: "Research loop",
    swatch: "amber",
    color: { red: 0.85, green: 0.6, blue: 0.13 },
    hide: false,
    tabs: ["Research Queue", "Prospect Intelligence", "Deep Dive Dossiers", "GTM Personas"],
  },
  {
    // Read by the app, opened by hand about never. 8 of the 18.
    name: "Reference data",
    swatch: "grey",
    color: { red: 0.6, green: 0.63, blue: 0.65 },
    hide: !NO_HIDE,
    tabs: [
      "IOV Memberships",
      "Lender Contacts",
      "Lender Landscape",
      "Association Officers",
      "RVOs",
      "Referral Map",
      "Source Inventory",
      "Exclusions",
    ],
  },
  {
    // Summary is a live dashboard and stays visible even under --hide-meta;
    // README and Scoring Model are read once.
    name: "Meta",
    swatch: "blue",
    color: { red: 0.26, green: 0.52, blue: 0.96 },
    hide: false,
    tabs: ["Summary", "README", "Scoring Model"],
  },
];

const HIDE_ALWAYS_VISIBLE = new Set(["Summary"]);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json() as Promise<T>;
}

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const meta = await api<{
    sheets: { properties: { sheetId: number; title: string; index: number; hidden?: boolean } }[];
  }>(`${spreadsheetId}?fields=sheets.properties(sheetId,title,index,hidden)`);

  const live = meta.sheets.map((s) => s.properties);
  const byTitle = new Map(live.map((p) => [p.title, p]));

  // Refuse rather than guess: a tab this plan does not name would be silently
  // left wherever the reordering pushed it.
  const planned = GROUPS.flatMap((g) => g.tabs);
  const missing = planned.filter((t) => !byTitle.has(t));
  const unplanned = live.map((p) => p.title).filter((t) => !planned.includes(t));
  if (missing.length) throw new Error(`Plan names tabs that do not exist: ${missing.join(", ")}`);
  if (unplanned.length) {
    throw new Error(
      `These tabs exist but the plan does not place them: ${unplanned.join(", ")}. ` +
        `Add them to a group before running.`,
    );
  }

  console.log("BEFORE — the strip as it is today");
  console.log("-".repeat(60));
  for (const p of [...live].sort((a, b) => a.index - b.index)) {
    console.log(`  ${String(p.index).padStart(2)}  ${p.title}${p.hidden ? "   (hidden)" : ""}`);
  }

  console.log("\nAFTER — proposed");
  console.log("-".repeat(60));
  const requests: Record<string, unknown>[] = [];
  let index = 0;
  let moved = 0,
    hidden = 0,
    coloured = 0;

  for (const g of GROUPS) {
    console.log(`\n  ${g.name}  [${g.swatch}]${g.hide ? "  — hidden" : ""}`);
    for (const title of g.tabs) {
      const p = byTitle.get(title)!;
      const wantHidden = (g.hide || (HIDE_META && g.name === "Meta" && !HIDE_ALWAYS_VISIBLE.has(title))) && true;
      const notes: string[] = [];
      if (p.index !== index) {
        notes.push(`moves ${p.index} → ${index}`);
        moved++;
      }
      if (Boolean(p.hidden) !== wantHidden) {
        notes.push(wantHidden ? "HIDE" : "unhide");
        hidden++;
      }
      coloured++;
      console.log(
        `    ${String(index).padStart(2)}  ${title.padEnd(24)}${notes.length ? "  " + notes.join(", ") : ""}`,
      );

      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: p.sheetId,
            index,
            hidden: wantHidden,
            tabColorStyle: { rgbColor: g.color },
          },
          fields: "index,hidden,tabColorStyle",
        },
      });
      index++;
    }
  }

  const visible = GROUPS.flatMap((g) =>
    g.tabs.filter((t) => !(g.hide || (HIDE_META && g.name === "Meta" && !HIDE_ALWAYS_VISIBLE.has(t)))),
  );
  console.log(
    `\n${live.length} tabs → ${visible.length} visible` +
      `  (${moved} moved, ${hidden} hidden/unhidden, ${coloured} recoloured)`,
  );
  console.log(`visible strip: ${visible.join(" · ")}`);

  if (!APPLY) {
    console.log(`\nDry run — ${requests.length} request(s). Re-run with --apply.`);
    return;
  }

  await api(`${spreadsheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  console.log(`\n✓ applied ${requests.length} request(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
