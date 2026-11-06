import type { SlackBot } from "./types";

/**
 * Two Slack payloads the Chat SDK's Slack adapter (4.44) verifies but doesn't
 * route to any handler: the `link_shared` event (unfurls) and the
 * `message_action` interaction (message shortcuts like "Create task"). Rather
 * than parse webhooks a second time in the route, this hooks the adapter's two
 * dispatch points — after it has checked Slack's signature and dropped retried
 * deliveries — and hands those payloads to the handler modules. Everything
 * else goes on to the adapter exactly as before.
 *
 * Registering only wraps two methods on the adapter instance; no I/O, so it
 * fits the handler contract (types.ts). Each payload type has one handler.
 */

type WaitUntil = { waitUntil?: (task: Promise<unknown>) => void };
type Payload = Record<string, unknown> & { type?: string; event?: Record<string, unknown> & { type?: string } };

/** The adapter's dispatch methods (protected in its types; present on every instance). */
type Dispatch = {
  processEventPayload(payload: Payload, options?: WaitUntil): void;
  dispatchInteractivePayload(payload: Payload, options?: WaitUntil): Response | Promise<Response>;
};

export type RawEventHandler = (event: Record<string, unknown>, payload: Payload) => Promise<void>;
export type RawInteractionHandler = (payload: Payload) => Promise<void>;

type Hooks = { events: Map<string, RawEventHandler>; interactions: Map<string, RawInteractionHandler> };
const installed = new WeakMap<object, Hooks>();

const report = (what: string) => (err: unknown) => console.error(`[slack] ${what} failed:`, err);

function hooksFor(bot: SlackBot): Hooks {
  const adapter = bot.getAdapter("slack") as unknown as Dispatch;
  const existing = installed.get(adapter);
  if (existing) return existing;
  const hooks: Hooks = { events: new Map(), interactions: new Map() };
  installed.set(adapter, hooks);

  const processEvent = adapter.processEventPayload.bind(adapter);
  adapter.processEventPayload = (payload, options) => {
    const type = payload?.type === "event_callback" ? payload.event?.type : undefined;
    const handler = type ? hooks.events.get(type) : undefined;
    if (!handler || !payload.event) return processEvent(payload, options);
    const task = handler(payload.event, payload).catch(report(`${type} handler`));
    options?.waitUntil?.(task);
  };

  const dispatch = adapter.dispatchInteractivePayload.bind(adapter);
  adapter.dispatchInteractivePayload = (payload, options) => {
    const handler = payload?.type ? hooks.interactions.get(payload.type) : undefined;
    if (!handler) return dispatch(payload, options);
    // Acknowledge at once (Slack wants it within 3s); the work runs after.
    const task = handler(payload).catch(report(`${payload.type} handler`));
    options?.waitUntil?.(task);
    return new Response("", { status: 200 });
  };
  return hooks;
}

/** Handle an Events API event type the adapter ignores (e.g. `link_shared`). */
export function onSlackEvent(bot: SlackBot, type: string, handler: RawEventHandler): void {
  hooksFor(bot).events.set(type, handler);
}

/** Handle an interactive payload type the adapter ignores (e.g. `message_action`). */
export function onSlackInteraction(bot: SlackBot, type: string, handler: RawInteractionHandler): void {
  hooksFor(bot).interactions.set(type, handler);
}
