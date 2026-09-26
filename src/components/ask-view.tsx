"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleDot, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import type { AskSource } from "@/lib/types";

const SUGGESTIONS = [
  "What are we shipping this cycle?",
  "Summarize the open work on the mobile project",
  "What decisions are documented about auth?",
];

export function AskView({ enabled }: { enabled: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);

  async function ask(q: string) {
    const query = q.trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true);
    setAsked(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error ?? "Couldn't answer that");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // NDJSON arrives in arbitrary chunks, so a line can be split across two
      // reads; keep the tail in the buffer until its newline shows up.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l) as
            | { type: "sources"; sources: AskSource[] }
            | { type: "delta"; text: string }
            | { type: "done" }
            | { type: "error"; message: string };
          if (ev.type === "sources") setSources(ev.sources);
          else if (ev.type === "delta") setAnswer((a) => a + ev.text);
          else if (ev.type === "error") throw new Error(ev.message);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't answer that");
    } finally {
      setLoading(false);
    }
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

          {!asked && !loading && (
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

          {loading && !answer && (
            <div className="mt-6 text-sm text-muted-foreground">Reading your workspace…</div>
          )}

          {(answer || sources.length > 0) && (
            <div className="mt-6">
              {answer && (
                <div className="whitespace-pre-wrap rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
                  {answer}
                  {loading && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand align-text-bottom" />}
                </div>
              )}
              {sources.length > 0 && (
                <div className="mt-3">
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </h3>
                  <div className="space-y-0.5">
                    {sources.map((s) => (
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
