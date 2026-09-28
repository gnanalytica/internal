"use client";

import { cn } from "@/lib/utils";
import { PLAYBOOK } from "./playbook-content";

export function Playbook({ section, setSection }: { section: string; setSection: (s: string) => void }) {
  const current = PLAYBOOK.find((p) => p.id === section) ?? PLAYBOOK[0];
  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <nav aria-label="Playbook sections" className="flex flex-row flex-wrap gap-1 md:flex-col">
        {PLAYBOOK.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-current={p.id === current.id ? "page" : undefined}
            onClick={() => setSection(p.id)}
            className={cn("h-9 rounded-md px-3 text-left text-sm", p.id === current.id ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <article className="flex max-w-3xl flex-col gap-5 rounded-xl border bg-card p-6">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">{current.title}</h2>
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
