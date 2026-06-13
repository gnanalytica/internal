"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Database as DatabaseIcon, Plus } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createDatabase } from "@/lib/actions";
import type { Database } from "@/lib/types";

export function DatabasesView({ databases }: { databases: Database[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newDatabase() {
    startTransition(async () => {
      const d = await createDatabase({ name: "Untitled database" });
      router.push(`/databases/${d.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: "Databases" }]}
        actions={
          <Button size="sm" className="h-7 gap-1.5" onClick={newDatabase} disabled={pending}>
            <Plus className="size-4" /> New database
          </Button>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {databases.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <DatabaseIcon className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No databases yet</p>
                <p className="text-xs text-muted-foreground">
                  Build a custom table with your own properties and views.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={newDatabase} disabled={pending}>
                <Plus className="size-4" /> New database
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {databases.map((d) => (
                <Link
                  key={d.id}
                  href={`/databases/${d.id}`}
                  className="flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                >
                  <span className="text-2xl leading-none">{d.icon}</span>
                  <span className="truncate text-sm font-medium">{d.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
