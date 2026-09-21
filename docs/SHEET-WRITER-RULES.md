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

These five are a single `ARRAYFORMULA` living in row 2 and spilling down the
whole column:

```
canonical_entity_key   normalized_name_key   duplicate_flag
duplicate_match_ids    match_rule
```

Writing a value into **any** cell of one of these breaks the array for all
5,600+ rows, not just the row you touched. They are computed. Leave them alone
and let them recompute.

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

## 10. Do not add columns or rename headers

The sync identifies each tab by its header signature and refuses a tab it
cannot recognise. Adding a column is the sheet owner's decision. Renaming one
silently detaches every mapping that reads it.

---

## Quick self-check before writing a row

1. Have I searched by IBBI number, then by every email in the list, then by
   phone, then by name **plus** a corroborating detail?
2. Am I about to write into one of the five formula columns?
3. Is my `city` from the person's address, or from a bank's zone?
4. Am I appending to the `;` lists, or overwriting them?
5. Does this row carry at least one way to contact or verify the person?
6. Is this actually a firm?
