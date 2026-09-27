/**
 * Build the seven-tab GTM model from scratch.
 *
 * The model, and the one business question behind it — get a registered valuer
 * finalising reports on Valytica:
 *
 *   Valuers            the market. One row per individual. Everything else
 *                      exists to reach this tab.
 *   Firms              a firm is a multi-valuer deal, sold once to its proprietor.
 *   Lenders            not customers. They hold the panel lists, and a bank that
 *                      recommends us reaches its whole panel at once.
 *   RVOs & Associations the highest leverage per row in the workbook — a dozen
 *                      bodies whose membership is most of the market.
 *   Contacts           a named human at a lender or a body who is not a valuer.
 *   Outreach           one row per touch, append-only.
 *   Guide              the vocabularies and the stage definitions.
 *
 * Two rules the whole thing rests on. **A noun tab never holds an event**: the
 * moment "when did we last email them" becomes a column, it can only hold the
 * most recent one and the history is gone — hence Outreach. And **an id is
 * never reused or renumbered**, because every link in here is an id and a
 * renumber silently repoints it at someone else.
 *
 * Purely additive: it creates tabs and writes headers. It does not read, move,
 * modify or delete a single existing tab — migrating data into these is a
 * separate step, per tab, with its own judgement calls.
 *
 * `pnpm sheet:build-gtm-model` to see the plan, `--apply` to write it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAccessToken } from "../src/lib/sheet-crm/google-auth";

const APPLY = process.argv.includes("--apply");

/** Closed vocabularies. A dropdown is the only foreign key a spreadsheet has. */
const V = {
  asset_class: ["Land & Building", "Plant & Machinery", "Securities or Financial Assets"],
  stage: ["Not contacted", "Contacted", "Replied", "Demo done", "Trial", "Paying", "Lost", "Do not pursue"],
  role_at_firm: ["Proprietor", "Partner", "Director", "Employee", "Independent"],
  current_tool: ["None", "Word", "Excel", "Rival software", "In-house", "Unknown"],
  yes_no: ["Yes", "No"],
  yes_no_unknown: ["Yes", "No", "Unknown"],
  language: ["English", "Hindi", "Telugu", "Kannada", "Tamil", "Malayalam", "Marathi", "Gujarati", "Bengali", "Other"],
  constitution: ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "Other"],
  lender_type: ["Bank", "HFC", "NBFC", "ARC", "Co-operative bank", "Government", "Insurance", "Other"],
  ownership: ["PSU", "Private", "Foreign", "Co-operative", "Government"],
  empanelment_open: ["Open", "Closed", "Periodic window", "Unknown"],
  relationship_stage: ["None", "Intro made", "In talks", "Pilot", "Partner", "Declined"],
  partnership_stage: ["None", "Member", "Speaking slot", "Co-marketing", "Endorsed", "Declined"],
  body_type: ["RVO", "Association", "Institute"],
  decision_role: ["Decider", "Influencer", "Gatekeeper", "Unknown"],
  strength: ["Cold", "Warm", "Champion"],
  org_type: ["Lender", "RVO", "Association", "Firm", "Other"],
  channel: ["Email", "Call", "WhatsApp", "LinkedIn", "Event", "Meeting", "Referral", "Other"],
  direction: ["Outbound", "Inbound"],
  outcome: ["No reply", "Replied", "Meeting booked", "Not interested", "Wrong contact", "Bounced", "Signed up"],
  target_type: ["Valuer", "Firm", "Lender", "Body", "Contact"],
  state: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu & Kashmir", "Ladakh",
    "Puducherry", "Chandigarh", "Andaman & Nicobar", "Dadra & Nagar Haveli and Daman & Diu", "Lakshadweep",
  ],
} as const;

type Tab = {
  title: string;
  purpose: string;
  rows: number;
  colour: [number, number, number];
  columns: string[];
  /** header -> vocabulary key */
  validate?: Record<string, keyof typeof V>;
  dates?: string[];
};

