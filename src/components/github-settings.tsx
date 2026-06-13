"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { disconnectGithub, setGithubConfig } from "@/lib/actions";

export function GithubSettings({
  connected,
  repo,
  isAdmin,
}: {
  connected: boolean;
  repo: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState("");
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Settings" }, { label: "GitHub" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-8 py-10">
          <div className="mb-6 flex items-center gap-3">
            <GitHubIcon className="size-8" />
            <div>
              <h2 className="text-sm font-semibold">GitHub</h2>
              <p className="text-sm text-muted-foreground">
                Push issues to a GitHub repository and link them back.
              </p>
            </div>
            {connected && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="size-3.5" /> {repo}
              </span>
            )}
          </div>

          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">
              Only admins can configure the GitHub integration.
            </p>
          ) : connected ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={pending}
              onClick={() => run(() => disconnectGithub(), "Disconnected")}
            >
              Disconnect {repo}
            </Button>
          ) : (
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium">Repository</span>
                <input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="owner/repo"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium">Access token</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <Button
                size="sm"
                className="h-9"
                disabled={pending || !repoInput.trim() || !token.trim()}
                onClick={() =>
                  run(() => setGithubConfig({ repo: repoInput, token }), "GitHub connected")
                }
              >
                Connect
              </Button>
            </div>
          )}

          <div className="mt-8 rounded-xl border bg-muted/20 p-4 text-sm">
            <h3 className="mb-2 font-medium">How to get a token</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  GitHub → Settings → Developer settings → Fine-grained tokens
                </a>
                .
              </li>
              <li>
                Grant access to the repo, with <strong>Issues: Read and write</strong>{" "}
                (classic tokens: the <code className="rounded bg-muted px-1 font-mono text-xs">repo</code> scope).
              </li>
              <li>Copy the token and paste it above with the repo as <code className="rounded bg-muted px-1 font-mono text-xs">owner/repo</code>.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Today this pushes an issue to GitHub on demand. Two-way sync (status
              updates via webhooks) is a future step.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
