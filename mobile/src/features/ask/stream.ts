import { fetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "@/lib/config";

/** Same keystore entry lib/api.ts writes on sign-in. Read here so this screen can stream with its own fetch. */
const KEY_STORE = "internal.apiKey";

export async function getApiToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_STORE);
}

export type AskSource = { kind: "issue" | "page"; id: string; title: string; href: string };

export type AskEvent =
  | { type: "sources"; sources: AskSource[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Decode UTF-8 bytes. A line is only decoded once its newline has arrived, so no character is ever split. */
function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  let pct = "";
  for (let i = 0; i < bytes.length; i++) pct += `%${bytes[i].toString(16).padStart(2, "0")}`;
  try {
    return decodeURIComponent(pct);
  } catch {
    return "";
  }
}

/**
 * Split NDJSON into lines at the byte level. 0x0A never occurs inside a
 * multi-byte UTF-8 sequence, so cutting there is always safe; the unfinished
 * tail is returned to be prefixed to the next chunk.
 */
export function splitLines(buffer: Uint8Array): { lines: string[]; rest: Uint8Array } {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0a) {
      const line = decodeUtf8(buffer.subarray(start, i)).trim();
      if (line) lines.push(line);
      start = i + 1;
    }
  }
  return { lines, rest: buffer.slice(start) };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (!a.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export class AskError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "AskError";
    this.status = status;
  }
}

/**
 * Ask the workspace a question and receive the answer as it is written:
 * `onEvent` is called for the sources line, each text delta, and the end.
 * Resolves when the stream closes; rejects on a network or server error.
 */
export async function askStream(question: string, onEvent: (e: AskEvent) => void, signal?: AbortSignal): Promise<void> {
  const token = await getApiToken();
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${API_URL}/api/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ question }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return;
    throw new AskError(e instanceof Error && e.name === "AbortError" ? "Stopped." : "Can't reach Internal. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AskError(body?.error ?? `Couldn't answer that (${res.status}).`, res.status);
  }

  const reader = res.body.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      const { lines, rest } = splitLines(concat(buffer, value));
      buffer = rest;
      for (const l of lines) {
        let ev: AskEvent;
        try {
          ev = JSON.parse(l) as AskEvent;
        } catch {
          continue;
        }
        if (ev.type === "error") throw new AskError(ev.message);
        onEvent(ev);
      }
    }
    if (done) break;
  }
}
