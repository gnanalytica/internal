import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db, schema } from "./index";
import { ensureWorkspaceAdmins, seedCrm } from "./seed-crm-data";

/**
 * Provision the Gnanalytica company hub structure (per docs/ORG.md):
 * workspace, owner membership, initiatives, projects, Entity-tagged
 * databases, and a wiki skeleton. Safe to run once on an empty DB; exits if the
 * workspace already exists.
 *
 * Run: npm run db:seed-org
 */

const OWNER_EMAIL = "sandeep@gnanalytica.com";
const OWNER_NAME = "Sandeep";

// ---- tiny TipTap helpers ----
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

const ENTITY = [
  { label: "India", color: "#f59e0b" },
  { label: "Netherlands", color: "#f97316" },
  { label: "Global", color: "#94a3b8" },
];

async function main() {
  const existing = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "gnanalytica"))
    .limit(1);
  if (existing[0]) {
    console.log("Gnanalytica workspace already exists — syncing admins only.");
    await ensureWorkspaceAdmins(existing[0].id);
    return;
  }

  console.log("Provisioning Gnanalytica hub…");

  const [ws] = await db
    .insert(schema.workspaces)
    .values({ name: "Gnanalytica", slug: "gnanalytica" })
    .returning();

  // Owner (matched by email on first login → lands straight in this workspace).
  let [owner] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, OWNER_EMAIL))
    .limit(1);
  if (!owner) {
    [owner] = await db
      .insert(schema.users)
      .values({ name: OWNER_NAME, email: OWNER_EMAIL, avatarColor: "#5e6ad2" })
      .returning();
  }
  await db
    .insert(schema.workspaceMembers)
    .values({ workspaceId: ws.id, userId: owner.id, role: "admin" })
    .onConflictDoNothing();

  // Additional workspace admins (Sandeep + Jayasaagar).
  await ensureWorkspaceAdmins(ws.id);

  // ---- Initiatives ----
  const initiatives = await db
    .insert(schema.initiatives)
    .values([
      { workspaceId: ws.id, name: "Revenue FY26", color: "#10b981" },
      { workspaceId: ws.id, name: "Hiring", color: "#5e6ad2" },
    ])
    .returning();
  const init = (name: string) => initiatives.find((i) => i.name === name)?.id ?? null;

  // ---- Projects ----
  // kind=project → gets department modules + CRM.
  // kind=operation → internal / back-office, no departments.
  await db.insert(schema.projects).values([
    { workspaceId: ws.id, name: "Healthytica", key: "HLTH", color: "#10b981", kind: "project", initiativeId: init("Revenue FY26"), description: "AI blood-biomarker health intelligence." },
    { workspaceId: ws.id, name: "Valytica", key: "VAL", color: "#6366f1", kind: "project", initiativeId: init("Revenue FY26"), description: "AI valuation management for Indian valuers." },
    { workspaceId: ws.id, name: "AI Workshop", key: "AIW", color: "#a855f7", kind: "project", initiativeId: init("Revenue FY26"), description: "SaaS LMS for the 30-day AI workshop." },
    { workspaceId: ws.id, name: "Standup-AI", key: "STDA", color: "#3b82f6", kind: "project", initiativeId: init("Revenue FY26"), description: "Autonomous standup bot." },
    { workspaceId: ws.id, name: "People & HR", key: "PPL", color: "#ec4899", kind: "operation", initiativeId: init("Hiring"), description: "Hiring, onboarding, the team roster and HR. Confidential." },
    { workspaceId: ws.id, name: "Finance", key: "FIN", color: "#22c55e", kind: "operation", description: "Company finance: payroll, expenses, runway across entities (NL via Odoo). Confidential." },
    { workspaceId: ws.id, name: "Legal & Compliance", key: "LGL", color: "#f59e0b", kind: "operation", description: "Contracts, entity compliance and filings across India and the Netherlands." },
    { workspaceId: ws.id, name: "IT & Tools", key: "IT", color: "#0ea5e9", kind: "operation", description: "SaaS subscriptions, accounts and access. Backed by the Tools & Subscriptions database." },
  ]);

  // ---- Databases (each Entity-tagged) ----
  async function makeDb(
    name: string,
    icon: string,
    fields: { name: string; type: string; options?: typeof ENTITY }[],
    rows: Record<string, unknown>[] = [],
  ) {
    const [d] = await db
      .insert(schema.databases)
      .values({ workspaceId: ws.id, name, icon })
      .returning();
    const inserted = await db
      .insert(schema.databaseFields)
      .values(
        fields.map((f, i) => ({
          databaseId: d.id,
          name: f.name,
          type: f.type,
          options: f.options ?? (f.type === "select" ? [] : null),
          position: `a${i}`,
        })),
      )
      .returning();
    // Map row data keyed by field NAME → field id.
    if (rows.length) {
      const byName = new Map(inserted.map((f) => [f.name, f.id]));
      await db.insert(schema.databaseRows).values(
        rows.map((r, i) => ({
          databaseId: d.id,
          position: `a${i}`,
          values: Object.fromEntries(
            Object.entries(r).map(([k, v]) => [byName.get(k) ?? k, v]),
          ),
        })),
      );
    }
  }

  // People live in the People & HR operation (directory + org chart), not a
  // database — so only Tools & Subscriptions is seeded here.
  // Tools & Subscriptions doubles as the vendor list — a vendor is just a tool's
  // provider. Seeded with Odoo (the NL accounting / VAT / payroll system).
  await makeDb(
    "Tools & Subscriptions",
    "🧰",
    [
      { name: "Tool", type: "text" },
      { name: "Provider", type: "text" },
      { name: "Monthly cost", type: "number" },
      { name: "Owner", type: "text" },
      { name: "Entity", type: "select", options: ENTITY },
      { name: "Renewal date", type: "date" },
      { name: "URL", type: "url" },
    ],
    [
      { Tool: "Odoo", Provider: "Odoo", Entity: "Netherlands", Owner: "Sandeep", URL: "https://www.odoo.com" },
    ],
  );

  // ---- Wiki skeleton ----
  let pos = 0;
  async function page(
    title: string,
    icon: string,
    content: Node,
    parentId: string | null = null,
  ): Promise<string> {
    const [pg] = await db
      .insert(schema.pages)
      .values({
        workspaceId: ws.id,
        parentId,
        title,
        icon,
        content,
        contentText: plain(content).slice(0, 20000),
        creatorId: owner.id,
        position: `a${pos++}`,
      })
      .returning();
    return pg.id;
  }

  const handbook = await page(
    "Company Handbook",
    "📘",
    doc(
      h(1, "Company Handbook"),
      p("How Gnanalytica works. One company, two entities (India 🇮🇳 and Netherlands 🇳🇱)."),
    ),
  );
  const policies = await page(
    "Policies",
    "📋",
    doc(h(1, "Policies"), p("Company-wide policies. Per-country sections where the law differs.")),
    handbook,
  );
  await page(
    "Leave Policy",
    "🌴",
    doc(
      h(1, "Leave Policy"),
      h(2, "India 🇮🇳"),
      bullets(["Earned/casual/sick leave per the Shops & Establishments Act and company policy.", "Public holidays per state."]),
      h(2, "Netherlands 🇳🇱"),
      bullets(["Statutory minimum 4× weekly hours of paid holiday per year.", "Sick leave and public holidays per Dutch law."]),
    ),
    policies,
  );
  await page("Expense Policy", "🧾", doc(h(1, "Expense Policy"), p("What's reimbursable, limits, and how to claim (see Expense Reimbursement SOP).")), policies);
  await page("Travel Policy", "✈️", doc(h(1, "Travel Policy"), p("Booking, per-diems, and approvals for business travel.")), policies);

  const sops = await page(
    "SOPs",
    "📐",
    doc(h(1, "Standard Operating Procedures")),
    handbook,
  );
  await page("Onboarding", "🚪", doc(h(1, "Onboarding"), bullets(["Add to People DB (with Entity).", "Provision accounts + assets.", "Assign a buddy.", "Entity-specific paperwork."])), sops);
  await page("Offboarding", "👋", doc(h(1, "Offboarding"), bullets(["Revoke access.", "Recover assets.", "Final settlement via the entity's payroll/finance.", "Update People DB."])), sops);
  await page("Procurement", "🛒", doc(h(1, "Procurement"), bullets(["Raise request.", "Approval by budget owner.", "Record vendor in Vendors DB.", "Track contract in Contracts DB."])), sops);
  await page("Expense Reimbursement", "💸", doc(h(1, "Expense Reimbursement"), bullets(["Submit receipt.", "Manager approval.", "Finance pays via the correct entity."])), sops);

  await page(
    "India — Entity Reference 🇮🇳",
    "🇮🇳",
    doc(
      h(1, "India — Entity Reference"),
      h(2, "Registration"), bullets(["Legal name & CIN: …", "Registered address: …", "GSTIN / PAN / TAN: …"]),
      h(2, "Statutory calendar"), bullets(["GST returns (monthly/quarterly).", "TDS deposit & returns.", "PF/ESI (if employees).", "ROC annual filings (AOC-4, MGT-7).", "Income tax / advance tax."]),
      h(2, "Providers"), bullets(["Chartered Accountant: …", "Payroll: …", "Bank (INR): …"]),
    ),
  );
  await page(
    "Netherlands — Entity Reference 🇳🇱",
    "🇳🇱",
    doc(
      h(1, "Netherlands — Entity Reference"),
      h(2, "Registration"), bullets(["Legal name & KvK number: …", "Registered address: …", "BTW (VAT) number: …"]),
      h(2, "Statutory calendar"), bullets(["BTW/VAT returns (quarterly).", "Payroll tax (loonheffing) if employees.", "Corporate income tax (Vpb).", "Annual accounts to KvK."]),
      h(2, "Providers"), bullets(["Accounts / BTW (VAT) / payroll: Odoo — https://www.odoo.com", "Bank (EUR): …"]),
    ),
  );

  // ---- Sales / Marketing / CRM layer ----
  await seedCrm(ws, owner);

  console.log("Done — Gnanalytica hub provisioned.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
