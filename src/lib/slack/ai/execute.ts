import "server-only";

import type { ToolExecutor } from "./loop";
import { toolAccessError } from "./permissions";
import { dueFollowUps, getProspect, planTouch, searchProspects } from "./prospects";
import { fail, ok, type RequestCtx } from "./request";
import { commentOnTask, createTask, getTask, myWork, planTaskUpdate, projectStatusTool, searchTasks, threadToTask } from "./tasks";
import { isToolName, parseToolInput, type ToolName } from "./tools";

/**
 * Every tool call the model makes comes through here: is it a tool we have,
 * may this caller use it, is the input well-formed — and only then the tool
 * itself. A "no" at any step goes back to the model as an error result with
 * the reason, which it relays.
 */

type Store = { set(key: string, value: unknown, ttlMs?: number): Promise<void> };

export function executorFor(ctx: RequestCtx, store: Store): ToolExecutor {
  return async (name, raw) => {
    if (!isToolName(name)) return fail(`There's no tool called ${name}.`);
    const denied = toolAccessError(name, ctx.caller);
    if (denied) return fail(denied);
    return run(name, raw, ctx, store);
  };
}

async function run(name: ToolName, raw: unknown, ctx: RequestCtx, store: Store) {
  switch (name) {
    case "search_tasks": {
      const p = parseToolInput(name, raw);
      return p.ok ? searchTasks(ctx, p.value) : fail(p.error);
    }
    case "get_task": {
      const p = parseToolInput(name, raw);
      return p.ok ? getTask(ctx, p.value) : fail(p.error);
    }
    case "create_task": {
      const p = parseToolInput(name, raw);
      return p.ok ? createTask(ctx, p.value) : fail(p.error);
    }
    case "update_task": {
      const p = parseToolInput(name, raw);
      return p.ok ? planTaskUpdate(ctx, p.value, store) : fail(p.error);
    }
    case "comment_on_task": {
      const p = parseToolInput(name, raw);
      return p.ok ? commentOnTask(ctx, p.value) : fail(p.error);
    }
    case "search_prospects": {
      const p = parseToolInput(name, raw);
      return p.ok ? searchProspects(ctx, p.value) : fail(p.error);
    }
    case "get_prospect": {
      const p = parseToolInput(name, raw);
      return p.ok ? getProspect(ctx, p.value) : fail(p.error);
    }
    case "log_touch": {
      const p = parseToolInput(name, raw);
      return p.ok ? planTouch(ctx, p.value, store) : fail(p.error);
    }
    case "summarize_thread_to_task": {
      const p = parseToolInput(name, raw);
      return p.ok ? threadToTask(ctx, p.value) : fail(p.error);
    }
    case "get_my_work": {
      const p = parseToolInput(name, raw);
      if (!p.ok) return fail(p.error);
      const [tasks, followUps] = await Promise.all([
        myWork(ctx),
        ctx.caller.isAdmin ? dueFollowUps(ctx).catch(() => null) : Promise.resolve(null),
      ]);
      return ok({ ...tasks, ...(followUps ? { prospect_follow_ups_due: followUps } : {}) });
    }
    case "project_status": {
      const p = parseToolInput(name, raw);
      return p.ok ? projectStatusTool(ctx, p.value) : fail(p.error);
    }
  }
}
