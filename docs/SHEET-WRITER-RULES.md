# Rules for anything that writes rows into the Valytica CRM sheet

For the hourly research bot, any harvest script, and any person adding rows by
hand. Every rule here is written against a defect that was actually found and
fixed in the sheet on 2026-09-21 — 51 duplicate people merged, three broken
formulas repaired, 506 rows given stable ids. The counts are from that day.

The sheet is the source of truth. Internal mirrors it and writes back only
three columns (`outreach_status`, `last_contacted_at`, `owner`).

---

## 1. Match before you insert. This is the big one.

Every one of the 51 duplicates merged on 2026-09-21 had the same shape: an IBBI
register row and a bank-panel row for one person, created by two harvests that
never checked whether the person was already there.

**A new source for an existing person is an UPDATE, not a new row.** If you
find Harish C. Bhavsar on the PNB panel and the sheet already has Harish
Champaklal Bhavsar from the IBBI register, append `PNB` to that row's `sources`
and the panel to its `empanelled_with`. Do not add a second row.

Check for an existing person in this order and stop at the first hit:

| # | Key | Strength |
|---|---|---|
| 1 | `ibbi_reg_no` | **Decisive.** Unique across the tab — 3,100+ populated, zero collisions ever found. |
| 2 | any address in `email` (it is a `;` list — split it) | Strong, but see rule 4. |
| 3 | `phone`, last 10 digits | Strong, but see rule 4. |
| 4 | normalised name **plus** a corroborating address, pincode or locality | Weak. |

**A name alone is never a match.** 72 same-name pairs exist in this tab and 42
of them are provably different people holding different IBBI numbers. Two
valuers named S Rajakumar in Tamil Nadu is ordinary, not an error.

## 2. Never write to a formula column

These eight are a single `ARRAYFORMULA` living in row 2 and spilling down the
whole column:

```
canonical_entity_key   normalized_name_key   duplicate_flag
duplicate_match_ids    match_rule
source_count           num_empanelments      is_south_india
```

**The last three became formulas on 2026-09-26 and used to be hand-typed**, so
a writer that learned the sheet before that date will still be filling them in.
Stop: they are computed from `sources`, `empanelled_with` and `state`
respectively. Writing a number into one now breaks the column for all 5,600+
rows, exactly as it would for the other five.

They were converted because they were quietly wrong. Measured over 5,611 live
rows, the stored value disagreed with its own derivation on 75, 67 and 1 rows —
143 cells stating a count that did not match the list beside them, because a
researcher enriched `sources` and left `source_count` alone. **Update the
source column and the count now looks after itself.**

Writing a value into **any** cell of one of these breaks the array for all
5,600+ rows, not just the row you touched. They are computed. Leave them alone
and let them recompute.

**This has already happened once, and this is what it looks like.** On
2026-09-26 nine cells across four rows held written-in values. Every one of the
five columns had collapsed to a single cell reading

```
#REF! (Array result was not expanded because it would overwrite data in AT2038.)
```

and all 5,607 rows below it were blank. The duplicate detection the whole tab
relies on had been dark for days, and nothing announced it — the sheet simply
stopped answering the question. Note also that the message names only the
*first* blocker, so the visible complaint understates the damage.

**Where a duplicate finding actually goes: `remarks`.** The four values found
were good research — one was a correct duplicate call, one a do-not-merge
guardrail worth keeping. The mistake was purely the destination. These five
column names describe exactly what a dedupe pass concludes, which is the trap:
the column that sounds like the right home is the one that is computed. Write
the finding as a sentence in `remarks`, name the other `person_id`, and say what
the evidence was. A human reads `remarks`; nobody can act on a verdict that
blanked the column it was written into.

If two rows really are one person, `remarks` is where you say so — and then it
is a human's call to merge them, not yours (rule 9).

Repair, if it happens again: `pnpm sheet:fix-formula-blockers` finds the
blocking cells and, with `--apply`, clears them so the arrays recompute. It
refuses unless all five row-2 formulas are still intact, and snapshots whatever
it is about to discard.

## 3. `city` is where the PERSON is — never a bank's zone

