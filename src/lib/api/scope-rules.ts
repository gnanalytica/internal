/**
 * The pure half of the API visibility rules (see scope.ts), kept free of the
 * database so the rules themselves can be unit-tested.
 */
import { canSeeDepartment } from "@/lib/departments";

export type ApiScope = {
  restricted: boolean;
  hiddenProjectIds: ReadonlySet<string>;
  ownedProjectIds: ReadonlySet<string>;
};

export const UNRESTRICTED: ApiScope = { restricted: false, hiddenProjectIds: new Set(), ownedProjectIds: new Set() };

export const canSeeProject = (scope: ApiScope, projectId: string | null | undefined): boolean =>
  !scope.restricted || !projectId || !scope.hiddenProjectIds.has(projectId);

/** Sales follows the web's department rule: a restricted (member) caller gets it
 *  exactly when a member sees the Sales tab. */
export const canSeeSales = (scope: ApiScope): boolean =>
  canSeeDepartment("sales", scope.restricted ? "member" : "admin");

export const canSeeFinance = (scope: ApiScope, projectId: string | null | undefined): boolean =>
  !scope.restricted || (!!projectId && scope.ownedProjectIds.has(projectId) && !scope.hiddenProjectIds.has(projectId));

