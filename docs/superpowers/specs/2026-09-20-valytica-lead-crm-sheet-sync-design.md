# Valytica lead CRM: the Google Sheet as source of truth, Internal as the working surface

**Status:** proposal, awaiting decisions (see §9). Nothing here is built yet.
**Date:** 2026-09-20
**Scope:** the Sales and Marketing surfaces of Internal for the Valytica project, rewritten around the workbook *"Valytica Lead Intelligence CRM - Single Source of Truth"* (Drive id `1k53AMZhNVdKA3StzAFVGkn5vz7lqcprBiUrPG1XK5kw`), plus the interaction layer that pulls meetings, email, calendar, WhatsApp, LinkedIn and Standup AI context onto one timeline per person.

---

## 1. What the sheet actually is (analysis)

Read via the Drive export on 2026-09-20. The export truncates the large tabs, so counts below distinguish "rows seen" from "rows the workbook's own Dataset Summary claims".

### 1.1 Tabs

| # | Tab | Cols | Rows (seen / claimed) | Role |
|---|---|---|---|---|
| 0 | README | 2 | 56 | Glossary, `lead_score` formula, **Entity Resolution / Duplicate Prevention v1.0** rulebook (effective 2026-09-20) |
| 1 | `Dataset Summary` | 3 | 68 | KPIs; "All counts are live formulas over the People / Companies tabs" |
| 2 | `People` | 48 | 50 / **5,654** | **Master.** `person_id` = `P#####` |
| 3 | `Companies` | 40 | 60 / **350** | **Master.** `company_id` = `C####` |
| 4 | `RVOs` | 12 | 14 | Reference (IBBI-recognised RVOs). Natural key `rvo_name` |
| 5 | `Lender Landscape` | 4 | 39 | Reference (institution, type, relevance) |
| 6 | `Lender Contacts` | 18 | 135 / **378** | Directory. **No ID column** |
| 7 | `Association Officers` | 13 | 128 / 129 | Directory. **No ID column** |
| 8 | IOV cross-match | 8 | 309 / 1,017 | Join table, FK `person_id` (1 person → many rows) |
| 9 | `Source Inventory` | 7 | 26 | Provenance catalogue, with "do not re-run" instructions |
| 10 | `Prospect Intelligence` | 44 | 21 (+5 corrupt fragments) | Scored GTM research. `Person ID` blank on 10 of 21 |
| 11 | `Referral Map` | 16 | 15 | Warm paths. No ID; people named in free text |
| 12 | `Research Queue` | 14 | 27 | Work queue. `Person ID` blank on 15 of 27 |
| 13 | `GTM Personas` | 10 | 16 | Persona definitions |
| 14 | `Deep Dive Dossiers` | 26 | 24 | Per-prospect story + **the message scripts** (WhatsApp/Call/Email openers, demo sequence) |
| 15 | `Exclusions` | 8 | 3 | Do-not-contact list with aliases. README: "always read first" |
| 16 | `Scoring Model` | 4 | 20 | Rubric (7 factors → /100; bands A/B/C/Watch) |
| 17 | `Priority Dashboard` | 16 | 7 | Derived view of the scored prospects. No ID column |

Header style splits cleanly: master and reference tabs are `snake_case`; GTM tabs (10–17) are `Title Case / with slashes`. The mapping layer must quote headers exactly.

### 1.2 Identifier scheme

- `person_id` (`P` + 5 digits) is the master key. Referenced by Companies.`linked_person_ids` (`;`-separated), IOV cross-match, Prospect Intelligence.`Person ID`, Research Queue.`Person ID`, Deep Dive.`Prospect / Contact ID`, and by free text in Referral Map.
- `company_id` (`C` + 4 digits, gaps from consolidation) is the master key for Companies, but **nothing references it**: People links to companies by *name* (`company_names`) and by `company_ibbi_reg_nos`.
- `canonical_entity_key` / `normalized_name_key` / `match_rule` / `duplicate_flag` / `duplicate_match_ids` are entity-resolution outputs. Companies.`canonical_entity_key` is blank except one `#ERROR!`.
- External ids worth first-class treatment: `ibbi_reg_no` (`IBBI/RV/<class>/<year>/<serial>`), `ibbi_entity_reg_no`, `iov_membership_no`.

### 1.3 Derived / formula columns (never written by Internal)

`lead_score`, `num_empanelments`, `source_count`, `is_south_india`, `canonical_entity_key`, `normalized_name_key`, `duplicate_flag`, `duplicate_match_ids`, `match_rule`, `num_linked_people`, every cell of `Dataset Summary`, `Opportunity Score /100` and `Score Band` (sum + band of the seven factor columns), and `Priority Dashboard` wholesale. The sync layer confirms this at runtime by reading `userEnteredValue.formulaValue` and refuses to write any cell that carries a formula, whatever the mapping says.

### 1.4 What the sheet does NOT have

**There is no activity log.** No "last contacted", no channel used, no reply, no meeting date. Every `Status` / `Research Status` is a research state (`Deep dive complete`, `Mapped`, `Warm intro preferred`, `not contacted`). Dates are research dates only (`Last Researched`, `Score Last Reviewed`, `Evidence Date`, `Date Added`). The effective funnel today is **21 researched → 7 scored → 0 contacted**. Outreach *planning* is rich (`Best First Channel`, `Personalized Opening Angle`, `WhatsApp Opener`, `Demo Sequence`, `Next Action`, `Warm Referral Path`), outreach *history* is absent. That absence is what Internal fills.

### 1.5 Data-quality findings (a backlog, not a blocker)

Recorded here by id so the person who owns the sheet can act on them; Internal will surface them, never silently fix them.

