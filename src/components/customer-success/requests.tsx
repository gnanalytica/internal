"use client";

import { ChevronDown, Copy, Inbox, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { Segmented } from "@/components/prospects-dashboard/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { convertTicketToIssue, loadTicketComments } from "@/lib/actions";
import { ageLabel, REQUEST_STATES, REQUEST_VIA, requestState, requestStateMeta, viaLabel, type RequestState, type RequestVia } from "@/lib/customer-success";
import { createAnswer, createRequest, replyToRequest, setRequestState } from "@/lib/customer-success-actions";
import { tone } from "@/lib/tones";
import type { SupportAnswer, TicketWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dayMonth, type CustomerView } from "./bits";

const field = "w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** Waiting on us first, then waiting on them, then answered; newest first within each. */
export function sortRequests(list: TicketWithRelations[]): TicketWithRelations[] {
  const rank: Record<RequestState, number> = { "waiting-us": 0, "waiting-them": 1, answered: 2 };
  return [...list].sort((a, b) => rank[requestState(a.status)] - rank[requestState(b.status)] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type RequestCtx = {
  projectId: string;
  now: number;
  answers: SupportAnswer[];
  onChanged: () => void;
};

/* ---------- one request ---------- */

function StateMenu({ request, ctx }: { request: TicketWithRelations; ctx: RequestCtx }) {
  const [pending, start] = useTransition();
  const state = requestState(request.status);
  const meta = requestStateMeta(state);
  const change = (next: RequestState) =>
    start(async () => {
      try {
        await setRequestState(request.id, next);
        ctx.onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't change it.");
      }
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`State: ${meta.label}. Change`}
        disabled={pending}
        className={cn("inline-flex h-[22px] items-center gap-1 rounded-full pr-1.5 pl-2 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50", tone(meta.tone).chip, pending && "opacity-60")}
      >
        {meta.label}
        <ChevronDown className="size-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-44">
        <DropdownMenuRadioGroup value={state} onValueChange={(v) => change(v as RequestState)}>
          {REQUEST_STATES.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EngineeringButton({ request, ctx }: { request: TicketWithRelations; ctx: RequestCtx }) {
  const [made, setMade] = useState<{ id: string; number: number } | null>(request.issue ? { id: request.issue.id, number: request.issue.number } : null);
  const [pending, start] = useTransition();
  if (made) {
    return (
      <Link href={`/issues/${made.id}`} className="inline-flex h-7 items-center rounded-md px-1.5 text-xs font-medium text-primary hover:underline">
        Engineering ticket #{made.number} →
      </Link>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const { issue, created } = await convertTicketToIssue(request.id);
            setMade({ id: issue.id, number: issue.number });
            toast.success(created ? `Engineering ticket #${issue.number} made` : `Already Engineering ticket #${issue.number}`);
            ctx.onChanged();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't make the ticket.");
          }
        })
      }
    >
      {pending ? "Making…" : "Make an Engineering ticket"}
    </Button>
  );
}

export function RequestCard({ request, ctx, customerName, onOpenCustomer }: { request: TicketWithRelations; ctx: RequestCtx; customerName?: string | null; onOpenCustomer?: () => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const answered = requestState(request.status) === "answered";
  const via = viaLabel(request.via);
  return (
    <article aria-label={request.subject} className="flex flex-col gap-2.5 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StateMenu request={request} ctx={ctx} />
        {via && <span className="text-xs text-muted-foreground">{via}</span>}
        {customerName !== undefined && (
          <>
            <span aria-hidden className="text-xs text-muted-foreground/50">·</span>
            {customerName && onOpenCustomer ? (
              <button type="button" onClick={onOpenCustomer} className="truncate text-xs font-medium hover:underline">
                {customerName}
              </button>
            ) : (
              <span className="truncate text-xs text-muted-foreground">{customerName || "No customer"}</span>
            )}
          </>
        )}
        <span className="flex-1" />
        <time dateTime={new Date(request.createdAt).toISOString()} title={`Came in ${dayMonth(new Date(request.createdAt).toISOString())}`} className="font-mono text-[11px] text-muted-foreground">
          {ageLabel(request.createdAt, ctx.now)}
        </time>
      </div>
      <div className="text-[13px] leading-relaxed">
        <p className="font-medium">{request.subject}</p>
        {request.body && <p className="whitespace-pre-line text-muted-foreground">“{request.body}”</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {!answered && (
          <Button variant="outline" size="sm" onClick={() => setReplyOpen(true)}>
            Reply with an answer
          </Button>
        )}
        <EngineeringButton request={request} ctx={ctx} />
        <Button variant="ghost" size="sm" onClick={() => setSaveOpen(true)}>
          Save as an answer
        </Button>
      </div>
      <ReplyDialog request={request} ctx={ctx} open={replyOpen} onOpenChange={setReplyOpen} />
      <SaveAnswerDialog request={request} ctx={ctx} open={saveOpen} onOpenChange={setSaveOpen} />
    </article>
  );
}

/* ---------- reply ---------- */

function ReplyDialog({ request, ctx, open, onOpenChange }: { request: TicketWithRelations; ctx: RequestCtx; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">{open && <ReplyForm request={request} ctx={ctx} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function ReplyForm({ request, ctx, onDone }: { request: TicketWithRelations; ctx: RequestCtx; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? ctx.answers.filter((a) => `${a.question} ${a.answer}`.toLowerCase().includes(s)) : ctx.answers;
  }, [ctx.answers, q]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };
  const save = () =>
    start(async () => {
      try {
        await replyToRequest(request.id, text);
        const copied = await copy();
        toast.success(copied ? "Reply saved and copied — paste it to them. Now waiting on them." : "Reply saved. Now waiting on them.");
        ctx.onChanged();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save the reply.");
      }
    });
  return (
    <>
      <DialogHeader>
        <DialogTitle>Reply with an answer</DialogTitle>
        <DialogDescription>{request.subject}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        {ctx.answers.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 rounded-lg border px-2.5">
              <Search aria-hidden className="size-3.5 text-muted-foreground" />
              <input aria-label="Find a saved answer" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a saved answer" className="h-9 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="flex max-h-48 flex-col overflow-y-auto rounded-lg border p-1">
              {hits.map((a) => (
                <button key={a.id} type="button" onClick={() => setText(a.answer)} className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <span className="text-[13px] font-medium">{a.question}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{a.answer}</span>
                </button>
              ))}
              {hits.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No saved answer matches.</p>}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">No saved answers yet. Write this one, then save it as an answer from the request so the next one is a click.</p>
        )}
        <label htmlFor={`reply-${request.id}`} className="text-xs font-medium text-foreground/80">
          The reply
        </label>
        <textarea id={`reply-${request.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Pick an answer above or write one" className={cn(field, "resize-y py-2 leading-relaxed")} />
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={!text.trim()} onClick={async () => toast.success((await copy()) ? "Copied." : "Couldn't copy — select the text instead.")}>
          <Copy /> Copy
        </Button>
        <Button disabled={pending || !text.trim()} onClick={save}>
          {pending ? "Saving…" : "Save reply"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ---------- save as an answer ---------- */

function SaveAnswerDialog({ request, ctx, open, onOpenChange }: { request: TicketWithRelations; ctx: RequestCtx; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <SaveAnswerForm request={request} ctx={ctx} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function SaveAnswerForm({ request, ctx, onDone }: { request: TicketWithRelations; ctx: RequestCtx; onDone: () => void }) {
  const [question, setQuestion] = useState(request.subject);
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Start from the latest reply on the thread, if there is one.
  useEffect(() => {
    let alive = true;
    loadTicketComments(request.id).then(
      (list) => alive && setAnswer((a) => a ?? list.at(-1)?.body ?? ""),
      () => alive && setAnswer((a) => a ?? ""),
    );
    return () => {
      alive = false;
    };
  }, [request.id]);
  const save = () =>
    start(async () => {
      try {
        await createAnswer(ctx.projectId, { question, answer: answer ?? "" });
        toast.success("Saved to Answers.");
        ctx.onChanged();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save the answer.");
      }
    });
  return (
    <>
      <DialogHeader>
        <DialogTitle>Save as an answer</DialogTitle>
        <DialogDescription>So the next customer who asks this gets the reply in one click.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
          Question
          <input value={question} onChange={(e) => setQuestion(e.target.value)} className={cn(field, "h-9 font-normal text-foreground")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
          Answer
          <textarea value={answer ?? ""} onChange={(e) => setAnswer(e.target.value)} rows={6} placeholder={answer === null ? "Loading the last reply…" : "What fixed it, in words a customer can follow"} className={cn(field, "resize-y py-2 leading-relaxed font-normal text-foreground")} />
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={pending || !question.trim() || !answer?.trim()} onClick={save}>
          {pending ? "Saving…" : "Save answer"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ---------- new request ---------- */

export function NewRequestDialog({ open, onOpenChange, ctx, customers, fixedRef }: { open: boolean; onOpenChange: (o: boolean) => void; ctx: RequestCtx; customers: CustomerView[]; fixedRef?: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">{open && <NewRequestForm ctx={ctx} customers={customers} fixedRef={fixedRef ?? null} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function NewRequestForm({ ctx, customers, fixedRef, onDone }: { ctx: RequestCtx; customers: CustomerView[]; fixedRef: string | null; onDone: () => void }) {
  const [ref, setRef] = useState<string>(fixedRef ?? customers[0]?.ref ?? "");
  const [via, setVia] = useState<RequestVia>("whatsapp");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const fixed = fixedRef ? customers.find((c) => c.ref === fixedRef) : null;
  const submit = () =>
    start(async () => {
      try {
        await createRequest({ projectId: ctx.projectId, ref: ref || null, subject, body, via });
        toast.success("Request added — waiting on us.");
        ctx.onChanged();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add the request.");
      }
    });
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        if (subject.trim()) submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>New request</DialogTitle>
        <DialogDescription>{fixed ? fixed.name : "Something a customer asked for or reported."}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        {!fixed && (
          <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
            Customer
            <select value={ref} onChange={(e) => setRef(e.target.value)} className={cn(field, "h-9 font-normal text-foreground")}>
              {customers.map((c) => (
                <option key={c.ref} value={c.ref}>
                  {c.name}
                </option>
              ))}
              <option value="">No customer</option>
            </select>
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground/80">How it came in</span>
          <Segmented label="How it came in" value={via} onChange={setVia} options={REQUEST_VIA.map((v) => ({ value: v.id, label: v.label }))} className="self-start" />
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
          What they need
          <input autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. PDF is missing the bank stamp page" className={cn(field, "h-9 font-normal text-foreground")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
          What they said
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="In their words, if you have them" className={cn(field, "resize-y py-2 leading-relaxed font-normal text-foreground")} />
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !subject.trim()}>
          {pending ? "Adding…" : "Add request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ---------- the Requests tab ---------- */

type Filter = "open" | RequestState | "all";

export function RequestsTab({ requests, customers, dealNames, ctx, onOpenCustomer }: { requests: TicketWithRelations[]; customers: CustomerView[]; dealNames: Record<string, string>; ctx: RequestCtx; onOpenCustomer: (ref: string) => void }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [newOpen, setNewOpen] = useState(false);
  const byDeal = useMemo(() => new Map(customers.filter((c) => c.deal).map((c) => [c.deal!.id, c])), [customers]);
  const count = (f: Filter) => requests.filter((r) => f === "all" || (f === "open" ? requestState(r.status) !== "answered" : requestState(r.status) === f)).length;
  const shown = sortRequests(requests.filter((r) => filter === "all" || (filter === "open" ? requestState(r.status) !== "answered" : requestState(r.status) === filter)));
  const filters: { value: Filter; label: string }[] = [
    { value: "open", label: "Open" },
    { value: "waiting-us", label: "Waiting on us" },
    { value: "waiting-them", label: "Waiting on them" },
    { value: "answered", label: "Answered" },
    { value: "all", label: "All" },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Show requests"
          value={filter}
          onChange={setFilter}
          className="no-scrollbar max-w-full overflow-x-auto"
          options={filters.map((f) => ({
            value: f.value,
            label: (
              <>
                {f.label}
                <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">{count(f.value)}</span>
              </>
            ),
          }))}
        />
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
          <Plus /> New request
        </Button>
      </div>
      {shown.length ? (
        <div className="flex flex-col gap-2">
          {shown.map((r) => {
            const c = r.dealId ? byDeal.get(r.dealId) : undefined;
            return <RequestCard key={r.id} request={r} ctx={ctx} customerName={c?.name ?? (r.dealId ? dealNames[r.dealId] ?? null : null)} onOpenCustomer={c ? () => onOpenCustomer(c.ref) : undefined} />;
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title={requests.length ? "Nothing here" : "No requests yet"}
          description={requests.length ? "No request is in this state right now." : "When a customer asks for something or reports a problem, add it here so nothing waits on us for long."}
        />
      )}
      <NewRequestDialog open={newOpen} onOpenChange={setNewOpen} ctx={ctx} customers={customers} />
    </div>
  );
}
