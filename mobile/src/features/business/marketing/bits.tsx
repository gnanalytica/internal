import { View } from "react-native";

import type { ContentItem } from "../api";
import type { Option } from "../constants";
import { CHANNELS, channelOf, CONTENT_FORMATS, FORMATS, formatOf, PIECE_STATUSES, statusOf, timeOf, TONE_HEX } from "./model";

/** A content piece, as the Marketing views see it. */
export type Piece = ContentItem;

export const STATUS_OPTIONS: Option[] = PIECE_STATUSES.map((s) => ({ value: s.id, label: s.label, color: TONE_HEX[s.tone] }));
export const FORMAT_OPTIONS: Option[] = CONTENT_FORMATS.map((f) => ({ value: f, label: FORMATS[f].label, subtitle: FORMATS[f].asks }));
export const CHANNEL_OPTIONS: Option[] = CHANNELS.map((c) => ({ value: c.id, label: c.label, subtitle: c.note, color: TONE_HEX[c.tone] }));

export const statusColor = (status: string): string => TONE_HEX[statusOf(status).tone];
export const channelColor = (channel: string | null): string => {
  const c = channelOf(channel);
  return c ? TONE_HEX[c.tone] : TONE_HEX.gray;
};

/** Each channel keeps its hue wherever it appears, as on the web. */
export function ChannelDot({ channel, size = 8 }: { channel: string | null; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: channelColor(channel) }} />;
}

/** The second line of a calendar chip: where it stands, then who has it (or its format). Same words as the web's. */
export function chipMeta(p: Piece, owner?: string | null): string {
  const s = statusOf(p.status);
  const time = timeOf(p.publishDate);
  const f = formatOf(p);
  const what = p.status === "published" ? `Posted${time ? ` ${time}` : ""}` : p.status === "scheduled" ? `Ready${time ? ` · ${time}` : ""}` : s.label;
  return [what, owner || (f ? FORMATS[f].label : null)].filter(Boolean).join(" · ");
}

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";