1. **Column-shift corruption.** Fixed in the sheet on 2026-09-20: the Badam record in Deep Dive Dossiers was realigned from `Likely Trigger` onward, and the five orphan fragment rows of it in Prospect Intelligence were removed. The Companies rows C0014, C0039, C0041, C0042, C0045 and GTM Personas rows 2 to 16 that the Drive export showed as shifted are **aligned in the live sheet** (checked by hand): the Drive natural-language export drops some empty cells, so it is not cell-faithful and a shift seen there is not proof of a shift in the sheet. Phase 0 verifies alignment through the Sheets API only. The two misplaced cells on the V S S Sudheer Chekka row in Prospect Intelligence (`RVO`, `Public Phone`) were corrected the same day.
2. **Unmerged duplicates** despite `duplicate_flag = UNIQUE`: P00001 / P00002 (same door number, one-letter name variant); C0013 / C0016 (Savills, self-declared duplicate); C0056 / C0057 (AHSKAR & / AND ASSOCIATES, same address); C0065 / C0069 (AAA Valuation Professionals). Referral Map has two rows for the same Canara officer. Lender Contacts spells the same institution two ways (`City Union Bank` / `City Union Bank Ltd`, `CSB Bank` / `CSB Bank Ltd (…)`, `Bajaj Housing Finance` / `… Limited`).
3. **`duplicate_match_ids` misuse**: holds the sentence `MATCH ON IBBI / EMAIL / PHONE / COMPANY — MERGE REQUIRED` instead of an id (P00038, P00050); the README says it holds the first canonical id. Confirmed to be **formula output**, so it is a formula-logic change across the masters, deliberately left alone until the sync is reading; Internal treats a non-id value there as "flagged, survivor unknown".
4. **`lead_score` inflation**: `empanelled_with` items that are not lenders (`PNB (input record)`, `firm website does not list named bank empanelments`) are counted by `num_empanelments`, so P00050 scores 125 with one real panel.
5. **`city` is the PNB zone, not the city**, on PNB-sourced rows (P00012, P00018, P00019, P00027, C0007–C0010: address says Bhimavaram / Kadapa / Repalle / Rajahmundry / Anantapuram / Bidar / Koppal, `city` says Hyderabad). 12 of 50 people have blank `city` though the address contains it.
6. **Prospects without a `person_id`.** Resolved in the sheet on 2026-09-20. Existing People rows were linked rather than duplicated (Sudheer Chekka → P02058, Saripalli Srinivasa Raju → P00186, Badam → P00122, Kotagiri Chiranjeevi → P02060) and new rows appended for the rest (Raghupati P05670, H V Anjaneya Prasad J P05671, Kurumilla Indrasena Chary P05672, Talluri Venkata Ramana P05673, Gouru Neelakanta Reddy P05674). The bank-side people went into People too, not a new tab: Rohit Kumar P05675, Mandari Yadaiah P05676, Dhurjati Patri P05677, Gopi Krishna B P05678. P02058 and P05670 are now filled in all three GTM tabs. Bank-side People rows are marked by convention, not by a new column: `specialisation` **starts with `INSTITUTIONAL`** and ends with `not a valuer` followed by the actual role, and `sources` carries `Lender Contacts` (Gopi Krishna B: `Lender Contacts / ecosystem research`). The projection reads the `specialisation` prefix as the authoritative signal (§3.3).
7. **Format drift**: `constitution` has 17 spellings (`PROPRIETORSHI P`, `PROPERIETORS HIP`); RVO names vary across tabs (`Divya Jyoti Foundation` / `Divya Jyoti Valuers Foundation` / `… RVO`); `confidence` is `High`/`high`/`Medium`/`medium`; dates are `08 Oct, 2018` (People), `11 August, 2025` (Companies), ISO in the GTM tabs, `13-02-2028` and `31.10.2025` in prose; phones are bare 10-digit, `+91##########`, `+91 88797 64119`, `0141-…`, and a bare exchange number `274544`.
8. **Structured data in free text**: `decision_maker_contacts` (name / phone / email triples), `Missing Phone` (`No: <number>`), `Best First Channel` (`Founder WhatsApp to <number>`), bank relationship cells (panel category, valuer code, validity date).
9. **Stale-on-purpose rows** that must not be "fixed": Addagiri Srihari Babu kept as a Priority D guardrail; Mandari Yadaiah's Lender Contacts row keeps a label the Referral Map says is stale.
10. `Priority Dashboard.Rank` is the source row number, not a rank.

---

## 2. The rule that decides everything: who owns which fact

| Fact | Owner (source of truth) | Written by Internal? |
|---|---|---|
| Who a person / company is (People, Companies, every reference tab) | **Sheet** | Only the writable columns in §4.3, write-through, cell-addressed by id |
| Research state, scores, dossiers, openers, next research task | **Sheet** | Same: edits in Internal land in the sheet cell within the same request |
| Derived / formula cells | Sheet formulas | **Never** |
| Exclusions | **Sheet** | Never written; always enforced |
| What happened with a person: messages sent, replies, calls, meetings, calendar events, tasks, notes | **Internal** | n/a — the sheet has no such columns. Optionally *mirrored* to the sheet if the column additions in §9.2 are approved |
| Outreach stage (planned → contacted → replied → meeting → pilot → paying / lost) | **Internal** | Same |
| Deals (a real commercial opportunity: pilot, design-partner, paid) | **Internal** (`deals`, existing) | n/a |
| Campaigns, content, personas as a library | Personas: **Sheet**. Campaigns / content: **Internal** (existing tables) | n/a |

Two consequences:

- **Internal never invents an id.** Everything it holds about a sheet row is keyed by `person_id` / `company_id`; rows in tabs with no id get a derived key (§3.3) and a visible "weak key" marker until the sheet gains an id column.
- **Internal never rewrites the sheet's shape.** No tab, column, header or formula is created, renamed or moved by code. The four schema requests in §9.2 are decisions for the sheet's owner, each with a fallback if declined.

---

## 3. Sync design

### 3.0 A note on the Drive export

The analysis in §1 was done from Google Drive's natural-language export of the workbook. That export truncates large tabs and **drops some empty cells**, so a row can look shifted there while being correctly aligned in the sheet (this happened for five Companies rows and the GTM Personas tab). Nothing in the sync may be built or validated against that export; the Sheets API returns cells positionally and is the only source the probe, the mapping tests and the sync read.

### 3.1 Transport

Google Sheets API v4 via a **service account** the sheet is shared with as *Editor*. No `googleapis` dependency (it is ~100 MB and Internal has a standing no-new-deps preference): a JWT signed with `node:crypto` (`RS256`), exchanged at `oauth2.googleapis.com/token`, then plain `fetch` against:

