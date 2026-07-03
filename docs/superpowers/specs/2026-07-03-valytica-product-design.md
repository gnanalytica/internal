# Valytica — Product Design & Hub Representation

- **Date:** 2026-07-03
- **Status:** Approved design → ready for implementation plan (Part B)
- **Owner:** Sandeep
- **Scope:** Design-think the Valytica product (positioning, model, monetization), then clean up how the internal hub represents it — without clogging what accumulated across prior sessions.

---

## 1. Context & problem

Valytica is Gnanalytica's AI property-valuation copilot for India. Across many incremental sessions the internal hub accumulated a scattered, partly-contradictory representation of it:

- **5 Valytica seed scripts** with real overlap — notably the roadmap is seeded twice (`seed-valytica.ts` and `seed-valytica-roadmap.ts`).
- **Pricing lives in 3 places** (the GTM "Pricing & Packaging" doc, the strategy slide `valytica-market-dashboard.tsx`, and the Finance/economics model) whose numbers had already drifted apart.
- **A pile of spent one-off migration scripts** in `src/db/` (`add-economics-column`, `rename-product-to-project`, `drop-pods`, `move-feasibility-to-atlas`, `backfill-people`).

Before cleaning the representation, we settled the product itself — because everything downstream (pricing, roadmap, what the hub should say) hangs off it. The strategy was verified against grounded market research (Section 5) rather than assumed.

---

## 2. The product model

### 2.1 One-liner

An AI valuation copilot for India, run as an **open-core hub-and-spoke**: a self-serve product for individual valuers and small firms that doubles as a live demo and a data engine, funneling into hyper-customized BYOC deployments for banks and large firms.

### 2.2 Positioning wedge

Not "instant valuation." Automated valuation models (AVMs) already produce instant estimates and **cannot be used for loan sanction** — Indian lenders still legally require physical inspection by an empanelled valuer. The wedge is **a certified, bank-accepted report produced fast**:

- The empanelled valuer keeps inspection + sign-off (fully compliant).
- The AI collapses the desk work (extraction, verification, drafting, reformatting).
- A certified report lands in **2–3 days instead of the 7–14** that is the rate-limiting stage in every mortgage.

This deliberately sidesteps SigmaValue's "AI report vendor" lane by competing on **workflow speed for a lender**, not on producing a faster estimate.

### 2.3 The hub (self-serve core) — three simultaneous roles

1. **Adoption.** Independent valuers and small firms self-serve. Realistic TAM: ~3,000 IBBI-registered Land & Building valuers plus a larger uncounted pool of sub-₹2cr empanelled valuers. They are both the users and the **supply** of certified sign-off.
2. **Data engine.** Usage, behavior, and explicit feedback from every session drive the product roadmap.
3. **Living demo.** The same product is the demo video / live walkthrough / free trial shown to banks and HFCs.

### 2.4 The spokes (BYOC / enterprise)

BYOC + hyper-customization for banks and large firms, won off the back of the hub demo + free trial. **First target: affordable-housing HFCs** — they have acute loan-TAT pain, are tech-forward, are gaining disbursement share, run disproportionately many valuations per rupee (small tickets), and move far faster than PSU banks. Named profiles: Home First, Aavas, Aadhar, India Shelter, IIFL Home Finance, Aptus, Vastu.

### 2.5 The flywheel and its one hard rule

Hub and spokes both feed the core:

- **Product telemetry + explicit feedback** — always on (feature usage, where users get stuck, model-quality/accuracy signals, bug reports, feedback).
- **Anonymized market data** — opt-in only, per BYOC contract (aggregated comparables / price signals; a potential data-network moat).

**Inviolable line:** customer/valuation data (properties, borrowers, figures) **never leaves a BYOC tenant.** Only product-usage signals and opt-in anonymized aggregates flow back. Getting this line right preserves both bank trust and the flywheel; blurring it loses the bank.

### 2.6 Monetization

| Tier | Who | Price |
|---|---|---|
| **Reverse trial** | Any new valuer | Full features free for ~5 reports (this is also the demo + first data) |
| **Pay-as-you-go** | Independent valuers past the allowance | ~₹150–200/report, no commitment |
| **Firm plan** | Small multi-valuer firms doing volume | Low monthly + cheaper per-report |
| **BYOC / Enterprise** | Banks, large firms | Custom: setup + hyper-customization + annual license + per-seat/volume; carries the opt-in data clause |

Unit cost ≈ ₹20/report keeps PAYG healthily margined. The generous front door is deliberate: the hub's free tier *is* the demo asset and the R&D input, so entry is generous and monetization sits on usage + enterprise, not on gating the front door.

---

## 3. How the hub represents it (de-clutter)

Principle: **one concern = one script, one number = one source.**

> **Update (2026-07-03): clean slate chosen over incremental consolidation.** All Valytica *content* was torn down (`src/db/valytica-teardown.ts`) — 115 issues, 13 features, 5 milestones, 10 cycles, 21 docs, 1 campaign, 3 content items, 5 expenses removed after inventory confirmed near-zero hand-entered data. The project shell (row, owner, brand, department config) was kept. So Part B is now a **reconstruction from a single canonical seed**, not a merge of the old five. The old `seed-valytica*.ts` scripts are superseded and get removed as part of the rebuild.

### 3.1 Seed scripts: 5 → 3

