"use client";

import { Plus } from "lucide-react";
import { useCallback, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { DepartmentHeader } from "@/components/department-header";
import { Button } from "@/components/ui/button";
import { createContent, deleteContent, updateContent } from "@/lib/actions";
import { asFormat, CHANNEL_FORMAT, CHANNELS, type ContentFormat } from "@/lib/marketing";
import type { Member } from "@/lib/types";
import type { Piece, PiecePatch } from "./bits";
import { CalendarTab } from "./calendar";
import { ChannelsTab } from "./channels";
import { PieceEditor } from "./editor";
import { PiecesTab } from "./pieces";

const TABS = ["calendar", "pieces", "channels"] as const;
type Tab = (typeof TABS)[number];

export const tabFrom = (v: string | undefined): Tab => ((TABS as readonly string[]).includes(v ?? "") ? (v as Tab) : "calendar");

type Change = { id: string; patch: PiecePatch } | { id: string; remove: true };

function applyChange(items: Piece[], c: Change): Piece[] {
  if ("remove" in c) return items.filter((p) => p.id !== c.id);
  const { publishDate, ...rest } = c.patch;
  return items.map((p) => (p.id === c.id ? { ...p, ...rest, ...(publishDate !== undefined ? { publishDate: publishDate ? new Date(publishDate) : null } : {}) } : p));
}

/** Mirror view state into the URL without a server round trip, so a view or a piece can be shared as a link. */
function sync(patch: Record<string, string | null>) {
  const next = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  const qs = next.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/**
 * Marketing for one product: what goes out where and when. The calendar plans
 * the weeks, All pieces is everything in one table, Channels is how often each
 * one actually posts. Any piece opens in the same editor.
 */
export function MarketingWorkspace({
  projectId,
  items: serverItems,
  members,
  today,
  salesHref,
  initialTab,
  initialPiece,
}: {
  projectId: string;
  items: Piece[];
  members: Member[];
  today: string;
  salesHref: string | null;
  initialTab?: string;
  initialPiece?: string;
}) {
  const [tab, setTabState] = useState<Tab>(tabFrom(initialTab));
  const [format, setFormatState] = useState<ContentFormat | "">("");
  const [openId, setOpenId] = useState<string | null>(initialPiece ?? null);
  // A piece just created isn't in the server's list until the action's refresh lands.
  const [fresh, setFresh] = useState<Piece | null>(null);
  const [items, change] = useOptimistic(serverItems, applyChange);
  const [creating, startCreate] = useTransition();
  const [, startSave] = useTransition();

  const setTab = (t: Tab) => {
    setTabState(t);
    sync({ tab: t === "calendar" ? null : t });
  };
  const setFormat = (f: ContentFormat | "") => setFormatState(f);
  const open = (p: Piece) => {
    setOpenId(p.id);
    sync({ piece: p.id });
  };
  const close = useCallback(() => {
    setOpenId(null);
    setFresh(null);
    sync({ piece: null });
  }, []);

  const save = (id: string, patch: PiecePatch) =>
    startSave(async () => {
      change({ id, patch });
      if (fresh?.id === id) setFresh(applyChange([fresh], { id, patch })[0]);
      try {
        await updateContent(id, patch);
      } catch {
        toast.error("Couldn't save that change. Try again.");
      }
    });

  const remove = (p: Piece) => {
    if (!window.confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    close();
    startSave(async () => {
      change({ id: p.id, remove: true });
      try {
        await deleteContent(p.id);
        toast.success("Piece deleted");
      } catch {
        toast.error("Couldn't delete that piece. Try again.");
      }
    });
  };

  const create = () =>
    startCreate(async () => {
      // On All pieces with a format picked, the new piece starts in that format.
      const fmt = tab === "pieces" ? asFormat(format) : null;
      const channel = fmt ? (CHANNELS.find((c) => CHANNEL_FORMAT[c.id] === fmt)?.id ?? null) : null;
      try {
        const created = await createContent({ projectId, title: "Untitled piece", status: "idea", format: fmt, channel });
        setFresh(created);
        open(created);
      } catch {
        toast.error("Couldn't add a piece. Try again.");
      }
    });

  // The editor's piece always comes from the list, so it shows saves from anywhere. A link to a piece
  // that no longer exists finds nothing, and the editor stays shut.
  const editing = (openId && (items.find((p) => p.id === openId) ?? (fresh?.id === openId ? fresh : null))) || null;

  return (
    <div className="flex h-full flex-col">
      <DepartmentHeader
        label="Marketing views"
        tabs={[
          { id: "calendar", label: "Calendar" },
          { id: "pieces", label: "All pieces", count: items.length },
          { id: "channels", label: "Channels" },
        ]}
        current={tab}
        onChange={setTab}
        actions={
          <Button size="sm" className="h-8 shrink-0 max-sm:px-2.5" onClick={create} disabled={creating}>
            <Plus /> New<span className="max-sm:hidden">&nbsp;piece</span>
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
        <div key={tab} className="animate-enter">
          {tab === "calendar" ? (
            <CalendarTab items={items} members={members} today={today} salesHref={salesHref} onOpen={open} onSave={save} />
          ) : tab === "pieces" ? (
            <PiecesTab items={items} format={format} setFormat={setFormat} openId={openId} onOpen={open} />
          ) : (
            <ChannelsTab items={items} today={today} />
          )}
        </div>
      </div>
      <PieceEditor piece={editing} members={members} onClose={close} onSave={save} onDelete={remove} />
    </div>
  );
}
