import * as SecureStore from "expo-secure-store";

import { API_URL } from "./config";

const KEY_STORE = "internal.apiKey";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** The key the app holds for the signed-in member. Kept in the OS keystore. */
export async function loadToken(): Promise<string | null> {
  token = await SecureStore.getItemAsync(KEY_STORE);
  return token;
}

export async function saveToken(value: string | null): Promise<void> {
  token = value;
  if (value) await SecureStore.setItemAsync(KEY_STORE, value);
  else await SecureStore.deleteItemAsync(KEY_STORE);
}

/** Called when the server stops accepting the key (revoked, or removed from the workspace). */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function url(path: string, query?: Query): string {
  const u = new URL(`${API_URL}/api/v1${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(url(path, opts.query), { method, headers, body });
  } catch {
    throw new ApiError("Can't reach Internal. Check your connection and try again.", 0);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    const message = (json as { error?: string } | null)?.error ?? `Request failed (${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, { body: body ?? {}, query }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  del: <T>(path: string, query?: Query) => request<T>("DELETE", path, { query }),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { form }),
};

/** A list endpoint's envelope. */
export type ListResponse<T> = { data: T[]; count?: number; next_cursor?: string | null };
export type ItemResponse<T> = { data: T };
