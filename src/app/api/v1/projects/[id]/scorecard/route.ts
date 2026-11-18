import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiGetScorecard, apiSetScorecardValue, type WeekValueInput } from "@/lib/api/scorecard-ops";

type Params = { id: string };

/**
 * A project's weekly scorecard, as the web's first tab shows it: rows grouped
 * by area, the last five weeks (the last is this week), each row's target,
 * status and whether it is typed in or counted by the app, plus the notes the
 * web shows under it. `enabled: false` when the project has Analytics off.
 *
 * Sales rows follow the Sales rule: a caller who may not open Sales gets none.
 */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => ok({ data: await apiGetScorecard(auth, id) }));

/**
 * Type a number into a typed-in row: `{ "metricId": "…", "value": 42 }` for
 * this week, `"weekStart": "yyyy-mm-dd"` (a Monday) for another, and
 * `"value": null` to clear it. Counted rows answer 422.
 */
export const POST = withApiAuth<Params>(async (req, auth, { id }) =>
  ok({ data: await apiSetScorecardValue(auth, id, await readJson<WeekValueInput>(req)) }),
);
