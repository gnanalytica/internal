/**
 * Who on the team is responsible for a prospect.
 *
 * A plain module, not the `"use server"` one beside it: the filter control and
 * the list both need this sentinel, and Next allows only async exports from a
 * server-action file.
 *
 * The owner is **Internal's**, not the sheet's. `crm_contacts.owner_id` and
 * `crm_accounts.owner_id` hold a workspace member's uuid, which means nothing
 * inside a spreadsheet — so the mirror writes the member's NAME, into an
 * `owner` column that is optional and may not exist yet.
 */

/** Filter value for "nobody has picked this up". Not a user id, and cannot collide with one. */
export const UNASSIGNED = "unassigned";

/** Filter value for the person looking at the screen; resolved to their id before it reaches a query. */
export const MINE = "me";
