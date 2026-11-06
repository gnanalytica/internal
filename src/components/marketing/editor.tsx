"use client";

import { ExternalLink, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  asFormat,
  CHANNEL_FORMAT,
  CHANNELS,
  channelOf,
  CONTENT_FORMATS,
  CTA_OPTIONS,
  detailText,
  FORMATS,
  fieldsFor,
  formatOf,
  fromIstInput,
  PIECE_STATUSES,
  toIstInput,
  type ChannelId,
  type ContentDetails,
  type FormatField,
} from "@/lib/marketing";
import type { Member } from "@/lib/types";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ChannelDot, fieldCls, formatChannelLabel, type Piece, type PiecePatch } from "./bits";

const lbl = "text-xs text-muted-foreground";

/**
 * One piece, everything about it: where and when it goes out, the fields its
 * format asks for, what it asks the reader to do and how it did. Text saves
 * when you leave the field; choices save as you make them.
 */
export function PieceEditor({
  piece,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  piece: Piece | null;
  members: Member[];
  onClose: () => void;
  onSave: (id: string, patch: PiecePatch) => void;
  onDelete: (piece: Piece) => void;
}) {
  return (
    <Sheet open={Boolean(piece)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md max-sm:data-[side=right]:border-l-0"
      >
        {piece && <EditorBody key={piece.id} piece={piece} members={members} onSave={(patch) => onSave(piece.id, patch)} onDelete={() => onDelete(piece)} />}
      </SheetContent>
    </Sheet>
  );
}

function EditorBody({ piece, members, onSave, onDelete }: { piece: Piece; members: Member[]; onSave: (patch: PiecePatch) => void; onDelete: () => void }) {
  const format = formatOf(piece);
  const details: ContentDetails = piece.details ?? {};
  const setDetails = (next: ContentDetails) => onSave({ details: { ...details, ...next } });
  const whenLabel = (format && FORMATS[format].whenLabel) || "Goes out";
  const channel = channelOf(piece.channel);
  const shareAs = details.shareAs ?? [];
  // A piece saved before formats existed shows its channel's usual one; picking it here stores it.
  const storedFormat = asFormat(piece.format);

  const text = (key: keyof Piece & ("title" | "url" | "notes"), v: string) => {
    const next = key === "title" ? v.trim() || "Untitled piece" : v.trim() || null;
    if (next !== piece[key]) onSave({ [key]: next });
  };
  const num = (key: "views" | "clicks", v: string) => {
    const n = v.trim() === "" ? null : Math.max(0, Math.round(Number(v)));
    if (n !== null && Number.isNaN(n)) return;
    if (n !== piece[key]) onSave({ [key]: n });
  };

  return (
    <div className="flex min-h-full flex-col gap-5 px-4 pt-4 pb-6 sm:px-5">
      <div className="flex items-center gap-2 pr-9">
        <ChannelDot channel={piece.channel} />
        <span className={lbl}>{formatChannelLabel(piece)}</span>
      </div>
      <div className="-mt-2 flex flex-col gap-1">
        <SheetTitle className="sr-only">{piece.title}</SheetTitle>
        <SheetDescription className="sr-only">Edit this marketing piece. Changes save as you go.</SheetDescription>
        <textarea
          aria-label="Title"
          defaultValue={piece.title}
          rows={1}
          onBlur={(e) => text("title", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="field-sizing-content resize-none rounded-md bg-transparent text-xl leading-snug font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div role="group" aria-label="Status" className="grid grid-cols-4 gap-1">
        {PIECE_STATUSES.map((s, i) => {
          const at = PIECE_STATUSES.findIndex((x) => x.id === piece.status);
          const current = i === Math.max(at, 0);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={current}
              onClick={() => !current && onSave({ status: s.id })}
              className={cn(
                "h-9 rounded-md border text-xs transition-colors sm:h-8",
                current ? cn("font-medium", tone(s.tone).chip, tone(s.tone).ring) : i < at ? "border-transparent bg-muted text-muted-foreground hover:text-foreground" : "bg-background text-muted-foreground/70 hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={lbl}>Channel</span>
          <select
            value={piece.channel ?? ""}
            onChange={(e) => {
              const next = e.target.value || null;
              // A first channel also sets the format it usually takes.
              const fmt = !storedFormat && next && channelOf(next) ? CHANNEL_FORMAT[next as ChannelId] : undefined;
              onSave({ channel: next, ...(fmt ? { format: fmt } : {}) });
            }}
            className={fieldCls}
          >
            <option value="">No channel</option>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            {piece.channel && !channel && <option value={piece.channel}>{piece.channel}</option>}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={lbl}>Format</span>
          <select value={format ?? ""} onChange={(e) => onSave({ format: e.target.value || null })} className={fieldCls}>
            <option value="">Not set</option>
            {CONTENT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMATS[f].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={lbl}>{whenLabel}</span>
          <input
            type="datetime-local"
            defaultValue={toIstInput(piece.publishDate)}
            onBlur={(e) => {
              const next = fromIstInput(e.target.value);
              if (next !== (piece.publishDate ? new Date(piece.publishDate).toISOString() : null)) onSave({ publishDate: next });
            }}
            className={fieldCls}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={lbl}>Owner</span>
          <select value={piece.ownerId ?? ""} onChange={(e) => onSave({ ownerId: e.target.value || null })} className={fieldCls}>
            <option value="">Nobody</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!piece.publishDate && <p className="-mt-3 text-xs text-muted-foreground">No date yet, so it waits in Ideas on the calendar.</p>}

      <label className="flex flex-col gap-1.5">
        <span className={cn(lbl, "flex items-center gap-2")}>
          Draft
          {piece.url && (
            <a href={piece.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-brand hover:underline">
              Open <ExternalLink className="size-3" />
            </a>
          )}
        </span>
        <input type="url" inputMode="url" defaultValue={piece.url ?? ""} placeholder="Link to the doc, design or file" onBlur={(e) => text("url", e.target.value)} className={fieldCls} />
      </label>

      {format ? (
        fieldsFor(format).map((f) => <DetailField key={`${format}:${f.key}`} field={f} value={detailText(details, f.key)} onCommit={(v) => v !== detailText(details, f.key) && setDetails({ [f.key]: v || null })} />)
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-[13px] text-muted-foreground">Pick a format and it asks for what that format needs — a post its hashtags, an email its subject line.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <span id="cta-l" className={lbl}>
          Call to action
        </span>
        <div role="radiogroup" aria-labelledby="cta-l" className="flex flex-wrap gap-1.5">
          {CTA_OPTIONS.map((c) => {
            const on = details.cta === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDetails({ cta: on ? null : c })}
                className={cn("h-8 rounded-full border px-3 text-xs whitespace-nowrap transition-colors sm:h-7", on ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="share-l" className={lbl}>
          Also share as
        </span>
        <div role="group" aria-labelledby="share-l" className="flex flex-wrap gap-1.5">
          {CHANNELS.filter((c) => c.id !== piece.channel).map((c) => {
            const on = shareAs.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setDetails({ shareAs: on ? shareAs.filter((x) => x !== c.id) : [...shareAs, c.id] })}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs whitespace-nowrap transition-colors sm:h-7", on ? cn("border-transparent font-medium", tone(c.tone).chip) : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <span aria-hidden className={cn("size-1.5 rounded-full", tone(c.tone).dot)} />
                {c.share}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={lbl}>Notes</span>
        <textarea defaultValue={piece.notes ?? ""} rows={3} placeholder="Anything else: who signs off, what it depends on" onBlur={(e) => text("notes", e.target.value)} className={cn(fieldCls, "h-auto resize-y py-2 sm:h-auto")} />
      </label>

      <section aria-labelledby="res-h" className="flex flex-col gap-2 border-t pt-4">
        <h3 id="res-h" className="text-[13px] font-semibold">
          Results
        </h3>
        <p className="text-[13px] text-muted-foreground">Fill in after it goes out.</p>
        <div className="grid grid-cols-2 gap-3">
          {(["views", "clicks"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className={lbl}>{k === "views" ? "Views" : "Clicks"}</span>
              <input type="number" inputMode="numeric" min={0} defaultValue={piece[k] ?? ""} placeholder="—" onBlur={(e) => num(k, e.target.value)} className={cn(fieldCls, "font-mono tabular-nums")} />
            </label>
          ))}
        </div>
      </section>

      <div className="mt-auto flex items-center gap-2 border-t pt-4">
        <span className="text-xs text-muted-foreground">Added {new Date(piece.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
        <Button variant="ghost" size="sm" onClick={onDelete} className="ml-auto text-muted-foreground hover:text-destructive">
          <Trash2 /> Delete piece
        </Button>
      </div>
    </div>
  );
}

function DetailField({ field, value, onCommit }: { field: FormatField; value: string; onCommit: (v: string) => void }) {
  const id = `f-${field.key}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={lbl}>
        {field.label}
      </label>
      {field.kind === "long" ? (
        <textarea id={id} defaultValue={value} rows={4} placeholder={field.placeholder} onBlur={(e) => onCommit(e.target.value.trim())} className={cn(fieldCls, "h-auto resize-y py-2 sm:h-auto")} />
      ) : field.kind === "datetime" ? (
        <input id={id} type="datetime-local" defaultValue={toIstInput(value || null)} onBlur={(e) => onCommit(fromIstInput(e.target.value) ?? "")} className={fieldCls} />
      ) : (
        <input
          id={id}
          type={field.kind === "url" ? "url" : "text"}
          inputMode={field.kind === "url" ? "url" : undefined}
          defaultValue={value}
          placeholder={field.placeholder}
          onBlur={(e) => onCommit(e.target.value.trim())}
          className={fieldCls}
        />
      )}
    </div>
  );
}
