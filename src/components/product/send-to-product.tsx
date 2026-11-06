"use client";

import { Check, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { matchThemes, themeKey, themeToSave } from "@/lib/product-roadmap";
import { feedbackHref, type SendSource } from "@/lib/send-to-product";
import { getProductFeedbackContext, sendToProduct, type ProductFeedbackContext } from "@/lib/send-to-product-actions";
import { cn } from "@/lib/utils";

/** What one button sends: the words, who said them, as what, and the ref that stops a second send. */
export type SendPayload = { body: string; contact: string | null; source: SendSource; sourceRef: string };

/** A project's feedback context plus a way to record a send, so every button for the same remark agrees. */
export type ProductFeedback = { ctx: ProductFeedbackContext | null; markSent: (sourceRef: string, id: string) => void };

/** The context as handed down from the server (Customer Success), plus what's been sent since it was read. */
export function useProductFeedbackState(server: ProductFeedbackContext | null): ProductFeedback {
  const [since, setSince] = useState<Record<string, string>>({});
  const ctx = useMemo(() => (server ? { ...server, sent: { ...server.sent, ...since } } : null), [server, since]);
  const markSent = useCallback((sourceRef: string, id: string) => setSince((s) => ({ ...s, [sourceRef]: id })), []);
  return { ctx, markSent };
}

/**
 * The context read through a server action, for pages that aren't scoped to a
 * project (a prospect's record). No project id means the prospects' product.
 * `enabled: false` waits until it's wanted; a new `version` reads it again
 * (after a touch is logged, say, which may have sent something itself).
 */
export function useProductFeedback({ projectId = null, enabled = true, version = 0 }: { projectId?: string | null; enabled?: boolean; version?: number } = {}): ProductFeedback {
  const [state, setState] = useState<{ key: string; ctx: ProductFeedbackContext | null } | null>(null);
  const key = projectId ?? "";
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getProductFeedbackContext(projectId).then(
      (ctx) => alive && setState({ key, ctx }),
      () => alive && setState({ key, ctx: null }),
    );
    return () => {
      alive = false;
    };
  }, [projectId, key, enabled, version]);
  const markSent = useCallback((sourceRef: string, id: string) => setState((s) => (s?.ctx ? { ...s, ctx: { ...s.ctx, sent: { ...s.ctx.sent, [sourceRef]: id } } } : s)), []);
  return { ctx: state?.key === key ? state.ctx : null, markSent };
}

/** Pick an existing theme or type a new one; empty means Unsorted. */
export function ThemeField({ value, onChange, themes, autoFocus }: { value: string; onChange: (v: string) => void; themes: string[]; autoFocus?: boolean }) {
  const uid = useId();
  const suggestions = useMemo(() => matchThemes(themes, value, 6).filter((t) => themeKey(t) !== themeKey(value)), [themes, value]);
  const existing = themes.some((t) => themeKey(t) === themeKey(value));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label htmlFor={`${uid}-theme`} className="text-xs font-medium text-foreground/80">
          Theme
        </label>
        <span className="text-xs text-muted-foreground">{value.trim() ? (existing ? "existing theme" : "new theme") : "optional · empty is Unsorted"}</span>
      </div>
      <input
        id={`${uid}-theme`}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Bank report formats"
        className="h-8 w-full min-w-0 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {suggestions.length > 0 && (
        <div id={`${uid}-list`} role="listbox" aria-label="Existing themes" className="flex flex-wrap gap-1.5">
          {suggestions.map((t) => (
            <button key={t} type="button" role="option" aria-selected={false} onClick={() => onChange(t)} className="h-7 max-w-full truncate rounded-full bg-muted px-2.5 text-xs text-foreground/80 hover:bg-muted/70 hover:text-foreground">
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "In Product →", once a remark has been sent. */
function InProduct({ projectId, className }: { projectId: string; className?: string }) {
  return (
    <Link href={feedbackHref(projectId)} className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap text-primary hover:underline", className)}>
      <Check className="size-3.5" /> In Product
    </Link>
  );
}

/**
 * One click to put what someone said on the project's Product › Feedback tab:
 * a small icon button, then a popover to pick a theme (or leave it Unsorted).
 * Shows "In Product" with a link once sent. Renders nothing while the context
 * loads, or where there's no project to send to.
 */
export function SendToProductButton({ fb, payload, label, className }: { fb: ProductFeedback; payload: SendPayload; label?: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [pending, start] = useTransition();
  const ctx = fb.ctx;
  if (!ctx) return null;
  if (ctx.sent[payload.sourceRef]) return <InProduct projectId={ctx.projectId} className={className} />;

  const send = () =>
    start(async () => {
      try {
        const res = await sendToProduct({ ...payload, projectId: ctx.projectId, theme });
        fb.markSent(payload.sourceRef, res.id);
        setOpen(false);
        const t = themeToSave(theme, ctx.themes);
        const href = feedbackHref(res.projectId);
        toast.success(!res.created ? "Already in Product" : t ? `Sent to Product under “${t}”` : "Sent to Product, under Unsorted", { action: { label: "Open", onClick: () => router.push(href) } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't send that to Product.");
      }
    });

  const tip = label ?? "Send to Product";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={tip}
                  className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-expanded:bg-muted aria-expanded:text-foreground", className)}
                />
              }
            />
          }
        >
          <Send className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(92vw,320px)] gap-3 p-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">Send to Product</p>
          <p className="line-clamp-3 text-[13px] leading-relaxed">“{payload.body.trim()}”</p>
          {payload.contact && <p className="text-xs text-muted-foreground">{payload.contact}</p>}
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <ThemeField value={theme} onChange={setTheme} themes={ctx.themes} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
