import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";

type GithubConfig = { repo: string; token: string };

async function getGithubConfig(workspaceId: string): Promise<GithubConfig | null> {
  const [ws] = await db
    .select({ repo: workspaces.githubRepo, token: workspaces.githubToken })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return ws?.repo && ws?.token ? { repo: ws.repo, token: ws.token } : null;
}

/** Whether GitHub is connected — never exposes the token. */
export async function isGithubConnected(workspaceId: string): Promise<boolean> {
  return (await getGithubConfig(workspaceId)) !== null;
}

export async function verifyGithubRepo(
  repo: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Create a GitHub issue in the workspace's connected repo. */
export async function createGithubIssue(
  workspaceId: string,
  input: { title: string; body: string },
): Promise<{ number: number; htmlUrl: string }> {
  const cfg = await getGithubConfig(workspaceId);
  if (!cfg) throw new Error("GitHub is not connected.");
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}). Check the repo and token scopes.`);
  }
  const data = (await res.json()) as { number: number; html_url: string };
  return { number: data.number, htmlUrl: data.html_url };
}
