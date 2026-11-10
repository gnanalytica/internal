"use client";

import { AnswersTab } from "@/components/customer-success/answers";
import type { SupportAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PLAYBOOK } from "./playbook-content";

/** The section id for the saved customer answers, after the written playbook. */
export const ANSWERS_SECTION = "answers";

export function Playbook({
  section,
  setSection,
  answers,
}: {
  section: string;
  setSection: (s: string) => void;
  /** Saved question → answer pairs for customer requests (from Customer Success), when the product has them. */
  answers?: { list: SupportAnswer[]; projectId: string; onChanged: () => void };
}) {
  const onAnswers = Boolean(answers) && section === ANSWERS_SECTION;
  const current = PLAYBOOK.find((p) => p.id === section) ?? PLAYBOOK[0];
  const nav = [...PLAYBOOK.map((p) => ({ id: p.id, label: p.label })), ...(answers ? [{ id: ANSWERS_SECTION, label: "Answers" }] : [])];
  const currentId = onAnswers ? ANSWERS_SECTION : current.id;
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr] md:gap-6">
      <nav aria-label="Playbook sections" className="no-scrollbar -mx-3 flex flex-row gap-1 overflow-x-auto px-3 md:mx-0 md:flex-col md:px-0">
        {nav.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-current={p.id === currentId ? "page" : undefined}
            onClick={() => setSection(p.id)}
            className={cn("h-9 shrink-0 rounded-md px-3 text-left text-sm whitespace-nowrap", p.id === currentId ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
          >
            {p.label}
            {p.id === ANSWERS_SECTION && answers && <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground/70">{answers.list.length}</span>}
          </button>
        ))}
      </nav>
      {onAnswers && answers ? (
        <section aria-labelledby="pb-answers" className="flex min-w-0 max-w-3xl flex-col gap-4">
          <header className="flex flex-col gap-2">
            <h2 id="pb-answers" className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              Answers
            </h2>
            <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">The replies that work, saved from customer requests. A request on a customer&apos;s record can be answered with one in a click.</p>
          </header>
          <AnswersTab answers={answers.list} projectId={answers.projectId} onChanged={answers.onChanged} />
        </section>
      ) : (
        <article className="flex max-w-3xl flex-col gap-5 rounded-xl border bg-card p-4 sm:p-6">
          <header className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">{current.title}</h2>
            <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{current.intro}</p>
          </header>
          {current.quote && <blockquote className="rounded-lg bg-foreground px-5 py-4 text-lg leading-snug font-medium text-background">“{current.quote}”</blockquote>}
          {current.groups.map((g) => (
            <section key={g.name} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-brand">{g.name}</h3>
              <ul className="flex flex-col gap-1.5">
                {g.items.map((item) => (
                  <li key={item} className="max-w-[70ch] rounded-lg bg-muted/60 px-3 py-2 text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      )}
    </div>
  );
}
