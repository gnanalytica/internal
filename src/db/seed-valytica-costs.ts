import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "./index";

/**
 * Seed Valytica's recurring operating costs as monthly expenses on the Valytica
 * project (its Finance department). Every line traces to a real service wired
 * into the valytica repo (package.json deps + .env keys) — nothing invented:
 *
 *   Vercel .............. hosting/compute (next 16 on Vercel)
 *   Supabase ............ Postgres + auth + storage (@supabase/*, POSTGRES_*)
 *   Gemini / AI Gateway . report inference (ai v6, AI_GATEWAY_API_KEY, GOOGLE_GENERATIVE_AI)
 *   Google Maps Platform  maps + geocoding (NEXT_PUBLIC_GOOGLE_MAPS_KEY, GOOGLE_GEOCODING_KEY)
 *   Mappls / MapmyIndia . India maps (MAPPLS_CLIENT_ID/SECRET)
 *   AWS SES ............. transactional email (@aws-sdk/client-sesv2, SES_FROM_*)
 *   MSG91 ............... SMS / WhatsApp OTP (MSG91_AUTH_KEY)
 *   Sentry .............. error monitoring (@sentry/nextjs)
 *   PostHog ............. product analytics (posthog-js)
 *   2Captcha/Anti-Captcha portal-check automation (TWOCAPTCHA/ANTICAPTCHA keys)
 *
 * Amounts are ESTIMATES of the monthly bill, stored as whole units in each
 * line's entity currency (Global → USD, India → INR — the Finance view converts
 * them to a chosen display currency). Status is "planned" — flip to "paid" as
 * real invoices land. Razorpay (payment gateway) is intentionally omitted: it's
 * a ~2%/txn fee that scales with revenue and belongs in unit economics, not a
 * fixed monthly line.
 *
 * Idempotent: replaces this script's own vendor rows on re-run; leaves any
 * hand-entered expenses untouched. Run: npm run db:seed-valytica-costs
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
  { vendor: "Gemini via Vercel AI Gateway (report inference)", category: "tooling", amount: 50, entity: "Global" },
  { vendor: "Google Maps Platform (maps + geocoding)", category: "tooling", amount: 30, entity: "Global" },
  { vendor: "AWS SES (transactional email)", category: "infra", amount: 5, entity: "Global" },
  { vendor: "Sentry (error monitoring)", category: "tooling", amount: 26, entity: "Global" },
  { vendor: "PostHog (product analytics)", category: "tooling", amount: 20, entity: "Global" },
  { vendor: "2Captcha / Anti-Captcha (portal automation)", category: "tooling", amount: 10, entity: "Global" },
  { vendor: "Mappls / MapmyIndia (India maps)", category: "tooling", amount: 2000, entity: "India" },
  { vendor: "MSG91 (SMS & WhatsApp OTP)", category: "tooling", amount: 1500, entity: "India" },
];

async function main() {
  const [val] = await db
    .select({ id: schema.projects.id, workspaceId: schema.projects.workspaceId, name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.key, "VAL"));
  if (!val) throw new Error("Valytica project (key VAL) not found.");

  const vendors = COSTS.map((c) => c.vendor);
  // Idempotent: clear only this script's own rows for Valytica, then re-insert.
  await db
    .delete(schema.expenses)
    .where(and(eq(schema.expenses.projectId, val.id), inArray(schema.expenses.vendor, vendors)));

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
