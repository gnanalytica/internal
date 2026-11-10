import { createRecord, deleteRecord, patchRecord } from "../api";
import { FormSheet, type FieldSpec, type FormValues } from "../form-sheet";
import { useMemberOptions } from "../pick-options";
import { CHANNEL_OPTIONS, FORMAT_OPTIONS, STATUS_OPTIONS, type Piece } from "./bits";
import { atDay, asFormat, CHANNEL_FORMAT, channelOf, CHANNELS, dayOf, fromIstInput, timeOf, type ChannelId, type ContentFormat } from "./model";

/** "9:05" → "09:05"; empty is no time. Throws on anything else so the sheet can say so. */
function readTime(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  if (!s) return null;
  const m = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(s);
  if (!m) throw new Error("Time should look like 09:30 (24-hour, India time).");
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * One piece's editor, as a bottom sheet: the fields the web's piece editor
 * has in common for every format (the format's own fields stay on the web).
 * The day and time are India time, like the web's calendar. A piece with no
 * day is an idea.
 */
export function PieceSheet({ projectId, piece, seedFormat, onClose }: { projectId: string; piece: Piece | "new" | null; /** A new piece starts in this format (All pieces with a format picked). */ seedFormat?: ContentFormat | null; onClose: () => void }) {
  const members = useMemberOptions();
  const current = piece && piece !== "new" ? piece : null;

  const fields: FieldSpec[] = [
    { key: "title", label: "Title", kind: "text", required: true, placeholder: "e.g. How a bank reads your valuation" },
    { key: "status", label: "Status", kind: "choice", options: STATUS_OPTIONS },
    { key: "format", label: "Format", kind: "choice", options: FORMAT_OPTIONS, noneLabel: "No format yet" },
    { key: "channel", label: "Channel", kind: "choice", options: CHANNEL_OPTIONS, noneLabel: "No channel" },
    { key: "day", label: "Goes out on", kind: "date", placeholder: "Not scheduled — an idea" },
    { key: "time", label: "Time (India)", kind: "text", placeholder: "10:00", keyboard: "numbers-and-punctuation", autoCapitalize: "none", hint: "Leave empty for 10:00." },
    { key: "ownerId", label: "Owner", kind: "choice", options: members, noneLabel: "No owner" },
    { key: "url", label: "Draft or post link", kind: "text", keyboard: "url", placeholder: "https://" },
    { key: "notes", label: "Notes", kind: "multiline" },
    { key: "views", label: "Views", kind: "number", hint: "Typed in after it goes out." },
    { key: "clicks", label: "Clicks", kind: "number" },
  ];

  const seedChannel = seedFormat ? (CHANNELS.find((c) => CHANNEL_FORMAT[c.id] === seedFormat)?.id ?? null) : null;
  const initial: FormValues = current
    ? {
        title: current.title,
        status: current.status,
        format: asFormat(current.format),
        channel: current.channel,
        day: dayOf(current.publishDate),
        time: timeOf(current.publishDate),
        ownerId: current.ownerId,
        url: current.url,
        notes: current.notes,
        views: current.views ?? null,
        clicks: current.clicks ?? null,
      }
    : { title: "", status: "idea", format: seedFormat ?? null, channel: seedChannel, day: null, time: null, ownerId: null, url: null, notes: null, views: null, clicks: null };

  const submit = async (v: FormValues) => {
    const time = readTime(v.time);
    const day = (v.day as string | null) ?? null;
    const channel = (v.channel as string | null) ?? null;
    const body = {
      title: v.title,
      status: v.status ?? "idea",
      // A piece given a known channel and no format takes the channel's usual one, as on the web.
      format: (v.format as string | null) ?? (channelOf(channel) ? CHANNEL_FORMAT[channel as ChannelId] : null),
      channel,
      publishDate: day ? (time ? fromIstInput(`${day}T${time}`) : atDay(day, current?.publishDate)) : null,
      ownerId: v.ownerId ?? null,
      url: v.url ?? null,
      notes: v.notes ?? null,
      views: v.views ?? null,
      clicks: v.clicks ?? null,
    };
    if (current) await patchRecord("content", current.id, body);
    else await createRecord("content", { ...body, projectId });
  };

  return (
    <FormSheet
      visible={piece !== null}
      onClose={onClose}
      title={current ? current.title : "New piece"}
      submitLabel={current ? "Save" : "Add"}
      fields={fields}
      initial={initial}
      onSubmit={submit}
      onDelete={current ? () => deleteRecord("content", current.id) : undefined}
      deleteLabel="Delete piece"
    />
  );
}

/**
 * Give a piece a day — an idea its first one, an overdue piece a new one — keeping
 * its time of day. Clearing the date sends it back to the ideas.
 */
export function ScheduleSheet({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  const day = piece ? dayOf(piece.publishDate) : null;
  return (
    <FormSheet
      visible={piece !== null}
      onClose={onClose}
      title={piece ? `${day ? "Reschedule" : "Schedule"} “${piece.title}”` : ""}
      fields={[{ key: "day", label: "Goes out on", kind: "date" }]}
      initial={{ day }}
      onSubmit={async (v) => {
        if (!piece) return;
        const next = (v.day as string | null) ?? null;
        await patchRecord("content", piece.id, { publishDate: next ? atDay(next, piece.publishDate) : null });
      }}
    />
  );
}
