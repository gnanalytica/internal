/**
 * Single source of truth for Valytica's pricing. The strategy slide, the
 * seeded pricing doc, and the product economics all derive from here — so a
 * price changes in exactly one place. See
 * docs/superpowers/specs/2026-07-03-valytica-product-design.md §2.6.
 */
export type PricingTier = {
  id: "trial" | "payg" | "firm" | "byoc";
  name: string;
  audience: string;
  /** ₹/month; null = custom (per-deal). */
  monthly: number | null;
  /** ₹/report; null = custom; 0 = free. */
  perReport: number | null;
  /** Free reports before billing starts (trial only). */
  allowance?: number;
  blurb: string;
};

export const VALYTICA_PRICING = {
  currency: "INR",
  unitLabel: "report",
  /** COGS per report — AI inference + fulfilment. 90% margin at PAYG (₹200). */
  costPerReport: 20,
  tiers: [
    {
      id: "trial",
      name: "Reverse trial",
      audience: "Any new valuer",
      monthly: 0,
      perReport: 0,
      allowance: 5,
      blurb: "Full features free for your first 5 reports — this is also the live demo.",
    },
    {
      id: "payg",
      name: "Pay-as-you-go",
      audience: "Independent valuers",
      monthly: 0,
      perReport: 200,
      blurb: "No commitment; pay per certified report after the trial.",
    },
    {
      id: "firm",
      name: "Firm",
      audience: "Small multi-valuer firms doing volume",
      monthly: 2999,
      perReport: 120,
      blurb: "Lower per-report for teams; shared cases, seats, and QA.",
    },
    {
      id: "byoc",
      name: "BYOC / Enterprise",
      audience: "Banks & large firms",
      monthly: null,
      perReport: null,
      blurb: "Custom deploy in your infra: setup + hyper-customization + annual license. Opt-in anonymized-data clause; your case data never leaves your tenant.",
    },
  ] satisfies PricingTier[],
} as const;

/** Contribution margin per report at a given price, vs the fixed unit cost. */
export function contributionMargin(perReport: number): number {
  return perReport - VALYTICA_PRICING.costPerReport;
}