- `GET spreadsheets/{id}?fields=sheets.properties` — tab list, grid sizes (drift check).
- `GET spreadsheets/{id}/values:batchGet?ranges=<every tab>` — one call, all tabs, `valueRenderOption=UNFORMATTED_VALUE`, `dateTimeRenderOption=FORMATTED_STRING`.
- `GET spreadsheets/{id}?includeGridData=true&fields=sheets.data.rowData.values.userEnteredValue.formulaValue` — formula map, refreshed on every full sync so a column that *becomes* a formula is protected the next run.
- `POST spreadsheets/{id}/values:batchUpdate` — write-through of individual cells, A1-addressed from the row located by id **at write time** (never a remembered row number; a re-sort in between would otherwise write the wrong person).

Env on Internal (Prod + Preview): `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` (PEM as one line with `\n`, Sensitive), `VALYTICA_CRM_SHEET_ID`, `SHEET_SYNC_SECRET` (for the Apps Script ping in §3.5).

### 3.2 Cadence

- **Pull**: Vercel cron every 15 minutes (`/api/cron/sheet-sync`, `CRON_SECRET`-gated like the digest route; fails closed). A full read is ~6k × 48 cells for People, well inside one request. Change detection is a per-row SHA-256 over the raw cell array, so an unchanged sheet costs one read and zero writes.
- **Push**: write-through at save time from Internal (no queue to lose). If the Sheets call fails, the edit is kept in Internal with `sync_state = 'pending'` and retried by the next cron; the field shows a "not yet in the sheet" badge until it lands.
- **Manual**: a "Sync now" button on the Sales surface and `POST /api/v1/sheet-sync` for agents.

### 3.3 Storage: one verbatim mirror + typed projections

```
sheet_rows
  id uuid pk
  workspace_id, sheet_id, tab text            -- tab name exactly as in the workbook
  row_key text                                -- person_id / company_id / derived key
  person_id text null, company_id text null   -- FK columns, indexed, when the tab carries them
  data jsonb                                  -- { "<exact header>": value } for every column
  row_hash text, synced_at timestamptz
  unique (sheet_id, tab, row_key)

sheet_sync_runs
  id, started_at, finished_at, tabs_read, rows_changed, rows_written, errors jsonb, formula_cells int

sheet_cell_writes                             -- audit of every write-through
  id, tab, row_key, column, old_value, new_value, actor_id, written_at, status (ok|pending|refused_formula|conflict)
```

`sheet_rows` holds every tab as-is, so a new column the owner adds to the sheet appears in Internal on the next sync with no code change (it renders under "Other fields" until mapped).

**Projections** (typed, queryable, feed the existing UI, actions, API and search):

- `People` → `crm_contacts` (existing table). Add `external_id` (`person_id`), `external_source = 'valytica-sheet'`, unique on `(workspace_id, external_source, external_id)`. Existing typed columns map directly: `name ← full_name`, `email`, `phone`, `title ← specialisation`, `leadScore ← lead_score`, `source ← sources`. New typed columns for what the list filters on: `city`, `state`, `ibbi_reg_no`, `rvo`, `priority`, `opportunity_score`, `score_band`, `research_status`, `best_first_channel`, `outreach_status` (Internal-owned, §5), `last_contacted_at` (Internal-owned).
- `Companies` → `crm_accounts` with `external_id` (`company_id`), plus `city`, `state`, `ibbi_entity_reg_no`, `constitution`, `pnb_category`, `research_confidence`.
- **Institutional rows in People**: a `specialisation` that starts with `INSTITUTIONAL` projects to `persona = 'institutional'` and is excluded from every valuer count and valuer filter (Priority board, Dataset-style KPIs, comparables of "valuers with phone"). `sources` containing `Lender Contacts` is the secondary provenance signal, never the deciding one. Blank IBBI / RVO fields are **not** used to infer this: many genuine valuers have them blank too.
- Person ↔ company: from Companies.`linked_person_ids` (id-based, reliable) first, then People.`company_names` by normalised name as a fallback, flagged as `link_source = 'name'`.
- `Prospect Intelligence`, `Research Queue`, `Deep Dive Dossiers`, IOV cross-match: kept in `sheet_rows`, joined to the contact by `person_id`; when `Person ID` is blank, by exact `Full Name` match against People, shown with an "unlinked, no person_id" warning (the §9.2 request resolves this properly).
- `Lender Contacts` / `Association Officers` / `RVOs` / `Lender Landscape` / `Referral Map` / `GTM Personas` / `Exclusions` / `Source Inventory` / `Scoring Model`: `sheet_rows` only, rendered as directories and reference panels. Derived keys until id columns exist: Lender Contacts = `institution | office_level | department | contact_person_name`; Association Officers = `organisation | branch | person_name`; Referral Map = `Institution / Association | Contact / Role`; Exclusions = `Entity / Person`.

### 3.4 Conflict rule

Per mapped cell Internal keeps the value it last saw from the sheet (`sheet_rows.data`). On pull, a cell whose sheet value differs from that snapshot has changed in the sheet and is applied to the projection. On push, Internal writes the cell and updates the snapshot in the same request. If both moved between two syncs, the sheet wins (it is the source of truth) and a `conflict` row is written to `sheet_cell_writes` and surfaced on the person's timeline as "sheet overrode your edit to X (was …, now …)". With write-through the window is the 15-minute cron interval at most, and in practice the few seconds around a save.

### 3.5 Near-real-time (optional, cheap)

An Apps Script `onEdit` trigger in the workbook that POSTs `{tab, personIdOrRow}` to `/api/sheet-sync/ping` with `SHEET_SYNC_SECRET`. The handler just schedules a targeted pull of that tab. This is a trigger inside the sheet, not a schema change, and it turns "edited in the sheet, visible in Internal within 15 min" into "within seconds". Drive push notifications (`files.watch`) need channel renewal every 24h and are not worth it at this size.

### 3.6 Reconciling what Internal already holds

