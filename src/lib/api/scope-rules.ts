/**
 * The pure half of the API visibility rules (see scope.ts), kept free of the
 * database so the rules themselves can be unit-tested.
 */
export type ApiScope = {
  restricted: boolean;
  hiddenProjectIds: ReadonlySet<string>;
  ownedProjectIds: ReadonlySet<string>;
};

export const UNRESTRICTED: ApiScope = { restricted: false, hiddenProjectIds: new Set(), ownedProjectIds: new Set() };

export const canSeeProject = (scope: ApiScope, projectId: string | null | undefined): boolean =>
  !scope.restricted || !projectId || !scope.hiddenProjectIds.has(projectId);

export const canSeeSales = (scope: ApiScope): boolean => !scope.restricted;

export const canSeeFinance = (scope: ApiScope, projectId: string | null | undefined): boolean =>
  !scope.restricted || (!!projectId && scope.ownedProjectIds.has(projectId) && !scope.hiddenProjectIds.has(projectId));