403 rows have `city` exactly equal to `pnb_zone`, and on **218 of them the
city does not appear anywhere in the person's own address**. A valuer in
Tanuku, West Godavari is filed under Hyderabad. One in Katihar is filed under
Patna. One in Ambala, Haryana is filed under Punjab.

- `city` / `state` come from the person's **address**.
- The bank's administrative region goes in `pnb_zone` and nowhere else.
- If you only know the zone, **leave `city` empty**. A blank city is honest; a
  wrong one silently misroutes territory assignment and "who is near this
  property".

`city` may hold a `;` list — a valuer really can be based in two places. Keep
both. But two spellings of one place (Bangalore / Bengaluru) is one place.

`city` is also not the whole address. One row was found holding
`"D.No. 21/659, Beside Bank of Baroda, Seven Roads, Old RIMS Road, Kadapa
516001, YSR District, Andhra Pradesh"` in `city` while `address` sat empty. The
full address goes in `address`; `city` gets `Kadapa`, `pincode` gets `516001`,
`state` gets `Andhra Pradesh`. Everything that groups, counts or maps by city
reads that column literally, so one address in it becomes its own one-row city.

## 4. `email` and `phone` are semicolon lists

`bsnswamy1956@gmail.com; contact@sveellp.in` is one cell holding two addresses.

- **Append, never overwrite.** Overwriting drops the address the person
  actually answers.
- **When matching, split the list first.** Comparing whole cells misses a
  person whose second address matches your first.
- A shared address is often a **firm inbox**, not one person. `contact@sveellp.in`
  covers three different registered valuers. Corroborate before merging on it —
  6 of 34 email matches on 2026-09-21 turned out to be different people, four
  of them colleagues at one firm.

## 5. Do not create a row you cannot use

A row with a name and nothing else — no location, no email, no phone, no IBBI
number — cannot be contacted, cannot be deduplicated, and cannot be verified.
`P02406 HARSH VARDHAN` is such a row and it is stuck: there is no way to tell
whether it is the Harshvardhan in Katihar or a different person entirely.

Minimum for a new row: a name **plus at least one** of IBBI number, email,
phone, or a full address.

## 6. A firm is not a person

`R K ASSOCIATES` sits in the People tab. Worse, it carries
`ambiguous-merge: single-token name merged across sources` — the harvest had
already conflated several unrelated firms of that name into one row.

- Put firms in the **Companies** tab.
- Never merge rows on a generic or single-token name. "RK Associates" in
  Lucknow and "RK Associates" in Kolkata are two businesses.

## 7. Append to list columns; do not replace

`sources`, `empanelled_with`, `enrichment_sources`, `other_asset_classes`,
`associations_and_roles`, `company_names` and `city` are all `;` lists. A
second bank panel is another entry on the existing row.

## 8. Say when you are unsure

`data_quality_flag` exists for this and it works — it is what revealed the
`R K ASSOCIATES` conflation. Use it rather than writing a confident wrong
value. `state-unresolved`, `not cross-verified against IBBI register` and
`ambiguous-merge: …` are all real and all useful.

## 9. `person_id` is permanent

Never renumber, never reuse, never reorder rows to make ids sequential.
Internal's mirror, every audit row and every `iov_memberships` row keys on it.
A new person gets the next unused id.

If you delete a person row, re-point anything in another tab that names its
`person_id` first, or those rows become orphans.

## 10. The GTM columns on People (new, 2026-09-26)

People gained ten columns so the app could stop reading a person's research
status out of three other tabs:

```
research_status      not_started | in_progress | done
priority             A | B | C | D | WATCH
opportunity_score    0-100, per the Scoring Model tab
score_band           per the Scoring Model tab
persona              one of the GTM Personas tab's values
best_first_channel   whatsapp | email | call | referral | visit
next_action          the single next step, one line
why_now              the trigger — why this person, this month
pain                 the narrative, a few sentences
is_institutional     Yes on a bank/association row that is not a valuer
```

