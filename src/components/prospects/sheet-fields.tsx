"use client";

import { useState, useTransition } from "react";
import { Check, Lock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { updateSheetCells } from "@/lib/sheet-crm/actions";
import { LONG_TEXT, headerLabel } from "@/lib/sheet-crm/fields";
import { isDerivedColumn, isWritableColumn, type TabSpec } from "@/lib/sheet-crm/mapping";
import type { CellWriteResult } from "@/lib/sheet-crm/sync";

const fieldCls =
  "w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

/**
 * One sheet cell as a field. Writable columns edit in place and write
 * through to the sheet on blur; everything else is read-only and says why.
 */
export function SheetField({
  spec,
  rowKey,
  header,
  value,
  onWritten,
  compact,
}: {
  spec: TabSpec;
  rowKey: string;
  header: string;
  value: string;
  onWritten?: (r: CellWriteResult[]) => void;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<CellWriteResult["status"] | null>(null);
  const writable = isWritableColumn(spec, header);
  const derived = isDerivedColumn(spec, header);
  const label = headerLabel(header);
  const long = LONG_TEXT.has(header);

  function commit(next: string) {
    if (next === value) return;
    start(async () => {
      const res = await updateSheetCells({ tab: spec.id, rowKey, updates: { [header]: next } });
      const r = res.find((x) => x.column === header);
      setState(r?.status ?? "failed");
      if (r?.status === "ok") toast.success(`${label} saved to the sheet`);
      else if (r?.status === "pending") toast.message(`${label} kept in Internal; the sheet write is pending`, { description: r.detail });
      else if (r?.status === "column_absent") toast.message(`${label}: the sheet has no such column yet`);
      else toast.error(`${label}: ${r?.detail ?? r?.status ?? "failed"}`);
      onWritten?.(res);
    });
  }

  return (
    <div className={compact ? "min-w-0" : "min-w-0 space-y-0.5"}>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="truncate">{label}</span>
        {derived ? (
          <Lock className="size-3" aria-label="Formula / derived in the sheet" />
        ) : !writable ? (
          <Lock className="size-3 opacity-50" aria-label="Read-only in Internal" />
        ) : null}
        {pending && <span className="text-[10px]">saving…</span>}
        {!pending && state === "ok" && <Check className="size-3 text-emerald-600" aria-label="Saved to the sheet" />}
        {!pending && state && state !== "ok" && <TriangleAlert className="size-3 text-amber-600" aria-label={state} />}
      </div>
      {writable ? (
        long ? (
          <textarea defaultValue={value} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))} onBlur={(e) => commit(e.target.value)} className={fieldCls} />
        ) : (
          <input defaultValue={value} onBlur={(e) => commit(e.target.value)} className={fieldCls} />
        )
      ) : (
        <div className="whitespace-pre-wrap break-words rounded-md border border-dashed px-2 py-1 text-sm text-foreground/90">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
      )}
    </div>
  );
}

export function SheetFieldGrid({
  spec,
  rowKey,
  record,
  groups,
  onWritten,
}: {
  spec: TabSpec;
  rowKey: string;
  record: Record<string, string>;
  groups: { title: string; headers: string[] }[];
  onWritten?: (r: CellWriteResult[]) => void;
}) {
  const placed = new Set(groups.flatMap((g) => g.headers));
  const other = Object.keys(record).filter((h) => !placed.has(h));
  const all = other.length ? [...groups, { title: "Other", headers: other }] : groups;
  return (
    <div className="space-y-5">
      {all.map((g) => {
        const headers = g.headers.filter((h) => h in record);
        if (!headers.length) return null;
        return (
          <section key={g.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((h) => (
                <div key={h} className={LONG_TEXT.has(h) ? "sm:col-span-2 lg:col-span-3" : ""}>
                  <SheetField spec={spec} rowKey={rowKey} header={h} value={record[h] ?? ""} onWritten={onWritten} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
