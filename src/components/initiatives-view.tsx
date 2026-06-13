"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus, Target } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createInitiative } from "@/lib/actions";
import { INITIATIVE_STATUSES, type InitiativeWithCount } from "@/lib/types";

export function InitiativesView({
  initiatives,
}: {
  initiatives: InitiativeWithCount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newInitiative() {
    startTransition(async () => {
      const it = await createInitiative({});
      router.push(`/initiatives/${it.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Initiatives" }]}
        actions={
          <Button
            size="sm"
            className="h-7 gap-1.5"
            onClick={newInitiative}
            disabled={pending}
          >
            <Plus className="size-4" /> New initiative
          </Button>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {initiatives.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <Target className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No initiatives yet</p>
                <p className="text-xs text-muted-foreground">
                  Initiatives group projects toward a larger goal.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={newInitiative} disabled={pending}>
                <Plus className="size-4" /> New initiative
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {initiatives.map((it) => {
                const status =
                  INITIATIVE_STATUSES.find((s) => s.id === it.status) ??
                  INITIATIVE_STATUSES[1];
                return (
                  <Link
                    key={it.id}
                    href={`/initiatives/${it.id}`}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                  >
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: it.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.name}</div>
                      {it.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {it.description}
                        </div>
                      )}
                    </div>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        color: status.color,
                        backgroundColor: `color-mix(in oklch, ${status.color} 14%, transparent)`,
                      }}
                    >
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {it.projectCount} project{it.projectCount === 1 ? "" : "s"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
