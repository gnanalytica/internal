import { and, eq } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Provision the Sales / Marketing / CRM layer for an existing Gnanalytica
 * workspace: the Sales & Marketing teams plus the Entity-tagged CRM databases
 * (Accounts, Contacts, Deals, Campaigns) and a "Sales & Marketing Playbook"
 * wiki page.
 *
 * Idempotent: skips teams/databases/page that already exist, so it is safe to
 * run on a live hub and is also invoked from seed-org.ts for fresh installs.
 */

// ---- shared option sets ----
type Opt = { label: string; color: string };
const ENTITY: Opt[] = [
  { label: "India", color: "#f59e0b" },
  { label: "Netherlands", color: "#f97316" },
  { label: "Global", color: "#94a3b8" },
];
const PRODUCTS: Opt[] = [
  { label: "Healthytica", color: "#10b981" },
  { label: "Valytica", color: "#6366f1" },
  { label: "AI Workshop", color: "#a855f7" },
];

// ---- tiny TipTap helpers (kept local so this module is self-contained) ----
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
const p = (text?: string): Node => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});
const h = (level: number, text: string): Node => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const bullets = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const doc = (...nodes: Node[]): Node => ({ type: "doc", content: nodes });
const plain = (n: Node): string =>
  n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(plain).join(" ");

type FieldDef = {
  name: string;
  type: string;
  options?: Opt[];
  relationTo?: string; // database name this relation field links to
};

