import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed Valytica's FIXED monthly operating costs as expenses on the Valytica
 * project (its Finance department). Every line traces to a real service wired
 * into the valytica repo (package.json deps + .env keys) — nothing invented:
 *
 *   Vercel .............. hosting/compute (next 16 on Vercel)
 *   Supabase ............ Postgres + auth + storage (@supabase/*, POSTGRES_*)
 *   Sentry .............. error monitoring (@sentry/nextjs)
 *   PostHog ............. product analytics (posthog-js)
 *   Mappls / MapmyIndia . India maps base plan (MAPPLS_CLIENT_ID/SECRET)
 *
 * These are volume-INDEPENDENT subscriptions (flat until plan ceilings, which
 * are high). Per-report/usage services — Gemini inference, Google Maps +
 * Geocoding, AWS SES, MSG91 OTP, captcha solvers — are deliberately NOT here:
 * they scale with report volume and live in the product's unit cost
 * (projects.economics.costPerUnit ≈ ₹20/report, ~90% margin on ₹200 billing),
 * so booking them as flat monthly lines would double-count. Razorpay (~2%/txn)
 * likewise scales with revenue and belongs in unit economics.
 *
 * Amounts are ESTIMATES, stored as whole units in each line's entity currency
 * (Global → USD, India → INR — the Finance view converts to a display
 * currency). Status "planned" — flip to "paid" as real invoices land.
 *
 * Idempotent: replaces every vendor this script has ever managed (see
 * MANAGED_VENDORS) so dropped lines are cleaned up; leaves hand-entered
 * expenses untouched. Run: npm run db:seed-valytica-costs
 */

type Cost = {
  vendor: string;
  category: "infra" | "tooling";
  amount: number; // whole units in `entity` currency
  entity: "Global" | "India";
};

const COSTS: Cost[] = [
  { vendor: "Vercel (hosting & compute)", category: "infra", amount: 20, entity: "Global" },
  { vendor: "Supabase (Postgres, auth, storage)", category: "infra", amount: 25, entity: "Global" },
  { vendor: "Sentry (error monitoring)", category: "tooling", amount: 26, entity: "Global" },
  { vendor: "PostHog (product analytics)", category: "tooling", amount: 20, entity: "Global" },
  { vendor: "Mappls / MapmyIndia (India maps)", category: "tooling", amount: 2000, entity: "India" },
];

// Every vendor this script has ever inserted — used to clean up rows dropped
// from COSTS (e.g. the per-report services now folded into unit economics).
const MANAGED_VENDORS = [
  ...COSTS.map((c) => c.vendor),
  "Gemini via Vercel AI Gateway (report inference)",
  "Google Maps Platform (maps + geocoding)",
  "AWS SES (transactional email)",
  "2Captcha / Anti-Captcha (portal automation)",
  "MSG91 (SMS & WhatsApp OTP)",
];

async function main() {
  const [val] = await db
    .select({ id: schema.projects.id, workspaceId: schema.projects.workspaceId, name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.key, "VAL"));
  if (!val) throw new Error("Valytica project (key VAL) not found.");

  // Idempotent: clear every vendor this script manages (incl. dropped ones) for
  // Valytica, then re-insert the current set.
  await db
    .delete(schema.expenses)
    .where(and(eq(schema.expenses.projectId, val.id), inArray(schema.expenses.vendor, MANAGED_VENDORS)));

  const now = new Date();
  const spentDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  await db.insert(schema.expenses).values(
    COSTS.map((c) => ({
      workspaceId: val.workspaceId,
      projectId: val.id,
      vendor: c.vendor,
      category: c.category,
      amount: c.amount,
      status: "planned",
      entity: c.entity,
      spentDate,
    })),
  );

  const usd = COSTS.filter((c) => c.entity === "Global").reduce((s, c) => s + c.amount, 0);
  const inr = COSTS.filter((c) => c.entity === "India").reduce((s, c) => s + c.amount, 0);
  console.log(`✓ seeded ${COSTS.length} monthly cost lines on ${val.name}`);
  console.log(`  Global ~$${usd}/mo · India ~₹${inr}/mo · combined ≈ ₹${usd * 83 + inr}/mo (USD@83)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