`crm_contacts` / `crm_accounts` already carry an earlier snapshot of the same lead database, loaded from JSON by `load-valytica-leads.ts`, `load-valytica-lead-intel.ts`, `load-valytica-lenders-and-firms.ts`, `load-valytica-partners.ts`, matched by *name*, with no stable id. Migration, run once:

1. Pull the sheet. For each existing contact without `external_id`, match a People row by `ibbi_reg_no` → email → phone → normalised name + state. Attach `external_id` on a unique match; leave a `reconcile_unmatched` flag otherwise (expected: a few dozen, mostly the earlier loader's compound firm names).
2. Same for accounts: `ibbi_entity_reg_no` → website → normalised name.
3. Existing `crm_activities` notes (the "Sales angle —" intel notes) stay attached; their content now also lives in the sheet's `sales_angle`, so the note is marked superseded rather than deleted.
4. Delete the four JSON loaders and their `db:` scripts. The sheet replaces them; a loader that can run again is a second writer with a different key.
5. `churned` accounts (Intech was written off via `exclude-intech.ts`) map onto the sheet's `Exclusions` tab, which already lists Intech. Internal's exclusion check reads the sheet's list, not the `churned` flag.

---

## 4. Field mapping

Lives in one file, `src/lib/sheet-crm/mapping.ts`, and is the only place headers are spelled. Each entry: `{ tab, header, projection?: { table, column, parse }, writable: boolean, derived: boolean }`. Tests assert every header in the mapping exists in a fixture of the real header rows, so a renamed column fails `pnpm test` instead of silently syncing nothing.

### 4.1 Parsing rules (read side)

- `;`-separated multi-values (`email`, `sources`, `empanelled_with`, `linked_person_ids`, `iov_membership_no`) → arrays; first email is the primary.
- Phones normalised to E.164 `+91…` for *matching and dialling only*; the displayed value stays as written in the sheet (the sheet's format is the sheet's business). A bare 6-digit exchange number is kept but flagged "needs STD code".
- Dates: `DD Mon, YYYY` and `DD Month, YYYY` (masters), ISO (GTM tabs); unparseable stays as text with the original shown.
- Enum-like columns are normalised for filtering (`High`/`high` → `high`) but the sheet cell is never rewritten to the normalised form.
- Names: `normalized_name_key` from the sheet is used for matching; Internal does not compute its own.

### 4.2 Read-only columns

Every derived column in §1.3, every `Dataset Summary` cell, every `Priority Dashboard` cell, and any cell that carries a formula at sync time.

### 4.3 Writable columns (write-through from Internal)

Proposed initial set, all existing columns, no schema change:

- People: `email`, `phone`, `website`, `linkedin`, `city`, `pincode`, `whatsapp_available`, `firm_name`, `specialisation`, `current_tooling_signal`, `sales_angle`, `research_confidence`, `remarks`.
- Companies: `email`, `phone`, `website`, `linkedin`, `city`, `decision_makers`, `decision_maker_contacts`, `current_tooling_signal`, `sales_angle`, `research_confidence`, `remarks`.
- Prospect Intelligence: `Research Status`, `Priority`, `Public Phone`, `Public Email`, `LinkedIn`, `Best First Channel`, `Personalized Opening Angle`, `Next Action`, `Last Researched`, the seven factor columns, `Score Reason`, `Score Gaps / Unknowns`, `Score Last Reviewed` (but **not** `Opportunity Score /100` or `Score Band`, which are formulas).
- Research Queue: `Research Status`, `Next Research Task`, `Target Completion Order`, the four `Missing …` columns, `Notes`.
- Deep Dive Dossiers: `Status`, `Next Action`, and the script columns (`WhatsApp Opener`, `Call Opener`, `Email / LinkedIn Angle`, `Content Asset To Share`, `Demo Sequence`) so an opener refined in Internal is the one the sheet carries.
- Referral Map: `Status`, `Owner`, `Next Action`, `Notes`.

Everything else is read-only in v1 and can be promoted per column later. Adding a *row* (a new person discovered in Internal) goes through the README's pre-insert checklist: Exclusions search, then IBBI → email → phone → name+state+city+PIN duplicate search over the mirror, then append to `People` with the next `person_id` **only if the owner approves that Internal may allocate ids** (§9.2d). Until then, "Add person" in Internal creates a *proposal* row in Internal and a task for whoever curates the sheet.

---

## 5. The interaction layer (what the sheet cannot hold)

One table, one timeline per person and per company:

```
interactions
  id uuid pk, workspace_id
  contact_id -> crm_contacts, account_id -> crm_accounts (either or both)
  channel   whatsapp | linkedin | email | call | meeting | sms | note | task | sheet_change
  direction out | in | none
  occurred_at timestamptz
  subject text, body text (bounded), summary text
  source    manual | gmail | gcal | standup-ai | slack | api | sheet-sync
  external_ref text            -- gmail message id, calendar event id, standup summary key, sheet cell write id
  actor_id -> users
  unique (workspace_id, source, external_ref) where external_ref is not null   -- idempotent ingestion
```

`crm_activities` (existing: note/call/email/task/meeting with `done`/`dueDate`) keeps the *task* half; `interactions` is the *history* half. The person page renders both on one timeline. The existing `POST /api/v1/activities` stays and gains a sibling `POST /api/v1/interactions`.

Per-contact **outreach state**, Internal-owned, on `crm_contacts`: `outreach_status` ∈ `not_planned | planned | contacted | replied | meeting_booked | met | pilot | paying | lost | excluded`, plus `last_contacted_at`, `last_channel`, `next_action_at`. Status advances automatically from interactions (an outbound WhatsApp log → `contacted`; an inbound email → `replied`; a calendar event with the contact → `meeting_booked`; a Standup AI summary for that event → `met`) and can be set by hand. This is the funnel the sheet does not have; if §9.2a is approved it is mirrored into two new People columns so the sheet-side view shows it too.

### 5.1 Sources

| Source | Mechanism | v1? |
|---|---|---|
| **Manual log** | "Log interaction" on every person/company page and in the list row: channel, direction, one line, optional paste of the message. | yes |
| **WhatsApp** | **Deferred (decision 2026-09-20: skip for now).** No `wa.me` deep link, no Business Cloud API. A WhatsApp conversation is recorded through the manual log (channel `whatsapp`, direction, one line, optional paste) like any other channel, and the dossier's `WhatsApp Opener` is shown with a Copy button only. Revisit once outreach is running; the two options (deep-link-and-log from the founder's number, or a Business Cloud API number with template approval) are unchanged. | manual log only |
| **LinkedIn** | No messaging API. Same pattern: **Open profile** + log with the `Email / LinkedIn Angle` prefilled for copy. Later: the Valytica Capture extension pattern (a content script the founder clicks on a LinkedIn thread that posts the visible conversation to Internal) — the extension repo already has the auth and submit plumbing. | yes (log) / later (extension) |
| **Email (Gmail)** | Per-user Google OAuth on Internal (scopes `gmail.readonly` + `gmail.compose`, `calendar.readonly` + `calendar.events`), tokens encrypted at rest on `users`. Cron every 15 min: `messages.list` with `q = (from:a OR to:a OR from:b …) newer_than:2d` over the addresses of contacts in `outreach_status ≠ not_planned` (a bounded set, tens not thousands), store id, thread id, subject, snippet, direction; full body fetched on demand. **Compose from Internal**: a "Draft email" action creates a Gmail *draft* (never sends) prefilled from the dossier angle, opens it in Gmail, and logs the interaction when the sent copy appears in the thread. | yes |
| **Calendar** | `events.list` for the next 14 days and past 7; match attendee emails to contacts → `meeting` interaction (`meeting_booked`), shown on the person page and in the daily brief with the dossier as prep. A "Book a call" action creates the event with the contact as attendee and a Meet link. | yes |
| **Meetings (Standup AI + Recall.ai)** | Standup AI already runs the Recall bot → Gemini summary → action items pipeline for standups. Add a *customer-call* mode: for a calendar event matched to a CRM contact, Internal calls `POST /standup/start` with the Meet URL and `source: "crm"`, `contact_ref: person_id`; on `bot.done` Standup AI POSTs the summary, decisions and proposed action items to `POST /api/v1/interactions` (`source = standup-ai`, `external_ref = summary key`) and files approved action items as issues via the existing `POST /api/v1/issues` with `externalId` (idempotent, already built). Requires the still-open Task 1 of the 2026-07-30 Standup AI plan (API key + webhook registration) plus a small connector on their side. Identity: Standup AI's `team.yaml` covers *our* people; prospects resolve on our side by the `person_id` the dispatch carried, never by name-matching the transcript. | phase 4 |
| **Slack** | Existing `slack.ts`: post to a `#valytica-sales` channel on reply received, meeting booked, meeting summary landed, sync conflict. | phase 3 |
| **Standup mentions** | Daily standup summaries that name a prospect: Standup AI's chat/skills query `GET /api/v1/contacts?q=` (existing) to link the name to a person and post a `note` interaction with a link to the summary. Best-effort, clearly labelled "mentioned in standup". | phase 4 |
| **Sheet changes** | Every changed research cell on pull becomes a `sheet_change` interaction ("Research Status → Deep dive complete; Next Action edited"), so the timeline shows research and outreach interleaved. | yes |

