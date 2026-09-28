"use client";

import { cn } from "@/lib/utils";
import { PLAYBOOK } from "./playbook-content";

export function Playbook({ section, setSection }: { section: string; setSection: (s: string) => void }) {
  const current = PLAYBOOK.find((p) => p.id === section) ?? PLAYBOOK[0];
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr] md:gap-6">
      <nav aria-label="Playbook sections" className="no-scrollbar -mx-3 flex flex-row gap-1 overflow-x-auto px-3 md:mx-0 md:flex-col md:px-0">
        {PLAYBOOK.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-current={p.id === current.id ? "page" : undefined}
            onClick={() => setSection(p.id)}
            className={cn("h-9 shrink-0 rounded-md px-3 text-left text-sm whitespace-nowrap", p.id === current.id ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <article className="flex max-w-3xl flex-col gap-5 rounded-xl border bg-card p-4 sm:p-6">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">{current.title}</h2>
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{current.intro}</p>
        </header>
        {current.quote && <blockquote className="rounded-lg bg-foreground px-5 py-4 text-lg leading-snug font-medium text-background">“{current.quote}”</blockquote>}
        {current.groups.map((g) => (
          <section key={g.name} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-brand uppercase">{g.name}</h3>
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
    </div>
  );
}
