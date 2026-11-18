import { canSeeProject, type ApiScope } from "@/lib/api/scope-rules";
import { TOOL_NAMES, TOOL_SPECS, type ToolName } from "./tools";

/**
 * Who may do what through the bot — the web app's rules, applied to a Slack
 * user:
 *
 * - someone whose Slack account isn't linked to an Internal member may ask
 *   read-only questions about non-confidential work, and nothing else;
 * - a linked member acts as themselves: reads and writes, Sales (the Valytica
 *   prospects) included, with confidential projects (Finance, People & HR)
 *   hidden exactly as the web hides them.
 *
 * The model is only offered the tools the caller may use, and every call is
 * checked again here before it runs, so a tool name the model invents or
 * remembers from earlier in a thread gets a refusal, not a result.
 */

export type Caller = {
  /** The Internal member this Slack user acts as, or null when unlinked. */
  userId: string | null;
  name: string | null;
  isAdmin: boolean;
};

export const isLinked = (c: Caller): boolean => c.userId !== null;

/** The tools offered to this caller, in the fixed definition order. */
export function toolsFor(caller: Caller): ToolName[] {
  return TOOL_NAMES.filter((n) => toolAccessError(n, caller) === null);
}

/** Why this caller may not use this tool, or null when they may. */
export function toolAccessError(name: ToolName, caller: Caller): string | null {
  const access = TOOL_SPECS[name].access;
  if (access === "anyone") return null;
  if (!isLinked(caller)) {
    return "This person's Slack account isn't linked to Internal, so they can only ask read-only questions. Tell them to link it in Settings › Slack.";
  }
  return null;
}

/** Keep the rows the caller may see, by their project. */
export function visibleTo<T>(scope: ApiScope, rows: T[], projectOf: (row: T) => string | null | undefined): T[] {
  return scope.restricted ? rows.filter((r) => canSeeProject(scope, projectOf(r))) : rows;
}
