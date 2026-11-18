import { useQuery } from "@tanstack/react-query";
import { type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ErrorView, Fab, Loading } from "@/components/ui";

import { contentQuery } from "../api";
import { useMemberName } from "../pick-options";
import { type Piece } from "./bits";
import { CalendarView } from "./calendar";
import { PieceSheet, ScheduleSheet } from "./editor";
import { asFormat, todayIST } from "./model";
import { PiecesView, type PieceFilter } from "./pieces";

export const MARKETING_TABS = ["calendar", "pieces"] as const;
export type MarketingTab = (typeof MARKETING_TABS)[number];

/** Channels was a tab of its own on the web; it is a section under the calendar now, so old links land there. */
export const marketingTabFrom = (v: string | undefined): MarketingTab => ((MARKETING_TABS as readonly string[]).includes(v ?? "") ? (v as MarketingTab) : "calendar");

/**
 * Marketing for one product, as on the web: what goes out where and when.
 * Calendar plans the week, with how each channel actually posts under it; All
 * pieces is everything in one list. Any piece opens the same editor.
 */
export function MarketingWorkspace({ projectId, tab, initialPiece, salesHref }: { projectId: string; tab: MarketingTab; /** A `?piece=` link opens that piece once it has loaded. */ initialPiece?: string; salesHref: Href | null }) {
  const q = useQuery(contentQuery(projectId));
  const ownerName = useMemberName();
  const [filter, setFilter] = useState<PieceFilter>("");
  const [editing, setEditing] = useState<Piece | "new" | null>(null);
  const [scheduling, setScheduling] = useState<Piece | null>(null);
  const [linked, setLinked] = useState(false);
  const today = todayIST();

  const linkedPiece = !linked && initialPiece ? q.data?.find((p) => p.id === initialPiece) : undefined;
  useEffect(() => {
    if (!linkedPiece) return;
    setLinked(true);
    setEditing(linkedPiece);
  }, [linkedPiece]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const items = q.data;
  const refresh = () => void q.refetch();
  // The editor shows the cached row, so a save from the sheet (or anywhere) shows at once.
  const open = editing && editing !== "new" ? (items.find((p) => p.id === editing.id) ?? editing) : editing;

  return (
    <View style={{ flex: 1 }}>
      {tab === "calendar" ? (
        <CalendarView items={items} today={today} refreshing={q.isRefetching} onRefresh={refresh} ownerName={ownerName} salesHref={salesHref} onOpen={setEditing} onSchedule={setScheduling} />
      ) : (
        <PiecesView items={items} today={today} filter={filter} setFilter={setFilter} refreshing={q.isRefetching} onRefresh={refresh} onOpen={setEditing} />
      )}
      <Fab label="New piece" onPress={() => setEditing("new")} />
      <PieceSheet projectId={projectId} piece={open} seedFormat={tab === "pieces" ? asFormat(filter) : null} onClose={() => setEditing(null)} />
      <ScheduleSheet piece={scheduling} onClose={() => setScheduling(null)} />
    </View>
  );
}