### 5.2 Daily founder brief

Extend the existing 07:00 digest cron with a Valytica section: meetings today with the one-line pitch and opener for each; replies received since yesterday; `next_action_at` due; prospects in `planned` for more than N days; sync conflicts and refused writes; sheet data-quality items newly detected.

---

## 6. The rewritten Sales surface

`/projects/VAL/sales` (and the company-wide `/sales` lens) becomes a **Prospects** workspace. Everything below reads from the projections and `sheet_rows`; the `deals` board is kept for real commercial opportunities and moves to its own tab.

1. **Priority board (default)**: the scored prospects in score order, then Priority A without a score, then B/C/D. Columns: name, city/state, Band + Score, Priority, `Best First Channel`, `outreach_status`, last contact, `Next Action`. Filters: state, city, priority, band, has phone / has email / WhatsApp availability, RVO, PNB category, persona, outreach status, "unlinked to person_id", "in Exclusions". Bulk: set outreach status, assign owner, create tasks.
2. **All people**: the full People mirror (5.6k) with server-side search (name, IBBI, email, phone, city, firm) — the current client-side filter over hundreds of rows will not carry 5.6k × 48 columns. Same row actions.
3. **Person page** (`/people/<uuid>`; `person_id` shown as the display id, never a sequential id in the URL):
   - Header: name, `P#####`, IBBI number, RVO, city/state, firm link, priority/band/score chips, outreach status control, **hard "Do not contact" banner when the name or any alias appears in Exclusions** (send buttons hidden, not just disabled).
   - *Overview*: `Valytica Angle`, `Primary Wedge`, `Primary Trigger`, `Pain Point Hypothesis`, `Next Action`, score breakdown with the seven factors, `Score Reason`, `Score Gaps / Unknowns`, research completeness.
   - *Playbook*: `One-Line Pitch`, `WhatsApp Opener`, `Call Opener`, `Email / LinkedIn Angle`, `Demo Sequence` (rendered as numbered steps), `Content Asset To Share` resolved to a real link via the content library (§7). Buttons: Copy opener, Draft email, Open LinkedIn, Book a call, Log interaction.
   - *Evidence*: bank / lender relationships, association roles, IOV rows, sources with URLs, `enrichment_sources`, `Competitor / Risk Note`, `FACT:` / `HYPOTHESIS:` lines kept verbatim.
   - *Network*: linked company, Referral Map rows that name this person, Lender Contacts on their verified panels, association officers in their branch.
   - *Timeline*: interactions + tasks + sheet changes, newest first, channel-filterable.
   - *Details*: every People column grouped (identity, contact, practice, panels, IOV, research, entity resolution). Writable ones are inline-editable and show sync state (synced / pending / refused: formula / conflict); read-only ones say why.
