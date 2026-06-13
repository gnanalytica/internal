"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleDot, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { askWorkspace } from "@/lib/actions";
import type { AskResult } from "@/lib/types";

const SUGGESTIONS = [
  "What are we shipping this cycle?",
  "Summarize the open work on the mobile project",
  "What decisions are documented about auth?",
];

export function AskView({ enabled }: { enabled: boolean }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);

  function ask(q: string) {
    const query = q.trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true);
    setResult(null);
    askWorkspace(query)
      .then(setResult)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Couldn't answer that"),
      )
      .finally(() => setLoading(false));
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Ask AI" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-5 text-brand" />
            <h1 className="text-lg font-semibold">Ask your workspace</h1>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Answers are grounded in your docs and issues.
          </p>

          {!enabled && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              AI isn&apos;t configured yet. Add an{" "}
              <code className="rounded bg-muted px-1 py-0.5">ANTHROPIC_API_KEY</code> to enable
              this.
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="flex gap-2"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your workspace…"
              className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand"
            />
            <Button type="submit" className="h-10" disabled={loading || !question.trim()}>
              {loading ? "Thinking…" : "Ask"}
            </Button>
          </form>

          {!result && !loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="mt-6 text-sm text-muted-foreground">Reading your workspace…</div>
          )}

          {result && (
            <div className="mt-6">
              <div className="whitespace-pre-wrap rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
                {result.answer}
              </div>
              {result.sources.length > 0 && (
                <div className="mt-3">
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </h3>
                  <div className="space-y-0.5">
                    {result.sources.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        {s.kind === "issue" ? (
                          <CircleDot className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{s.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
