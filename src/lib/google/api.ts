import "server-only";

/**
 * The handful of Gmail and Calendar calls the outreach layer makes. Thin
 * `fetch` wrappers; every non-2xx throws so a poll records a failure rather
 * than an empty day.
 */

async function g<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Google API ${init.method ?? "GET"} ${url.split("?")[0]} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

// ---- Gmail ----

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: number;
  from: string;
  to: string[];
  subject: string;
};

const header = (h: { name: string; value: string }[] | undefined, name: string) => h?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";

export function addressesIn(v: string): string[] {
  return [...v.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0].toLowerCase());
}

/** Messages exchanged with any of `addresses` since `sinceDays`. Query is chunked: Gmail's search string has a length limit. */
export async function gmailMessagesWith(token: string, addresses: string[], sinceDays: number, max = 200): Promise<GmailMessageMeta[]> {
  const out: GmailMessageMeta[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < addresses.length; i += 15) {
    const chunk = addresses.slice(i, i + 15);
    const q = `newer_than:${sinceDays}d {${chunk.map((a) => `from:${a} to:${a}`).join(" ")}}`;
    const list = await g<{ messages?: { id: string }[] }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${max}`);
    for (const m of list.messages ?? []) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const full = await g<{ id: string; threadId: string; snippet: string; internalDate: string; payload?: { headers?: { name: string; value: string }[] } }>(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
      );
      const h = full.payload?.headers;
      out.push({
        id: full.id,
        threadId: full.threadId,
        snippet: full.snippet ?? "",
        internalDate: Number(full.internalDate),
        from: header(h, "From"),
        to: [...addressesIn(header(h, "To")), ...addressesIn(header(h, "Cc"))],
        subject: header(h, "Subject"),
      });
    }
  }
  return out;
}

function encodeMime(to: string, subject: string, body: string): string {
  const raw = [`To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

/** Create a Gmail DRAFT (never sends). Returns the draft id and a URL that opens it. */
export async function gmailCreateDraft(token: string, to: string, subject: string, body: string): Promise<{ id: string; messageId: string; url: string }> {
  const d = await g<{ id: string; message: { id: string; threadId: string } }>(token, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: encodeMime(to, subject, body) } }),
  });
  return { id: d.id, messageId: d.message.id, url: `https://mail.google.com/mail/u/0/#drafts?compose=${d.message.id}` };
}

// ---- Calendar ----

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
  hangoutLink?: string;
  attendees: { email: string; responseStatus?: string }[];
  status?: string;
};

export async function calendarEvents(token: string, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const j = await g<{ items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink: string; hangoutLink?: string; attendees?: { email: string; responseStatus?: string }[]; status?: string }[] }>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`,
  );
  return (j.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? `${e.start?.date}T09:00:00Z`,
    end: e.end?.dateTime ?? `${e.end?.date}T10:00:00Z`,
    htmlLink: e.htmlLink,
    hangoutLink: e.hangoutLink,
    attendees: (e.attendees ?? []).map((a) => ({ email: a.email.toLowerCase(), responseStatus: a.responseStatus })),
    status: e.status,
  }));
}

/** Create an event with a Meet link and the contact as attendee. */
export async function calendarCreateEvent(token: string, input: { title: string; start: Date; end: Date; attendeeEmail?: string | null; description?: string }): Promise<CalendarEvent> {
  const body = {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start.toISOString() },
    end: { dateTime: input.end.toISOString() },
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : [],
    conferenceData: { createRequest: { requestId: `int-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
  };
  const e = await g<{ id: string; summary: string; start: { dateTime: string }; end: { dateTime: string }; htmlLink: string; hangoutLink?: string; attendees?: { email: string }[] }>(
    token,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    { method: "POST", body: JSON.stringify(body) },
  );
  return { id: e.id, summary: e.summary, start: e.start.dateTime, end: e.end.dateTime, htmlLink: e.htmlLink, hangoutLink: e.hangoutLink, attendees: (e.attendees ?? []).map((a) => ({ email: a.email })) };
}
