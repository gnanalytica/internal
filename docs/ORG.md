# Gnanalytica — operating structure

How the company is organized: products, internal tools, and back-office
(admin / HR / finance) across two legal entities — **India 🇮🇳** and
**Netherlands 🇳🇱**. This is the map of *where everything lives* and *what to
build vs. buy*.

---

## The core decision: how India & Netherlands are separated

India and the Netherlands are **separate legal entities** (an Indian Pvt Ltd and
a Dutch BV). That legally forces separation of the *regulated* functions — and
nothing else. So the model is **hybrid**:

> **One unified internal hub** for everything global — products, coordination,
> OKRs, wiki, vendor/asset/contract tracking — with **"Entity" as a first-class
> field** (India / Netherlands / Global).
> **Hard-separate only the regulated systems of record** — accounting, payroll,
> statutory compliance, HR/PII — into **per-entity tools**, never the hub.

**Why not a separate workspace per country:** products and most coordination are
entity-agnostic; splitting would fragment product work and duplicate the wiki.
**Why not fully merged:** finance, payroll, and compliance are legally distinct
(currency, tax regime, labour law), and some HR/finance data is PII that should
not sit in the internal tool at all.

→ Tag-and-filter for the shared layer; dedicated per-entity systems for the
regulated layer.

---

## Three layers

### 1. Global layer — the internal hub

One workspace (**Gnanalytica**) in the internal app. Entity-agnostic; an
`Entity` field marks anything that belongs to one country. Concrete layout
using the app's primitives:

**Teams 👥**
- Products (external): `Healthytica`, `Valytica`, `AI Workshop`
- Internal tools: `Internal Tools` (this app + standup-ai)
- Operations: `Admin`, `People (HR)`, `Finance`

**Initiatives** (cross-cutting goals)
- `Revenue FY26`, `Hiring`, `Compliance & Legal`

**Projects**
- One per product (linked to its git repo).
- Back-office projects, **tagged by entity**: `Compliance — India`,
  `Compliance — Netherlands`, `Hiring`, `NL payroll setup`, …

**Databases 🗃️** — each has an **Entity** select field (India / NL / Global)
- **People** — role, entity, type (employee/contractor), start date, manager.
  *No salary / no PII here.*
- **Vendors** — name, service, entity, owner.
- **Contracts** — counterparty, type, entity, renewal date, doc link.
- **Assets** — equipment → assignee, entity.
- **Tools & Subscriptions** — SaaS, monthly cost, owner, entity.

Use date fields + the app's notifications/inbox for renewal and deadline
reminders.

**Wiki 📄**
- Company handbook; policies (leave / expense / travel) with **per-country
  sections** where the law differs.
- SOPs: onboarding, offboarding, procurement, expense reimbursement.
- A per-entity reference page each: registration details, registered address,
  and a **statutory-filing calendar**.

**Product × Department modules** — within the hub, every product (project) now
has its own department sections — **Engineering, Sales, Marketing, Finance,
Support** — and each department also rolls up company-wide across all products
(e.g. `Sales` shows every product's pipeline). They're linked by a `product`
field on each record, so you can view the product lens or the department lens of
the same data. These are coordination tools (CRM/pipeline/campaigns/invoices/
tickets), deliberately *not* the regulated systems below — outbound email
sending and statutory books still live in external tools.

### 2. Entity layer — per-country systems of record (buy, don't build)

These never go in the hub — they're regulated and per-entity.

| | India 🇮🇳 | Netherlands 🇳🇱 |
|---|---|---|
| Accounting / books | Indian tool + CA (e.g. Zoho Books / Tally) | Dutch bookkeeper + tool (e.g. Moneybird / Exact) |
| Payroll | Local payroll (e.g. RazorpayX Payroll / Keka) | Dutch payroll provider, or an **EOR** if no employees yet |
| Banking | INR account | EUR account |
| HR records / PII | HRIS or permissioned drive | HRIS or permissioned drive |
| Statutory | MCA/ROC, GST, TDS, PF/ESI | KvK, BTW/VAT, payroll tax |

Track **deadlines and tasks** for these in the hub; do the **filings** with local
providers. (Vendor names are examples — pick a local provider per country.)

### 3. People layer

Most people attach to **one** entity (their employer of record); leadership may
be global. The hub's *People* database carries the `Entity` field; sensitive
employment data stays in the per-entity HRIS.

---

## Build vs. buy

| Function | Where | Build or buy |
|---|---|---|
| Products / eng coordination | Internal hub | already built |
| Wiki, SOPs, policies | Internal hub (pages) | built |
| People / Vendors / Contracts / Assets / Subscriptions | Internal hub (Entity-tagged DBs) | built |
| Statutory-deadline tracking | Internal hub (DB + reminders) | built |
| Accounting / books | Per entity | **buy** (local) |
| Payroll | Per entity | **buy** (local / EOR) |
| Banking | Per entity | n/a |
| HRIS / PII | Per entity | **buy** |
| Tax & statutory filing | Per entity | **buy** (CA / accountant) |

**Principle:** build the coordination layer (you already have the tool); buy the
regulated, per-country systems of record.

---

## Products at a glance

| Product | Type | Home |
|---|---|---|
| Healthytica | External product | `~/code/Healthytica` · Vercel + Supabase |
| Valytica | External product | `~/code/valytica` · Vercel + Supabase |
| AI Workshop | External program (LMS) | `~/code/ai-workshop` · Vercel + Supabase |
| Internal (this app) | Internal tool / the hub | `~/code/notion` · Vercel + Neon |
| Standup-AI | Internal tool | `~/code/Standup-AI` · AWS |

(Setup commands for each: `docs/SETUP.md`.)

---

## Assumptions

This recommendation assumes:
1. India & Netherlands are **separate legal entities**, each with its own books
   and compliance.
2. **Small team**, mix of employees + contractors. *If NL has no employees yet,
   use an EOR instead of standing up Dutch payroll.*
3. The **internal app is the chosen hub** (rather than Notion/Linear SaaS).

If any of these is wrong, tell me — #1 and #2 in particular would change the
entity model and the back-office recommendations.

---

## Next step (optional)

If you want, I can **set this up in the internal app**: create the Gnanalytica
workspace, the teams, initiatives, the Entity-tagged databases (People, Vendors,
Contracts, Assets, Subscriptions), and the wiki skeleton — so the structure
above exists and is ready to fill in.