4. **Company page**: same shape over Companies; key people resolved through `linked_person_ids`; decision-maker contacts parsed for click-to-log.
5. **Directories**: Lender Landscape + Lender Contacts (grouped by institution, sorted by relevance, with `method_of_contact` and `empanelment_open_window` up front); Association Officers (by organisation → branch → state); RVOs with approach notes and the suspension flag. All rows loggable.
6. **Research queue**: the sheet's queue as a board ordered by `Target Completion Order`, the four `Missing …` gap columns as chips, inline edits write through. A "Claim" assigns an Internal task to a member.
7. **Data quality**: the §1.5 findings computed live (duplicate candidates by IBBI/email/phone/name+address, shifted rows detected by type checks per column, unlinked prospects, blank-city-with-address, non-lender tokens in `empanelled_with`), each with "open in sheet" (a cell-addressed link) and "create task". Nothing auto-fixed.
8. **Sync panel**: last run, rows changed, pending writes, conflicts, refused formula writes, drift (a header present in the mapping but missing in the sheet, or vice versa), "Sync now".

Access: today the Sales department is admin-only (`canSeeConfidential`). Keep that for the deals tab; the prospect list, directories and playbooks should be visible to whoever does outreach (members), matching the earlier "open Sales to members" change for the CRM tabs.

## 7. The rewritten Marketing surface

Marketing keeps `campaigns` and `content_items` and gains three things the sheet makes possible:

1. **Personas** (from `GTM Personas`): the reference panel, and a `persona` chip on each prospect (from `Deep Dive.Persona / GTM Role`, normalised to the persona list). Segments = persona × state × band.
2. **Content library**: `content_items` become the resolver for the dossiers' `Content Asset To Share` and `Custom Story / Content Idea` strings. Each dossier asset name is matched to a content item (fuzzy, with a confirm step); unresolved assets appear as "content to make" in the calendar, which is the marketing backlog the sheet already implies (the 45-second videos, the "Category B: can every field prove itself" asset, the Proprify-aware challenge).
3. **Campaigns as sequences**: a campaign targets a segment; "Send" per contact uses the same email and log actions as the person page, logs the interaction with `campaign_id`, and the campaign's `reach / replies / conversions` are computed from interactions rather than typed. Channel attribution ("which channel produced replies") is then real.

`Source Inventory` renders as a read-only panel on the marketing page so nobody re-runs a sweep the sheet says is closed.

## 8. API and agents

- New: `GET /api/v1/people` (`?q= &state= &priority= &band= &status= &person_id=`), `GET /api/v1/people/{id}` (row + playbook + timeline), `PATCH /api/v1/people/{id}` (writable columns only; write-through), `GET /api/v1/companies…`, `GET/POST /api/v1/interactions`, `POST /api/v1/sheet-sync`, `GET /api/v1/sheet-sync/runs`.
- MCP server gains the same as tools (`search_people`, `get_person`, `update_person`, `log_interaction`, `sync_sheet`), so a research agent updating a dossier does it through Internal and the sheet cell updates with an audit row and actor, instead of editing the sheet blind.
- Webhook events: `person.updated`, `interaction.created`, `sheet.conflict`.

---

## 9. Decisions needed before building

### 9.1 Access and env
1. A Google **service account** for the Sheets API (recommend the existing GCP project `valytica`, SA `internal-sheets@…`), the workbook shared with it as Editor. Env on Internal Prod + Preview: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` (Sensitive), `VALYTICA_CRM_SHEET_ID`, `SHEET_SYNC_SECRET`.
2. A Google **OAuth client** (Web) for per-user Gmail + Calendar on Internal: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, redirect `https://internal.gnanalytica.com/api/google/callback`. Scopes `gmail.readonly`, `gmail.compose`, `calendar.events`. Google Workspace internal app, so no verification review.
3. `DATABASE_URL` for Internal's Neon: the Vercel env listing is not readable from this session (403), so either share it for the reconcile migration and `pnpm db:push`, or run those two after merge.
4. Standup AI: an Internal API key + webhook (Task 1 of the 2026-07-30 plan, still open) and agreement to add the customer-call mode on their side.

