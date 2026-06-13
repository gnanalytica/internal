"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus, Users } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createTeam } from "@/lib/actions";
import type { TeamWithCount } from "@/lib/types";

export function TeamsView({ teams }: { teams: TeamWithCount[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newTeam() {
    startTransition(async () => {
      const t = await createTeam({ name: "New team" });
      router.push(`/teams/${t.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Teams" }]}
        actions={
          <Button size="sm" className="h-7 gap-1.5" onClick={newTeam} disabled={pending}>
            <Plus className="size-4" /> New team
          </Button>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {teams.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <Users className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No teams yet</p>
                <p className="text-xs text-muted-foreground">
                  Teams group people and issues inside this workspace.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={newTeam} disabled={pending}>
                <Plus className="size-4" /> New team
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.id}`}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                >
                  <span className="text-xl leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t.key}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.issueCount} issue{t.issueCount === 1 ? "" : "s"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