const TABS: Tab[] = [
  {
    title: "Valuers",
    purpose: "The market. One row per individual registered valuer.",
    rows: 10000,
    colour: [0.13, 0.42, 0.35],
    columns: [
      "valuer_id", "full_name", "ibbi_reg_no", "asset_class", "registered_since",
      "email", "phone", "whatsapp", "city", "state", "preferred_language",
      "firm_id", "role_at_firm", "empanelled_lenders", "est_reports_per_month", "current_tool", "rvo",
      "stage", "owner", "next_action", "next_action_date", "lost_reason",
      "signed_up", "product_org_id",
      "do_not_contact", "source", "notes",
    ],
    validate: {
      asset_class: "asset_class", whatsapp: "yes_no_unknown", state: "state",
      preferred_language: "language", role_at_firm: "role_at_firm", current_tool: "current_tool",
      stage: "stage", signed_up: "yes_no", do_not_contact: "yes_no",
    },
    dates: ["next_action_date"],
  },
  {
    title: "Firms",
    purpose: "A multi-valuer deal, sold once to its proprietor.",
    rows: 2000,
    colour: [0.13, 0.42, 0.35],
    columns: [
      "firm_id", "firm_name", "constitution", "ibbi_entity_reg_no", "city", "state",
      "num_valuers", "asset_classes", "email", "phone", "website",
      "decision_maker_valuer_id", "empanelled_lenders", "est_reports_per_month",
      "stage", "owner", "next_action", "next_action_date",
      "do_not_contact", "source", "notes",
    ],
    validate: { constitution: "constitution", state: "state", stage: "stage", do_not_contact: "yes_no" },
    dates: ["next_action_date"],
  },
  {
    title: "Lenders",
    purpose: "Not customers. They hold the panel lists and can recommend us to a whole panel.",
    rows: 500,
    colour: [0.16, 0.32, 0.55],
    columns: [
      "lender_id", "lender_name", "lender_type", "ownership", "panel_size_est",
      "empanelment_page_url", "empanelment_open", "valuation_volume_signal",
      "relationship_stage", "primary_contact_id", "our_angle",
      "owner", "next_action", "next_action_date", "source", "notes",
    ],
    validate: {
      lender_type: "lender_type", ownership: "ownership",
      empanelment_open: "empanelment_open", relationship_stage: "relationship_stage",
    },
    dates: ["next_action_date"],
  },
  {
    title: "RVOs & Associations",
    purpose: "Highest leverage per row: a dozen bodies whose membership is most of the market.",
    rows: 200,
    colour: [0.16, 0.32, 0.55],
    columns: [
      "body_id", "body_name", "acronym", "type", "parent_body", "member_count", "states_covered",
      "website", "email", "phone", "primary_contact_id", "cpe_event_cadence",
      "partnership_stage", "our_angle", "owner", "next_action", "next_action_date", "source", "notes",
    ],
    validate: { type: "body_type", partnership_stage: "partnership_stage" },
    dates: ["next_action_date"],
  },
  {
    title: "Contacts",
    purpose: "A named human at a lender or a body who is not a valuer.",
    rows: 2000,
    colour: [0.16, 0.32, 0.55],
    columns: [
      "contact_id", "name", "org_id", "org_type", "title", "decision_role",
      "email", "phone", "linkedin", "city", "relationship_strength", "do_not_contact", "source", "notes",
    ],
    validate: { org_type: "org_type", decision_role: "decision_role", relationship_strength: "strength", do_not_contact: "yes_no" },
  },
  {
    title: "Outreach",
    purpose: "One row per touch. Append-only — never edit a row, add the next one.",
    rows: 20000,
    colour: [0.55, 0.38, 0.12],
    columns: [
      "outreach_id", "date", "target_id", "target_type", "channel", "direction",
      "summary", "outcome", "by", "next_action_date",
    ],
    validate: { target_type: "target_type", channel: "channel", direction: "direction", outcome: "outcome" },
    dates: ["date", "next_action_date"],
  },
  {
    title: "Guide",
    purpose: "The vocabularies and the stage definitions. Reference only.",
    rows: 300,
    colour: [0.42, 0.42, 0.42],
    columns: ["section", "term", "definition"],
  },
];

/** Seeded so the dropdowns have somewhere to be explained. */
const GUIDE: string[][] = [
  ["Rule", "One row per real thing", "A row is one person, one firm, one institution. A firm is not a person; several people are not one row."],
  ["Rule", "Ids are permanent", "An id is never reused and never renumbered. Every link here is an id, and a renumber repoints it at somebody else."],
  ["Rule", "Nouns hold no events", "Never add last_contacted to a noun tab — it can only hold the most recent touch and the history is gone. Events go in Outreach."],
  ["Rule", "Outreach is append-only", "Correcting a touch means adding the next row, not editing the last one."],
  ["Rule", "Blank is a fact", "Blank means nobody has looked. It never means zero, none, or not applicable — write those words if you mean them."],
  ["", "", ""],
  ["Valuers", "est_reports_per_month", "The best qualifier in the workbook: at the per-report price this IS revenue. A guess is fine; the order of magnitude is what matters."],
  ["Valuers", "role_at_firm", "Only a Proprietor, Partner or Director buys. An Employee is a user, not a decision."],
  ["Valuers", "signed_up / product_org_id", "The only columns that say whether any of this worked. Without them the sheet and the product never reconcile."],
  ["Valuers", "empanelled_lenders", "Semicolon-separated lender_ids. Count of banks is a volume proxy — more panels means more valuations means more pain we remove."],
  ["Lenders", "panel_size_est", "How many valuers this lender puts us in front of. It is why a lender is worth a row at all."],
  ["Lenders", "ownership", "PSU panel lists are public and large; private ones usually are not. It decides whether this is a research job or a relationship job."],
  ["RVOs & Associations", "member_count", "The leverage. One body can carry more valuers than a year of cold outreach."],
  ["RVOs & Associations", "cpe_event_cadence", "The actual ask. Bodies must run continuing-education sessions and are short of speakers; a slot beats five hundred emails."],
  ["", "", ""],
  ["Stage", "Not contacted", "On the list, nothing sent."],
  ["Stage", "Contacted", "We reached out. No reply yet."],
  ["Stage", "Replied", "They answered. Any answer that is not a no."],
  ["Stage", "Demo done", "They have seen the product."],
  ["Stage", "Trial", "Using it, not paying."],
  ["Stage", "Paying", "Money has moved."],
  ["Stage", "Lost", "Said no, or went cold after a reply. Fill lost_reason."],
  ["Stage", "Do not pursue", "We decided not to sell to them. Different from Lost, which was their decision."],
];

