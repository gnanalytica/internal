/**
 * The pure half of the Settings endpoints (API keys, webhooks, integrations,
 * sign-in methods): the shapes they return and the input they accept. Nothing
 * here may ever carry a key hash, a webhook secret or an integration token.
 */
import { ApiInputError } from "./errors";

export type ApiKeyRowIn = {
  id: string;
  name: string;
  keyPrefix: string;
  kind: string;
  createdBy: string | null;
  createdByName: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export type ApiKeyDto = {
  id: string;
  name: string;
  prefix: string;
  /** "key" — an integration key made in Settings; "app" — a mobile-app sign-in. */
  kind: string;
  createdBy: { id: string; name: string | null } | null;
  lastUsedAt: string | null;
  createdAt: string;
  /** The key making this request (this phone's sign-in). */
  current: boolean;
};

/** Build the list shape field by field, so nothing else on the row can leak. */
export function apiKeyDto(row: ApiKeyRowIn, currentKeyId: string): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    kind: row.kind,
    createdBy: row.createdBy ? { id: row.createdBy, name: row.createdByName } : null,
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    current: row.id === currentKeyId,
  };
}

/** The web's `createApiKey` naming rule. */
export function cleanKeyName(name: unknown): string {
  return (typeof name === "string" ? name.trim().slice(0, 60) : "") || "API key";
}

export function parseActive(body: { active?: unknown }): boolean {
  if (typeof body.active !== "boolean") throw new ApiInputError("`active` must be true or false.");
  return body.active;
}

export const SIGN_IN_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "credential", label: "Email & password" },
] as const;

export type SignInMethod = { id: string; label: string; connected: boolean };

/** Every method the web offers, marked connected or not. */
export function signInMethods(providerIds: readonly string[]): SignInMethod[] {
  const have = new Set(providerIds);
  return SIGN_IN_PROVIDERS.map((p) => ({ id: p.id, label: p.label, connected: have.has(p.id) }));
}

export type IntegrationsDto = {
  github: { connected: boolean; repo: string | null };
  slack: { connected: boolean };
};

/** Connection flags only — the GitHub token and the Slack webhook URL never leave the server. */
export function integrationsDto(ws: { githubRepo: string | null; githubToken: string | null; slackWebhookUrl: string | null }): IntegrationsDto {
  const github = Boolean(ws.githubRepo && ws.githubToken);
  return {
    github: { connected: github, repo: github ? ws.githubRepo : null },
    slack: { connected: Boolean(ws.slackWebhookUrl) },
  };
}