export async function seedCrm(ws: { id: string }, owner: { id: string }) {
  // ---- Teams (insert only the ones missing) ----
  const existingTeams = await db
    .select({ name: schema.teams.name })
    .from(schema.teams)
    .where(eq(schema.teams.workspaceId, ws.id));
  const haveTeam = new Set(existingTeams.map((t) => t.name));
  const newTeams = [
    { workspaceId: ws.id, name: "Sales", key: "SAL", icon: "📈", color: "#0ea5e9" },
    { workspaceId: ws.id, name: "Marketing", key: "MKT", icon: "📣", color: "#f43f5e" },
  ].filter((t) => !haveTeam.has(t.name));
  if (newTeams.length) await db.insert(schema.teams).values(newTeams);

  // ---- CRM databases ----
  // Skip the whole block if it has already been provisioned (keyed on "Deals").
  const existingDbs = await db
    .select({ id: schema.databases.id, name: schema.databases.name })
    .from(schema.databases)
    .where(eq(schema.databases.workspaceId, ws.id));
  const crmAlreadySeeded = existingDbs.some((d) => d.name === "Deals");

  if (!crmAlreadySeeded) {
    // Create the four database shells first so relation fields can resolve their
    // target ids before any fields are inserted.
    const dbIds: Record<string, string> = {};
    for (const [name, icon] of [
      ["Accounts", "🏢"],
      ["Contacts", "👤"],
      ["Deals", "💰"],
      ["Campaigns", "📣"],
    ] as const) {
      const [d] = await db
        .insert(schema.databases)
        .values({ workspaceId: ws.id, name, icon })
        .returning();
      dbIds[name] = d.id;
    }

    // field id lookup: fieldId[dbName][fieldName]
    const fieldId: Record<string, Record<string, string>> = {};
    async function addFields(dbName: string, fields: FieldDef[]) {
      const inserted = await db
        .insert(schema.databaseFields)
        .values(
          fields.map((f, i) => ({
            databaseId: dbIds[dbName],
            name: f.name,
            type: f.type,
            options: f.type === "select" ? (f.options ?? []) : null,
            relationDatabaseId: f.relationTo ? dbIds[f.relationTo] : null,
            position: `a${i}`,
          })),
        )
        .returning();
      fieldId[dbName] = Object.fromEntries(inserted.map((f) => [f.name, f.id]));
    }

    await addFields("Accounts", [
      { name: "Name", type: "text" },
      { name: "Website", type: "url" },
      { name: "Industry", type: "select", options: [
        { label: "Health", color: "#10b981" },
        { label: "Real Estate", color: "#6366f1" },
        { label: "Education", color: "#a855f7" },
        { label: "Finance", color: "#f59e0b" },
        { label: "Other", color: "#94a3b8" },
      ] },
      { name: "Type", type: "select", options: [
        { label: "Prospect", color: "#6366f1" },
        { label: "Customer", color: "#10b981" },
        { label: "Partner", color: "#a855f7" },
        { label: "Churned", color: "#ef4444" },
      ] },
      { name: "Owner", type: "text" },
      { name: "Entity", type: "select", options: ENTITY },
      { name: "Deals", type: "relation", relationTo: "Deals" },
    ]);

    await addFields("Contacts", [
      { name: "Name", type: "text" },
      { name: "Email", type: "email" },
      { name: "Title", type: "text" },
      { name: "Phone", type: "text" },
      { name: "Account", type: "relation", relationTo: "Accounts" },
      { name: "Owner", type: "text" },
      { name: "Entity", type: "select", options: ENTITY },
    ]);

    await addFields("Deals", [
      { name: "Name", type: "text" },
      { name: "Account", type: "relation", relationTo: "Accounts" },
      { name: "Stage", type: "select", options: [
        { label: "Lead", color: "#94a3b8" },
        { label: "Qualified", color: "#6366f1" },
        { label: "Proposal", color: "#a855f7" },
        { label: "Negotiation", color: "#f59e0b" },
        { label: "Won", color: "#10b981" },
        { label: "Lost", color: "#ef4444" },
      ] },
      { name: "Value", type: "number" },
      { name: "Product", type: "select", options: PRODUCTS },
      { name: "Owner", type: "text" },
      { name: "Expected close", type: "date" },
      { name: "Entity", type: "select", options: ENTITY },
    ]);

    await addFields("Campaigns", [
      { name: "Name", type: "text" },
      { name: "Channel", type: "select", options: [
        { label: "Email", color: "#6366f1" },
        { label: "LinkedIn", color: "#0ea5e9" },
        { label: "Events", color: "#a855f7" },
        { label: "Content", color: "#10b981" },
        { label: "Paid", color: "#f59e0b" },
        { label: "Referral", color: "#ec4899" },
      ] },
      { name: "Status", type: "select", options: [
        { label: "Planned", color: "#94a3b8" },
        { label: "Active", color: "#10b981" },
        { label: "Done", color: "#6366f1" },
      ] },
      { name: "Start date", type: "date" },
      { name: "End date", type: "date" },
      { name: "Budget", type: "number" },
      { name: "Owner", type: "text" },
      { name: "Entity", type: "select", options: ENTITY },
    ]);

    // Rollup on Accounts: total pipeline = sum of related Deals' Value.
    await db.insert(schema.databaseFields).values({
      databaseId: dbIds["Accounts"],
      name: "Pipeline value",
      type: "rollup",
      config: {
        relationFieldId: fieldId["Accounts"]["Deals"],
        targetFieldId: fieldId["Deals"]["Value"],
        fn: "sum",
      },
      position: "a7",
    });

    // ---- Rows (cell values are keyed by field id; relations hold row-id arrays) ----
    const f = (dbName: string, field: string) => fieldId[dbName][field];

    // Accounts first so contacts/deals can point at them.
    const accountSeed = [
      { Name: "Apollo Hospitals", Website: "https://apollohospitals.com", Industry: "Health", Type: "Prospect", Owner: "Sandeep", Entity: "India" },
      { Name: "Mumbai Valuers LLP", Industry: "Real Estate", Type: "Customer", Owner: "Sandeep", Entity: "India" },
      { Name: "Erasmus MC", Website: "https://erasmusmc.nl", Industry: "Health", Type: "Prospect", Owner: "Sandeep", Entity: "Netherlands" },
    ];
    const accountRows = await db
      .insert(schema.databaseRows)
      .values(
        accountSeed.map((a, i) => ({
          databaseId: dbIds["Accounts"],
          position: `a${i}`,
          values: Object.fromEntries(
            Object.entries(a).map(([k, v]) => [f("Accounts", k), v]),
          ),
        })),
      )
      .returning();
    const accountId = new Map(
      accountRows.map((r) => [
        String((r.values as Record<string, unknown>)[f("Accounts", "Name")]),
        r.id,
      ]),
    );

    // Contacts → Account relation.
    const contactSeed = [
      { Name: "Dr. Reddy", Email: "reddy@apollo.example", Title: "Chief of Cardiology", Account: "Apollo Hospitals", Owner: "Sandeep", Entity: "India" },
      { Name: "Anita Sharma", Email: "anita@mumbaivaluers.example", Title: "Managing Partner", Account: "Mumbai Valuers LLP", Owner: "Sandeep", Entity: "India" },
      { Name: "Jan de Vries", Email: "jan@erasmusmc.example", Title: "Research Lead", Account: "Erasmus MC", Owner: "Sandeep", Entity: "Netherlands" },
    ];
    await db.insert(schema.databaseRows).values(
      contactSeed.map((c, i) => ({
        databaseId: dbIds["Contacts"],
        position: `a${i}`,
        values: {
          [f("Contacts", "Name")]: c.Name,
          [f("Contacts", "Email")]: c.Email,
          [f("Contacts", "Title")]: c.Title,
          [f("Contacts", "Account")]: [accountId.get(c.Account)],
          [f("Contacts", "Owner")]: c.Owner,
          [f("Contacts", "Entity")]: c.Entity,
        },
      })),
    );

    // Deals → Account relation; capture ids per account for the reverse link.
    const dealSeed = [
      { Name: "Apollo — Healthytica pilot", Account: "Apollo Hospitals", Stage: "Proposal", Value: 12000, Product: "Healthytica", Owner: "Sandeep", "Expected close": "2026-08-15", Entity: "India" },
      { Name: "Mumbai Valuers — Valytica annual", Account: "Mumbai Valuers LLP", Stage: "Won", Value: 8000, Product: "Valytica", Owner: "Sandeep", "Expected close": "2026-05-01", Entity: "India" },
      { Name: "Erasmus MC — Healthytica eval", Account: "Erasmus MC", Stage: "Qualified", Value: 20000, Product: "Healthytica", Owner: "Sandeep", "Expected close": "2026-09-30", Entity: "Netherlands" },
      { Name: "Apollo — Workshop cohort", Account: "Apollo Hospitals", Stage: "Lead", Value: 5000, Product: "AI Workshop", Owner: "Sandeep", "Expected close": "2026-10-01", Entity: "India" },
    ];
    const dealRows = await db
      .insert(schema.databaseRows)
      .values(
        dealSeed.map((d, i) => ({
          databaseId: dbIds["Deals"],
          position: `a${i}`,
          values: {
            [f("Deals", "Name")]: d.Name,
            [f("Deals", "Account")]: [accountId.get(d.Account)],
            [f("Deals", "Stage")]: d.Stage,
            [f("Deals", "Value")]: d.Value,
            [f("Deals", "Product")]: d.Product,
            [f("Deals", "Owner")]: d.Owner,
            [f("Deals", "Expected close")]: d["Expected close"],
            [f("Deals", "Entity")]: d.Entity,
          },
        })),
      )
      .returning();

    // Reverse-link each Account's "Deals" relation so the rollup can sum them.
    const dealsByAccount = new Map<string, string[]>();
    for (const r of dealRows) {
      const acc = ((r.values as Record<string, unknown>)[f("Deals", "Account")] as string[])?.[0];
      if (!acc) continue;
      dealsByAccount.set(acc, [...(dealsByAccount.get(acc) ?? []), r.id]);
    }
    for (const a of accountRows) {
      const linked = dealsByAccount.get(a.id);
      if (!linked) continue;
      await db
        .update(schema.databaseRows)
        .set({
          values: { ...(a.values as Record<string, unknown>), [f("Accounts", "Deals")]: linked },
        })
        .where(eq(schema.databaseRows.id, a.id));
    }

    // Campaigns.
    const campaignSeed = [
      { Name: "FY26 LinkedIn — Healthytica", Channel: "LinkedIn", Status: "Active", "Start date": "2026-04-01", Budget: 3000, Owner: "Sandeep", Entity: "Global" },
      { Name: "Valuer webinar series", Channel: "Events", Status: "Planned", "Start date": "2026-07-01", Budget: 1500, Owner: "Sandeep", Entity: "India" },
    ];
    await db.insert(schema.databaseRows).values(
      campaignSeed.map((c, i) => ({
        databaseId: dbIds["Campaigns"],
        position: `a${i}`,
        values: Object.fromEntries(
          Object.entries(c).map(([k, v]) => [f("Campaigns", k), v]),
        ),
      })),
    );
  }

  // ---- Wiki: Sales & Marketing Playbook (under Company Handbook if present) ----
  const existingPage = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(and(eq(schema.pages.workspaceId, ws.id), eq(schema.pages.title, "Sales & Marketing Playbook")))
    .limit(1);
  if (!existingPage[0]) {
    const handbook = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(and(eq(schema.pages.workspaceId, ws.id), eq(schema.pages.title, "Company Handbook")))
      .limit(1);
    const content = doc(
      h(1, "Sales & Marketing Playbook"),
      p("How we run go-to-market in the hub. The CRM here is the system-of-record for accounts, contacts, deals and campaigns; outbound sending stays in dedicated tools."),
      h(2, "Pipeline stages (Deals)"),
      bullets([
        "Lead — identified, not yet engaged.",
        "Qualified — fit + budget confirmed.",
        "Proposal — proposal/quote sent.",
        "Negotiation — terms in discussion.",
        "Won — closed and signed.",
        "Lost — closed, no deal.",
      ]),
      h(2, "Flow"),
      bullets([
        "Capture a company in Accounts and its people in Contacts.",
        "Open a Deal linked to the Account; move it across stages on the board.",
        "Track demand-gen in Campaigns; attribute the source on the Account.",
        "Account → Pipeline value rolls up the sum of its open deals automatically.",
      ]),
      h(2, "What the hub holds vs. what stays external"),
      bullets([
        "Hub (build): accounts, contacts, deals, pipeline, campaigns — your coordination data.",
        "External (buy): Apollo-style email sequencing and HubSpot-style marketing email sending; integrate via a connector if needed, don't replicate here.",
      ]),
      h(2, "Entity convention"),
      p("Tag every account, deal and campaign with Entity (India 🇮🇳 / Netherlands 🇳🇱 / Global) so cross-border pipeline can be filtered and invoiced from the right legal entity."),
    );
    await db.insert(schema.pages).values({
      workspaceId: ws.id,
      parentId: handbook[0]?.id ?? null,
      title: "Sales & Marketing Playbook",
      icon: "📈",
      content,
      contentText: plain(content).slice(0, 20000),
      creatorId: owner.id,
      position: "z0",
    });
  }
}