### 9.2 Sheet schema requests (each needs an explicit yes; each has a fallback)
a. **Two columns at the end of `People` and `Companies`: `outreach_status`, `last_contacted_at`** (Internal-owned, written by Internal, never by formula). Fallback: outreach state lives only in Internal.
b. ~~Assign `person_id`s to the 10 prospects without one~~ **Done 2026-09-20** (§1.5 item 6): bank-side people live in People with permanent ids, marked by the `INSTITUTIONAL` prefix in `specialisation` (§3.3). No `entity_type` column was added and none is needed.
c. **Id columns on `Lender Contacts` (`lender_contact_id`, `L####`) and `Association Officers` (`officer_id`, `O####`)**. Fallback: derived composite keys, which break when a name is corrected.
d. **May Internal allocate the next `person_id` / `company_id`** when a verified new person is added from Internal (after the README's duplicate checklist)? Fallback: proposals only; a human appends the row in the sheet.
e. The column-shift rows in §1.5 item 1 need a human to fix in the sheet; Internal will list them, not touch them.

### 9.3 Cadence and write scope
- 15-minute pull + write-through as designed, or a different interval.
- The writable column set in §4.3: confirm, trim or extend.

### 9.4 WhatsApp
**Decided 2026-09-20: skipped for now.** Manual logging only (§5.1); no deep link and no Business Cloud API in any phase until revisited.

### 9.5 Data residency
The workbook holds personal data of ~5.6k professionals from public registers (IBBI, bank panels). Internal's Neon region and Vercel region should be checked before the mirror goes live; if the Neon project is outside India, decide whether the full mirror or a South-India-only projection is acceptable, or move the database. The interaction layer (email snippets, meeting summaries) is more sensitive than the register data and should be bounded (snippet + link, not full bodies) as designed.

---

## 10. Phasing

| Phase | What ships | Depends on | Size |
|---|---|---|---|
| 0 | SA access, env, a `pnpm sheet:probe` script that prints tabs, header rows, formula-column map and row counts; mapping file with header tests | 9.1.1 | ½ day |
| 1 | `sheet_rows` mirror + cron pull + change detection + sync runs; People/Companies projections; reconcile migration; delete the JSON loaders; sync panel | Phase 0, 9.1.3 | 2–3 days |
| 2 | Prospects workspace: priority board, all-people search, person + company pages (overview, playbook, evidence, network, details with write-through), directories, research queue, exclusions enforcement, data-quality panel | Phase 1, 9.2, 9.3 | 3–4 days |
| 3 | Interaction layer: `interactions`, manual log (all channels, WhatsApp included), LinkedIn open-and-log with the angle prefilled for copy, outreach status, Gmail + Calendar OAuth ingestion, draft-email and book-a-call actions, timeline, daily brief, Slack posts | Phase 2, 9.1.2 | 2–3 days |
| 4 | Standup AI customer-call mode → meeting summaries and action items on the timeline; standup mentions; MCP tools; API endpoints and webhook events | Phase 3, 9.1.4 | 2–3 days (Internal side) + connector work in Standup AI |
| 5 | Marketing: personas, content library resolving dossier assets, campaigns as sequences with computed attribution, Source Inventory panel | Phase 3 | 2 days |

Phase 1 is safe to ship alone: it is read-mostly, changes nothing in the sheet, and immediately replaces the stale name-matched JSON loads with id-keyed data.

---

## Appendix A: exact header rows (for the mapping file)

**People (48):** `person_id`, `full_name`, `ibbi_reg_no`, `ibbi_asset_class`, `ibbi_reg_date`, `rvo`, `email`, `phone`, `address`, `city`, `state`, `pincode`, `is_south_india`, `company_names`, `company_ibbi_reg_nos`, `company_link_source`, `empanelled_with`, `num_empanelments`, `lead_score`, `pnb_zone`, `pnb_category`, `pnb_constitution`, `other_asset_classes`, `sources`, `source_count`, `remarks`, `website`, `linkedin`, `firm_name`, `firm_size`, `years_practice`, `specialisation`, `associations_and_roles`, `iov_membership_no`, `iov_asset_class`, `iov_approved_valuer`, `iov_match_confidence`, `whatsapp_available`, `current_tooling_signal`, `sales_angle`, `research_confidence`, `enrichment_sources`, `data_quality_flag`, `canonical_entity_key`, `normalized_name_key`, `duplicate_flag`, `duplicate_match_ids`, `match_rule`

**Companies (40):** `company_id`, `company_name`, `constitution`, `ibbi_entity_reg_no`, `asset_classes`, `ibbi_reg_date`, `rvo`, `email`, `phone`, `website`, `address`, `city`, `state`, `pincode`, `is_south_india`, `key_people`, `key_people_ibbi_reg_nos`, `linked_person_ids`, `num_linked_people`, `empanelled_with`, `pnb_zone`, `pnb_category`, `sources`, `remarks`, `linkedin`, `num_valuers`, `branch_offices`, `service_lines`, `decision_makers`, `decision_maker_contacts`, `volume_signal`, `current_tooling_signal`, `sales_angle`, `research_confidence`, `enrichment_sources`, `canonical_entity_key`, `normalized_name_key`, `duplicate_flag`, `duplicate_match_ids`, `match_rule`

**RVOs (12):** `rvo_name`, `acronym`, `parent_body`, `address`, `phone`, `email`, `website`, `key_people`, `asset_classes`, `lb_valuer_count`, `outreach_channels`, `approach_notes`

**Lender Landscape (4, header on row 2):** `institution`, `institution_type`, `relevance_to_valytica`, `notes`

**Lender Contacts (18, header on row 2):** `institution`, `institution_type`, `office_level`, `city`, `state`, `department`, `contact_person_name`, `designation`, `email`, `phone`, `address`, `website_url`, `empanelment_page_url`, `method_of_contact`, `empanelment_open_window`, `approach_notes`, `confidence`, `source_url`

**Association Officers (13, header on row 2):** `organisation`, `branch`, `city`, `state`, `person_name`, `designation`, `mobile`, `alt_phone`, `email`, `address`, `term_year`, `notes`, `source_url`

**IOV cross-match (8, header on row 2):** `person_id`, `name_key`, `our_state`, `iov_state`, `iov_membership_no`, `iov_asset_class`, `iov_approved_valuer`, `match_confidence`

**Source Inventory (7):** `source`, `type`, `rows_captured`, `l_and_b_rows_used`, `contributed`, `status`, `url_or_note`

**Prospect Intelligence (44):** `Research Status`, `Priority`, `Person ID`, `Full Name`, `City`, `State`, `Practice / Firm`, `IBBI Reg No`, `RVO`, `Public Phone`, `Public Email`, `Website`, `LinkedIn`, `Verified Current Bank / Lender Relationships`, `Relationship Evidence / Recency`, `Association / Influence Role`, `Bank-Side Contact / Decision Path`, `Warm Referral Path`, `Evidence-Backed Workflow Signal`, `Pain Point Hypothesis (Inferred)`, `Valytica Angle`, `Best First Channel`, `Personalized Opening Angle`, `Lead Role`, `Competitor / Risk Note`, `Last Researched`, `Source URLs`, `Confidence`, `Active Practice /20`, `Workflow Pain /20`, `Valytica Fit /20`, `Commercial Potential /15`, `Reachability /10`, `Influence /5`, `Evidence Confidence /10`, `Opportunity Score /100`, `Score Band`, `Research Completeness %`, `Score Reason`, `Score Gaps / Unknowns`, `Primary Wedge`, `Primary Trigger`, `Next Action`, `Score Last Reviewed`

**Referral Map (16):** `Relationship Type`, `Institution / Association`, `Region`, `Contact / Role`, `Phone`, `Email`, `Relevant Prospects`, `Why This Matters`, `Recommended Ask`, `Evidence Date`, `Source URL`, `Confidence`, `Status`, `Owner`, `Next Action`, `Notes`

**Research Queue (14):** `Priority`, `Person ID`, `Full Name`, `State`, `City`, `Research Status`, `Why Prioritized`, `Missing Phone`, `Missing Current Bank Proof`, `Missing Association / Referral`, `Missing Firm / Tooling`, `Next Research Task`, `Target Completion Order`, `Notes`

**GTM Personas (10):** `Persona`, `GTM Role`, `Priority`, `Buyer/User/Influencer`, `Why It Matters`, `What We Want`, `Best Hook`, `Content / Demo To Show`, `What To Avoid`, `Research Criteria`

**Deep Dive Dossiers (26):** `Status`, `Priority`, `Prospect / Contact ID`, `Name`, `Persona / GTM Role`, `City`, `State`, `Organisation / Practice`, `Why This Person Now`, `Evidence / Proof`, `Likely Trigger`, `Pain Narrative`, `Valytica Wedge`, `One-Line Pitch`, `WhatsApp Opener`, `Call Opener`, `Email / LinkedIn Angle`, `Content Asset To Share`, `Custom Story / Content Idea`, `Demo Sequence`, `Public Phone`, `Public Email`, `Relevant People / Warm Paths`, `Bank / Lender Contacts`, `Source URLs`, `Next Action`

**Exclusions (8):** `Entity / Person`, `Type`, `Aliases / Related Names`, `Action`, `Reason`, `Applies To`, `Date Added`, `Notes`

**Scoring Model:** two stacked tables (`Valytica Opportunity Scoring Model` / `Max` / `What earns a high score` / `Do not confuse with`; `Score Band` / `Range` / `Meaning` / `Action`) plus a `Separate metrics` block. Read as reference text, not as rows.

**Priority Dashboard (16, header on row 3):** `Rank`, `Name`, `State`, `City`, `Score`, `Band`, `Completeness %`, `Practice`, `Pain`, `Fit`, `Commercial`, `Reach`, `Influence`, `Evidence`, `Primary Wedge`, `Next Action`

## Appendix B: enum domains observed (for filters; the sheet is not rewritten to these)

`Priority` A/B/C/D · `Score Band` A/B/C/Watch · `is_south_india` Yes/No · `pnb_category` A/B/C · `duplicate_flag` UNIQUE/DUPLICATE · `match_rule` IBBI/NAME_ONLY (People), COMPANY_NAME/IBBI_ENTITY/EMAIL (Companies) · `iov_match_confidence` high/medium-ambiguous-name/low-state-mismatch · `research_confidence` High/Medium/Low · `relevance_to_valytica` Very High/High/Medium · `institution_type` Public Sector Bank/Private Bank/HFC/NBFC/ARC/District Central Co-operative Bank/Development FI/… · `office_level` Head Office/Corporate Office/Regional Office/Zonal Office/Circle Office/… · `whatsapp_available` Yes/No/Unknown (only Unknown observed).

---

## 11. Build status (2026-09-20, PR #141)

Everything in §10 is built and passes `tsc`, `eslint --max-warnings=0`,
`vitest` and `next build`. Nothing has run against the live sheet or the
live database yet: the service account and `DATABASE_URL` were not available
in the build session. What each piece does while its env is absent:

| Piece | Without env |
|---|---|
| Sheet pull (`/api/cron/sheet-sync`, Sync now, `POST /api/v1/sheet-sync`) | 503 / "not configured" toast; nothing pretends to sync |
| Write-through from a person / company / queue field | Kept in Internal, logged as `pending` in `sheet_cell_writes`, shown as "kept in Internal" |
| Gmail / Calendar (`/api/cron/google-ingest`, Draft in Gmail, Book a call) | Settings card says "Not configured"; person page falls back to `mailto:` |
| Founder brief | Runs inside the digest cron; needs `RESEND_API_KEY` + `EMAIL_FROM` like the digest |

### Bring-up order

1. `pnpm db:push` (three new tables, one new grant table, new columns on `crm_contacts` / `crm_accounts`, two unique indexes).
2. Set `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `VALYTICA_CRM_SHEET_ID`, `SHEET_SYNC_SECRET` on Vercel (Production + Preview) and in `.env.local`; share the workbook with the SA as Editor.
3. `pnpm sheet:probe` — read-only. Every tab must print `✓` with its matched title and no `MISSING headers`. This is the check that the header signatures in `mapping.ts` match the live workbook (the Drive export they were derived from is not cell-faithful).
4. Open **Prospects → Sync** and press *Sync now* (or `curl -X POST /api/v1/sheet-sync` with an API key). First run writes ~6,000 mirror rows and projects them; later runs write only changes.
5. `pnpm db:reconcile-sheet` (dry run), then `--apply`: links the contacts the retired JSON loaders created to their `person_id`s, moving their activities and deals onto the synced rows.
6. Optional: the Apps Script `onEdit` trigger (the snippet is in `src/app/api/sheet-sync/ping/route.ts`) for near-real-time pulls.
7. Google OAuth client → `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`; then Settings → *Connect* under "Gmail & Calendar for prospects".
8. Standup AI: create an API key in Settings → API & MCP and hand it over with the contract below.

### Standup AI contract (their side)

For a calendar event whose attendee resolves to a person (Standup AI can ask
`GET /api/v1/people?q=<email>`), post the meeting outcome once `bot.done`
fires:

```
POST /api/v1/interactions
Authorization: Bearer int_…
{
  "personId": "P00145",              // or "contactId": "<uuid>"
  "channel": "meeting", "held": true,
  "source": "standup-ai",
  "externalRef": "summary:2026-09-21__abc",   // idempotent: a retry returns 200
  "occurredAt": "2026-09-21T10:30:00+05:30",
  "subject": "Valytica × Paleti Surendra",
  "summary": "<the canonical summary>",
  "externalUrl": "https://standup.gnanalytica.com/…",
  "meta": { "actionItems": [...], "decisions": [...], "participants": [...] }
}
```

Approved action items still go through `POST /api/v1/issues` with
`externalId`, as today. The person's outreach status advances to `met`, the
summary appears on their timeline, and Slack is notified.

### Sheet columns still to add (owner's call, both optional)

- `outreach_status`, `last_contacted_at` at the end of **People** and **Companies** — Internal writes them (RAW / date); until they exist every mirror write logs `column_absent` and the state lives in Internal only.
- `lender_contact_id` / `officer_id` on **Lender Contacts** / **Association Officers** — the mapping already keys on them when present, on the composite key otherwise.