- **`seed-valytica.ts`** — the canonical product setup: people, product config (fold in owner + brand color from the tiny `seed-valytica-setup.ts`), the **single merged roadmap** (collapse the duplicate roadmap/feature seeding in `seed-valytica.ts` and `seed-valytica-roadmap.ts` into one), and the core Docs tree.
- **`seed-valytica-gtm.ts`** — stays (GTM campaign/launch is a genuine separate concern), but its "Pricing & Packaging" doc **references the single pricing source** instead of restating numbers.
- **`seed-valytica-costs.ts`** — stays (finance/expenses is its own concern).

`seed-valytica-setup.ts` and `seed-valytica-roadmap.ts` are folded in and removed.

### 3.2 Single-source pricing

Create `src/lib/valytica-pricing.ts` holding the canonical tiers / PAYG / BYOC numbers. The strategy slide (`valytica-market-dashboard.tsx`) and the GTM pricing doc both derive from it — permanently killing the "three places, drifted" problem.

### 3.3 One canonical strategy doc

A single "Valytica Product Strategy" page (positioning, hub-and-spoke, flywheel + data boundary, pricing) that supersedes scattered product-strategy fragments. Fold `docs/valytica-pain-points.md` research into it as grounding.

### 3.4 Archive spent migrations

Move already-run one-off scripts (`add-economics-column`, `rename-product-to-project`, `drop-pods`, `move-feasibility-to-atlas`, `backfill-people`) to `src/db/_archive/` so `src/db/` shows only live seeds. Archive, not delete (reversible) — unless we decide otherwise at plan time.

### 3.5 Net effect

The product has one coherent story; the hub tells exactly that story once; `src/db/` drops from ~24 mixed live/dead files to a clean canonical set.

---

## 4. Non-goals

- Not rebuilding the actual Valytica product repo — this designs the strategy and its representation in the internal hub.
- Not changing the departments/confidential/navigation architecture (that is a separate concern).
- Not touching hand-entered Finance expenses; only the seeded/scripted representation is consolidated.
- No new pricing math beyond the tiers above; exact BYOC figures are per-deal.

---

## 5. Grounded market research (verification appendix)

Verified 2026-07-03 via three parallel research passes. Hard facts cited; estimates flagged.

### Supply — the market is sole practitioners, not firms
- **~2,959 IBBI-registered Land & Building valuers** (31 Mar 2025); ~6,190 total RV directory records mid-2026.
- **5,712 individuals vs only 118 registered valuer entities** (~48:1) — the "small/mid valuation firm" segment barely exists. **75% non-metro, average age 49.**
- IBBI registration is **not mandatory below ₹2 crore**, so the working pool of bank-mortgage valuers is larger than 3,000 but uncounted. Empanelment is per-bank, per-region, manual, 3-year tenure.
- Source: [IBBI RV stats, Jan–Mar 2025 newsletter](https://ibbi.gov.in/uploads/whatsnew/912e97d4d9f96651386541fb7059203b.pdf); [IBBI RV directory](https://ibbi.gov.in/service-provider/rvs).

### Demand — where the money and pain are
- **3.88M home loans originated FY24** (CRIF); ~22.6M active accounts; **~5M+ secured-property valuations/year** floor (derived).
- Valuation is the **rate-limiting external step: 3–14 business days**, routinely the longest single stage of a 7–30 day loan.
- **HFCs gaining share** (30% of disbursements, H1FY26); **affordable-housing HFCs fastest-growing** (~20%+ CAGR) and run more valuations per rupee.
- Sources: [CRIF How India Lends FY24](https://www.crifhighmark.com/media/5038/how-india-lends-report.pdf); [NHB/PIB Trends 2024](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2110726); [IIFL loan TAT](https://www.iiflhomeloans.com/blogs/what-is-tat-in-home-loan-processing).

### Pricing
- Statutory scale (Rule 8C, Wealth Tax): 0.5% / 0.2% / 0.1% / 0.05% tiers, min ₹500. A ₹1cr property caps ~₹10,750.
- Real-world residential **₹1,000–5,000** typical (up to ₹8–10k); commercial/industrial higher (value-based). **Borrower pays.**
- Source: [Valuation fee scale](https://valuationadda.com/property-valuation-charges/).

### Competition
- **SigmaValue** — the serious competitor: AI AVM + certified reports (3–5 days), founder is an IIT-B IBBI valuer, NASSCOM/NVIDIA-backed, already empanelled with banks. [sigmavalue.in](https://sigmavalue.in/valuation-overview).
- Adjacent: Aurum PropTech (listed, AVM/InstaHome), Zapkey (seed, 2020), Landeed (Series A, 2022), RK Associates (traditional incumbent), RICS firms (CBRE/JLL/Knight Frank/Colliers) for high-end commercial.
- **Critical:** AVMs today are only a pre-check/monitoring layer — **no lender uses them for sanctioned loan valuation.** Physical inspection by an empanelled valuer is still legally required.

### Why the model is shaped this way
The supply data killed the original "sell to small/mid valuation firms" beachhead (that segment is statistically negligible). The individual valuer is a weak standalone business (small TAM, low ATP, non-metro, price-sensitive) but an excellent *on-ramp, demo surface, and supply*. The budget and acute pain sit with affordable-housing HFCs. Hence hub-and-spoke: win valuers' hands cheaply (hub), monetize enterprise TAT pain (spokes), and let both feed one roadmap (flywheel).

---

## 6. Next step

Turn **Part B (Section 3)** into a step-by-step implementation plan (via writing-plans): consolidate the seeds, extract single-source pricing, write the canonical strategy doc, and archive spent migrations — each verifiable and idempotent (Neon HTTP: no transactions; idempotent sequential scripts).