const letter = (i: number) => {
  let s = "", n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

async function main() {
  const spreadsheetId = process.env.VALYTICA_CRM_SHEET_ID;
  if (!spreadsheetId) throw new Error("VALYTICA_CRM_SHEET_ID is not set");

  const token = await getAccessToken();
  const api = async (body: unknown) => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`batchUpdate ${res.status}: ${(await res.text()).slice(0, 400)}`);
    return res.json() as Promise<{ replies: { addSheet?: { properties: { sheetId: number; title: string } } }[] }>;
  };
  const values = async (data: { range: string; values: string[][] }[]) => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
    if (!res.ok) throw new Error(`values:batchUpdate ${res.status}: ${(await res.text()).slice(0, 400)}`);
  };
  const meta = async () =>
    (await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()) as { sheets: { properties: { sheetId: number; title: string } }[] };

  const existing = new Set((await meta()).sheets.map((s) => s.properties.title));

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — seven tabs, additive only\n`);
  for (const t of TABS) {
    const clash = existing.has(t.title);
    console.log(`${clash ? "SKIP (exists)" : "CREATE"}  ${t.title.padEnd(20)} ${String(t.columns.length).padStart(2)} cols  ${t.purpose}`);
    if (!clash && t.validate) {
      const missing = Object.keys(t.validate).filter((h) => !t.columns.includes(h));
      if (missing.length) throw new Error(`${t.title}: validated column not in columns: ${missing.join(", ")}`);
    }
    if (!clash && t.dates) {
      const missing = t.dates.filter((h) => !t.columns.includes(h));
      if (missing.length) throw new Error(`${t.title}: date column not in columns: ${missing.join(", ")}`);
    }
  }

  const todo = TABS.filter((t) => !existing.has(t.title));
  if (!todo.length) { console.log("\nnothing to create"); return; }
  if (!APPLY) { console.log(`\n${todo.length} tab(s) would be created. Re-run with --apply.`); return; }

  // Phase 1 — create the grids. New tabs go to the front, so the model leads the
  // workbook and the legacy tabs sit behind it; nothing existing is modified.
  const created = await api({
    requests: todo.map((t, i) => ({
      addSheet: {
        properties: {
          title: t.title,
          index: i,
          gridProperties: { rowCount: t.rows, columnCount: t.columns.length, frozenRowCount: 1, frozenColumnCount: 1 },
          tabColorStyle: { rgbColor: { red: t.colour[0], green: t.colour[1], blue: t.colour[2] } },
        },
      },
    })),
  });
  const ids = new Map<string, number>();
  created.replies.forEach((r) => { if (r.addSheet) ids.set(r.addSheet.properties.title, r.addSheet.properties.sheetId); });

  // Phase 2 — headers, and the Guide's seeded body.
  const data: { range: string; values: string[][] }[] = todo.map((t) => ({
    range: `'${t.title}'!A1:${letter(t.columns.length - 1)}1`,
    values: [t.columns],
  }));
  if (ids.has("Guide")) data.push({ range: `'Guide'!A2:C${GUIDE.length + 1}`, values: GUIDE });
  await values(data);

  // Phase 3 — header style, widths, dropdowns, date formats.
  const requests: unknown[] = [];
  for (const t of todo) {
    const sheetId = ids.get(t.title);
    if (sheetId === undefined) continue;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColorStyle: { rgbColor: { red: 0.93, green: 0.94, blue: 0.93 } },
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColorStyle,verticalAlignment)",
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: t.columns.length },
        properties: { pixelSize: 170 },
        fields: "pixelSize",
      },
    });
    for (const [header, key] of Object.entries(t.validate ?? {})) {
      const col = t.columns.indexOf(header);
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
          rule: {
            condition: { type: "ONE_OF_LIST", values: (V[key] as readonly string[]).map((v) => ({ userEnteredValue: v })) },
            showCustomUi: true,
            // Not strict: a value we have not thought of must be enterable, with a
            // warning, or the sheet starts refusing facts about the real world.
            strict: false,
          },
        },
      });
    }
    for (const header of t.dates ?? []) {
      const col = t.columns.indexOf(header);
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd-mm-yyyy" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }
  }
  const guideId = ids.get("Guide");
  if (guideId !== undefined) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: guideId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 700 },
        fields: "pixelSize",
      },
    });
  }
  await api({ requests });

  console.log(`\ncreated ${todo.length} tab(s): ${todo.map((t) => t.title).join(", ")}`);
  console.log(`Guide seeded with ${GUIDE.filter((r) => r[0]).length} entries`);
  console.log("\nNo existing tab was read, moved or changed. Migrating data in is the next step, one tab at a time.");
}

main().catch((e) => { console.error(e); process.exit(1); });
