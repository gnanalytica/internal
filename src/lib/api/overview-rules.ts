/**
 * The pure half of the Overview endpoints (`/api/v1/portfolio`,
 * `/api/v1/workspace/bets`), kept free of the database for unit tests.
 */
import type { PortfolioRow } from "@/lib/types";

import { ApiInputError } from "./errors";
import { canSeeProject, type ApiScope } from "./scope-rules";

/** The web keeps at most five bets and edits three. */
export const MAX_BETS = 5;

/** Mirror of `updateCompanyBets`: trimmed, blanks dropped, at most five. */
export function cleanBets(input: unknown): string[] {
  if (!Array.isArray(input)) throw new ApiInputError("`bets` must be an array of strings.");
  if (input.some((b) => typeof b !== "string")) throw new ApiInputError("`bets` must be an array of strings.");
  return (input as string[])
    .map((b) => b.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, MAX_BETS);
}

export type PortfolioDto = Omit<PortfolioRow, "milestoneTarget"> & {
  milestoneTarget: string | null;
  /** Share of non-canceled issues that are done, 0–100. */
  progress: number;
};

/** The web's Overview rows the caller may see, as JSON. */
export function portfolioForScope(rows: PortfolioRow[], scope: ApiScope): PortfolioDto[] {
  return rows
    .filter((r) => canSeeProject(scope, r.id))
    .map((r) => ({
      ...r,
      milestoneTarget: r.milestoneTarget ? new Date(r.milestoneTarget).toISOString() : null,
      progress: r.totalIssues > 0 ? Math.round((r.doneIssues / r.totalIssues) * 100) : 0,
    }));
}
