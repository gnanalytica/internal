"use client";

import { useState } from "react";
import type { ProspectRecord } from "@/lib/prospects/parse";
import { displayDate, parseNoteLines } from "@/lib/prospects/parse";
import { SCORE_COLUMNS, UNSCORED_KINDS, WRITABLE } from "@/lib/prospects/schema";
import { BandBadge, Bar } from "../bits";
import { FactTable, Section, SmallButton, TextDialog } from "./shared";
import type { Ctx } from "./shared";


/* ---------- research tab ---------- */

export function ResearchTab({ ctx, r }: { ctx: Ctx; r: ProspectRecord }) {
  const [editOpen, setEditOpen] = useState(false);
  const [all, setAll] = useState(false);
  const lines = parseNoteLines(r.researchNotes);
  const shown = all ? lines : lines.slice(0, 16);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-8">
        <Section
          title="What research found"
          aside={
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{r.lastResearched ? `Researched ${displayDate(r.lastResearched)}` : "Never researched"}</span>
              {WRITABLE[ctx.kind].has("research_notes") && <SmallButton onClick={() => setEditOpen(true)}>Edit</SmallButton>}
            </span>
          }
        >
          {lines.length ? (
            <div className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px] leading-relaxed">
              {shown.map((l, i) =>
                l.label ? (
                  <p key={i}>
                    <span className="text-muted-foreground">{l.label}:</span> {l.text}
                  </p>
                ) : (
                  <p key={i} className={l.text.startsWith("- ") ? "pl-3" : "text-xs text-muted-foreground"}>
                    {l.text}
                  </p>
                ),
              )}
              {lines.length > 16 && (
                <button type="button" className="self-start text-xs text-muted-foreground hover:text-foreground" onClick={() => setAll((v) => !v)}>
                  {all ? "Show less" : `Show all ${lines.length} lines`}
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">Nothing yet. Research adds findings here, one per line.</p>
          )}
        </Section>
        <Section title={`Sources${r.researchSources.length ? ` · ${r.researchSources.length}` : ""}`}>
          {r.researchSources.length ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full table-fixed text-[13px]">
                <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-44 px-3 py-2 font-normal">What</th>
                    <th className="px-3 py-2 font-normal">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {r.researchSources.map((s, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="truncate px-3 py-2 text-muted-foreground">{s.what || "Source"}</td>
                      <td className="truncate px-3 py-2">
                        <a href={/^https?:/i.test(s.url) ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" className="hover:underline">
                          {s.url.replace(/^https?:\/\/(www\.)?/i, "")}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No sources yet.</p>
          )}
        </Section>
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <Section title="Status">
          <FactTable
            rows={[
              { label: "Research", value: r.researchStatus || "Not started", missing: !r.researchStatus },
              { label: "Find out next", value: r.scoreGaps || "—" },
            ]}
          />
        </Section>
        {!UNSCORED_KINDS.has(ctx.kind) && (
          <Section title="Score" aside={r.opportunityScore !== null ? <BandBadge band={r.band} score={r.opportunityScore} /> : undefined}>
            {r.opportunityScore === null ? (
              <p className="text-[13px] text-muted-foreground">Not scored yet. Scoring runs once research is reviewed.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-[13px]">
                  <tbody>
                    {SCORE_COLUMNS.map((s, i) => (
                      <tr key={s.key} className="border-b border-border/60 last:border-0">
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          {s.label}
                        </th>
                        <td className="w-24 px-2">
                          <Bar value={r.scores[i] ?? 0} max={s.max} className="h-1.5" />
                        </td>
                        <td className="w-14 px-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {r.scores[i] ?? "–"}/{s.max}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        Total
                      </th>
                      <td />
                      <td className="px-3 text-right font-mono text-xs font-medium tabular-nums">{r.opportunityScore}/100</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {r.scoreReason && <p className="text-[13px] leading-relaxed text-muted-foreground">{r.scoreReason}</p>}
          </Section>
        )}
      </div>
      <TextDialog ctx={ctx} col="research_notes" title="Research notes" description="One finding per line, as “label: text”." value={r.researchNotes} open={editOpen} onOpenChange={setEditOpen} rows={18} />
    </div>
  );
}
