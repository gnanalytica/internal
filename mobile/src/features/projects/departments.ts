// Mirrors the web's src/lib/departments.ts (NESTED_DEPARTMENTS, departmentHref,
// projectCyclesHref) and src/lib/prospects/schema.ts (PROSPECTS_PRODUCT_KEY).
// Keep the two in step.

/** The product whose Sales is the prospects workspace (the sheet the team calls from). */
export const PROSPECTS_PRODUCT_KEY = "VAL";

/** Departments a project gets when it hasn't chosen any (`enabledDepartments` is null). */
const DEFAULT_ON = ["product", "engineering", "strategy"];

export function isDepartmentEnabled(enabled: string[] | null | undefined, slug: string): boolean {
  return (enabled ?? DEFAULT_ON).includes(slug);
}

/**
 * Departments that live inside another screen rather than as an entry of their
 * own: Analytics is the scorecard on the project's first screen, and Customer
 * Success is Sales → Customers. Enabling one still turns that view on.
 */
export const NESTED_DEPARTMENTS: readonly string[] = ["analytics", "customer-success"];

/** Whether a department gets its own entry in a project's department list. */
export const isTopLevelDepartment = (slug: string): boolean => !NESTED_DEPARTMENTS.includes(slug);

/**
 * Whether a project's cycles live inside its Engineering screen. Operations and
 * projects without Engineering keep a Cycles screen of their own.
 */
export const hasEngineering = (p: { kind: string; enabledDepartments: string[] | null }): boolean =>
  p.kind === "project" && isDepartmentEnabled(p.enabledDepartments, "engineering");