**`research_status` and `best_first_channel` are FREE TEXT, not vocabularies.**
An earlier version of this file gave them enum values
(`not_started | in_progress | done`, `whatsapp | email | call | referral | visit`).
That was wrong: the app stores both as `text` and renders them as a plain pill,
nothing filters or groups on them, and the 22 channel values already written are
real guidance — "WhatsApp first, then short founder call", "Email first;
association introduction only if available naturally". Flattening those to a
keyword would lose the sequence for no consumer's benefit. Write a sentence.

What the channel column must NOT hold is a pitch: three rows carried wedge text
("Professional-defensibility layer for a senior Category A valuer…"), which
belongs in `pain` or `remarks`.

`is_institutional` matters more than it looks. The app used to decide this from
an uppercase `INSTITUTIONAL` prefix on `associations_and_roles` or
`specialisation`; that convention still works as a fallback, but the column is
the answer now. **A bank officer written in without it is counted as a valuer**
in every number the product reports.

The first six mirror what Prospect Intelligence and Deep Dive Dossiers hold for
the ~26 researched people. Write them on the PERSON's row. Those three GTM tabs
still exist and still carry the long-form research (openers, evidence, source
URLs) — that content is **not** moving to People, because 53 columns populated
for 26 of 5,611 people would be worse on the directory than it is on its own
tab.

## 11. A column has a shape. Writing past it breaks the column, not the cell.

92 cells across the two master tabs hold a value of the wrong shape, and they
arrive in RUNS — 21 People rows and 4 Companies rows offend in two or more
columns at once, which is what a write that started one column off looks like.
The damage is that it is invisible: a paragraph in `data_quality_flag` still
renders, and `iov_match_confidence` holding `High` where the vocabulary is
lowercase `high` means every `COUNTIF(…,"high")` silently undercounts by 9.

The shapes, and what went wrong in each:

| Column | Shape | Found holding |
|---|---|---|
| `iov_match_confidence` | `high` / `medium-ambiguous-name` / `low-state-mismatch` | `High` on 9 rows |
| `research_confidence` | `High` / `Medium` / `Low` | sales prose, URL lists (11 rows) |
| `iov_approved_valuer` | `Yes` / `No` | a COP-validity sentence; `Land & Building` |
| `website`, `linkedin` | a URL | paragraphs (25 rows), and URLs with no `https://` |
| `data_quality_flag` | a short label | 136–476 char paragraphs (12 rows) |
| `company_link_source` | a source label | a 168-char sentence |
| `iov_asset_class` | an asset class | a membership number |
| `iov_membership_no` | a number | an associations-and-roles string |

**Check the column you are about to write is the column you mean**, especially
when writing a run of adjacent cells: `sources`, `source_count`, `remarks`,
`website` sit next to each other, and so do `sales_angle`,
`research_confidence`, `enrichment_sources`. Four rows have `remarks` holding
the single character `1`, which is a count that landed one column late.

`pnpm sheet:audit-values` lists every offending cell.
`pnpm sheet:repair-values --apply` fixes the ones whose right answer is provable
from the cell itself — a case fold, a URL missing its scheme, prose moved to
`remarks` (or to `enrichment_sources` when the value is nothing but URLs). It
deliberately does **not** guess at a multi-column rotation; moving real research
one column further from where it belongs is the defect, not the fix.

## 12. Do not add columns or rename headers

The sync identifies each tab by its header signature and refuses a tab it
cannot recognise. Adding a column is the sheet owner's decision. Renaming one
silently detaches every mapping that reads it.

---

## Quick self-check before writing a row

1. Have I searched by IBBI number, then by every email in the list, then by
   phone, then by name **plus** a corroborating detail?
2. Am I about to write into one of the eight formula columns? (`source_count`,
   `num_empanelments` and `is_south_india` joined that list on 2026-09-26.)
3. Is my `city` from the person's address, or from a bank's zone?
4. Am I appending to the `;` lists, or overwriting them?
5. Does this row carry at least one way to contact or verify the person?
6. Is this actually a firm?
7. If this row is a bank officer or an association contact rather than a valuer,
   have I set `is_institutional`? Without it they are counted as a valuer.
8. Is every value in a column that holds that SHAPE — a URL in `website`, a
   short label in `data_quality_flag`, lowercase `high` in
   `iov_match_confidence`? Run `pnpm sheet:audit-values` if you wrote a run of
   adjacent cells.
