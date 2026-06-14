import { and, eq } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Provision the Sales / Marketing / CRM layer (the Product × Department matrix)
 * for an existing Gnanalytica workspace: the Sales & Marketing teams, the
 * bespoke CRM/Sales/Marketing records (accounts, contacts, deals, campaigns,
 * content) scoped to products, and a "Sales & Marketing Playbook" wiki page.
 *
 * Idempotent: skips anything already present, so it is safe to run on a live
 * hub and is also invoked from seed-org.ts for fresh installs. Records are
 * attached to products (projects) by name where those products exist.
 */

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

/** Workspace admins, provisioned (idempotently) on both fresh and live hubs. */
export const ADMINS = [
  { name: "Sandeep", email: "sandeep@gnanalytica.com", avatarColor: "#5e6ad2" },
  { name: "Jayasaagar", email: "jayasaagar@gnanalytica.com", avatarColor: "#0ea5e9" },
];

/**
 * Ensure each admin has a user row and an admin membership in the workspace.
 * Matched by email on first login, so seeding the membership ahead of time
 * lands them straight in this workspace as an admin. Idempotent: existing
 * members are upgraded to admin, never duplicated.
 */
export async function ensureWorkspaceAdmins(
  wsId: string,
  admins: { name: string; email: string; avatarColor?: string }[] = ADMINS,
) {
  for (const a of admins) {
    let [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, a.email))
      .limit(1);
    if (!user) {
      [user] = await db
        .insert(schema.users)
        .values({ name: a.name, email: a.email, avatarColor: a.avatarColor ?? "#6366f1" })
        .returning({ id: schema.users.id });
    }
    await db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: wsId, userId: user.id, role: "admin" })
      .onConflictDoUpdate({
        target: [schema.workspaceMembers.workspaceId, schema.workspaceMembers.userId],
        set: { role: "admin" },
      });
  }
}

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

  // ---- CRM / Sales / Marketing records (keyed on "any deal exists") ----
  const existingDeal = await db
    .select({ id: schema.deals.id })
    .from(schema.deals)
    .where(eq(schema.deals.workspaceId, ws.id))
    .limit(1);

  if (!existingDeal[0]) {
    // Map products (projects) by name so records can be attached to them.
    const products = await db
      .select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(eq(schema.projects.workspaceId, ws.id));
    const productId = (name: string) =>
      products.find((p) => p.name === name)?.id ?? null;

    // Accounts (shared CRM layer).
    const accountRows = await db
      .insert(schema.crmAccounts)
      .values([
        { workspaceId: ws.id, name: "Apollo Hospitals", website: "https://apollohospitals.com", industry: "Health", type: "prospect", entity: "India", ownerId: owner.id },
        { workspaceId: ws.id, name: "Mumbai Valuers LLP", industry: "Real Estate", type: "customer", entity: "India", ownerId: owner.id },
        { workspaceId: ws.id, name: "Erasmus MC", website: "https://erasmusmc.nl", industry: "Health", type: "prospect", entity: "Netherlands", ownerId: owner.id },
      ])
      .returning();
    const accId = (name: string) => accountRows.find((a) => a.name === name)!.id;

    // Contacts (shared CRM layer).
    await db.insert(schema.crmContacts).values([
      { workspaceId: ws.id, accountId: accId("Apollo Hospitals"), name: "Dr. Reddy", email: "reddy@apollo.example", title: "Chief of Cardiology", lifecycleStage: "qualified", entity: "India", ownerId: owner.id },
      { workspaceId: ws.id, accountId: accId("Mumbai Valuers LLP"), name: "Anita Sharma", email: "anita@mumbaivaluers.example", title: "Managing Partner", lifecycleStage: "customer", entity: "India", ownerId: owner.id },
      { workspaceId: ws.id, accountId: accId("Erasmus MC"), name: "Jan de Vries", email: "jan@erasmusmc.example", title: "Research Lead", lifecycleStage: "lead", entity: "Netherlands", ownerId: owner.id },
    ]);

    // Deals (Sales, product-scoped). sortKey orders within a pipeline column.
    const dealRows = await db
      .insert(schema.deals)
      .values([
        { workspaceId: ws.id, productId: productId("Healthytica"), accountId: accId("Apollo Hospitals"), name: "Apollo — Healthytica pilot", stage: "proposal", value: 12000, entity: "India", ownerId: owner.id, sortKey: "a0" },
        { workspaceId: ws.id, productId: productId("Valytica"), accountId: accId("Mumbai Valuers LLP"), name: "Mumbai Valuers — Valytica annual", stage: "won", value: 8000, entity: "India", ownerId: owner.id, sortKey: "a0" },
        { workspaceId: ws.id, productId: productId("Healthytica"), accountId: accId("Erasmus MC"), name: "Erasmus MC — Healthytica eval", stage: "qualified", value: 20000, entity: "Netherlands", ownerId: owner.id, sortKey: "a0" },
        { workspaceId: ws.id, productId: productId("AI Workshop"), accountId: accId("Apollo Hospitals"), name: "Apollo — Workshop cohort", stage: "lead", value: 5000, entity: "India", ownerId: owner.id, sortKey: "a1" },
      ])
      .returning();

    // A couple of activities on the lead deal.
    const pilot = dealRows.find((d) => d.name === "Apollo — Healthytica pilot");
    if (pilot) {
      await db.insert(schema.crmActivities).values([
        { workspaceId: ws.id, dealId: pilot.id, accountId: pilot.accountId, productId: pilot.productId, type: "call", body: "Intro call — strong interest from cardiology.", actorId: owner.id },
        { workspaceId: ws.id, dealId: pilot.id, accountId: pilot.accountId, productId: pilot.productId, type: "email", body: "Sent proposal v1 for the 3-month pilot.", actorId: owner.id },
      ]);
    }

    // Campaigns (Marketing, product-scoped) + content.
    const campaignRows = await db
      .insert(schema.campaigns)
      .values([
        { workspaceId: ws.id, productId: productId("Healthytica"), name: "FY26 LinkedIn — Healthytica", channel: "linkedin", status: "active", budget: 3000, entity: "Global", ownerId: owner.id },
        { workspaceId: ws.id, productId: productId("Valytica"), name: "Valuer webinar series", channel: "events", status: "planned", budget: 1500, entity: "India", ownerId: owner.id },
      ])
      .returning();
    const linkedin = campaignRows.find((c) => c.name === "FY26 LinkedIn — Healthytica");

    await db.insert(schema.contentItems).values([
      { workspaceId: ws.id, productId: productId("Healthytica"), campaignId: linkedin?.id ?? null, title: "Biomarker explainer thread", channel: "linkedin", status: "published", ownerId: owner.id },
      { workspaceId: ws.id, productId: productId("Healthytica"), campaignId: linkedin?.id ?? null, title: "Customer story: cardiology pilot", channel: "content", status: "draft", ownerId: owner.id },
      { workspaceId: ws.id, productId: productId("Valytica"), title: "Webinar landing page", channel: "content", status: "idea", ownerId: owner.id },
    ]);

    // Finance: invoices + expenses (product-level revenue tracking).
    await db.insert(schema.invoices).values([
      { workspaceId: ws.id, productId: productId("Valytica"), accountId: accId("Mumbai Valuers LLP"), number: "INV-001", status: "paid", amount: 8000, entity: "India", ownerId: owner.id },
      { workspaceId: ws.id, productId: productId("Healthytica"), accountId: accId("Apollo Hospitals"), number: "INV-002", status: "sent", amount: 6000, entity: "India", ownerId: owner.id },
    ]);
    await db.insert(schema.expenses).values([
      { workspaceId: ws.id, productId: productId("Healthytica"), vendor: "Vercel", category: "infra", amount: 200, status: "paid", entity: "Global", ownerId: owner.id },
      { workspaceId: ws.id, productId: productId("Valytica"), vendor: "Design contractor", category: "contractors", amount: 1500, status: "planned", entity: "India", ownerId: owner.id },
    ]);

    // Support: a couple of tickets.
    await db.insert(schema.tickets).values([
      { workspaceId: ws.id, productId: productId("Healthytica"), accountId: accId("Apollo Hospitals"), subject: "Report PDF export is blank", status: "open", priority: "high", requesterEmail: "reddy@apollo.example", entity: "India", assigneeId: owner.id, sortKey: "a0" },
      { workspaceId: ws.id, productId: productId("Valytica"), accountId: accId("Mumbai Valuers LLP"), subject: "Add bulk valuation import", status: "pending", priority: "normal", requesterEmail: "anita@mumbaivaluers.example", entity: "India", assigneeId: owner.id, sortKey: "a0" },
    ]);
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
      p("Go-to-market lives in the Product × Department matrix. Each product has its own Sales and Marketing sections, and the top-level Sales / Marketing pages roll the same records up across all products."),
      h(2, "Pipeline stages (Deals)"),
      bullets([
        "Lead — identified, not yet engaged.",
        "Qualified — fit + budget confirmed.",
        "Proposal — proposal/quote sent.",
        "Negotiation — terms in discussion.",
        "Won — closed and signed.",
        "Lost — closed, no deal.",
      ]),
      h(2, "How the two lenses link"),
      bullets([
        "Every deal/campaign carries a product — that link is the matrix.",
        "Product lens: Products → a product → Sales/Marketing shows only its records.",
        "Department lens: top-level Sales/Marketing shows every product together.",
        "Accounts & contacts are a shared CRM layer both Sales and Marketing read from.",
      ]),
      h(2, "What the hub holds vs. what stays external"),
      bullets([
        "Hub (build): accounts, contacts, deals, pipeline, campaigns, content — your coordination data.",
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
