"use client";

import { BookOpen, Plus, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { createAnswer, deleteAnswer, updateAnswer } from "@/lib/customer-success-actions";
import type { SupportAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";

const field = "w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** Question and answer, for a new answer or an edit. */
function AnswerForm({ initial, onSave, onCancel, saveLabel }: { initial?: { question: string; answer: string }; onSave: (v: { question: string; answer: string }) => Promise<void>; onCancel: () => void; saveLabel: string }) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!question.trim() || !answer.trim()) return;
        start(async () => {
          try {
            await onSave({ question, answer });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save the answer.");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
        Question
        <input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How do I reuse last month's site photos?" className={cn(field, "h-9 font-normal text-foreground")} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground/80">
        Answer
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="The reply that works, in words a customer can follow" className={cn(field, "resize-y py-2 leading-relaxed font-normal text-foreground")} />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || !question.trim() || !answer.trim()}>
          {pending ? "Saving…" : saveLabel}
        </Button>
      </div>
    </form>
  );
}

function AnswerItem({ a, onChanged }: { a: SupportAnswer; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (editing) {
    return (
      <AnswerForm
        initial={a}
        saveLabel="Save"
        onCancel={() => setEditing(false)}
        onSave={async (v) => {
          await updateAnswer(a.id, v);
          toast.success("Answer saved.");
          setEditing(false);
          onChanged();
        }}
      />
    );
  }
  return (
    <article aria-label={a.question} className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <h3 className="text-[13px] font-medium">{a.question}</h3>
      <p className="text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">{a.answer}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await deleteAnswer(a.id);
                    toast.success("Answer deleted.");
                    onChanged();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't delete it.");
                  }
                })
              }
            >
              {pending ? "Deleting…" : "Delete for good"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
    </article>
  );
}

/** The saved question → answer pairs requests are replied with. */
export function AnswersTab({ answers, projectId, onChanged }: { answers: SupportAnswer[]; projectId: string; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? answers.filter((a) => `${a.question} ${a.answer}`.toLowerCase().includes(s)) : answers;
  }, [answers, q]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5 sm:max-w-xs">
          <Search aria-hidden className="size-3.5 text-muted-foreground" />
          <input aria-label="Find an answer" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an answer" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <span className="flex-1 max-sm:hidden" />
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus /> New answer
        </Button>
      </div>
      {adding && (
        <AnswerForm
          saveLabel="Add answer"
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            await createAnswer(projectId, v);
            toast.success("Answer added.");
            setAdding(false);
            onChanged();
          }}
        />
      )}
      {shown.length ? (
        <div className="flex flex-col gap-2">
          {shown.map((a) => (
            <AnswerItem key={a.id} a={a} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        !adding && (
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title={answers.length ? "No answer matches" : "No saved answers yet"}
            description={answers.length ? "Try other words." : "Save the reply to a request as an answer, or add one here. Next time someone asks, it's one click."}
          />
        )
      )}
    </div>
  );
}
