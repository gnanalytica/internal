"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createWorkspace } from "@/lib/actions";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createWorkspace({ name });
        router.push("/issues");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create workspace");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-bold text-brand-foreground shadow-sm">
            +
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A workspace holds your docs, issues, and team.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Workspace name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
            placeholder="Acme Inc."
            className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <Button
          type="button"
          onClick={create}
          disabled={pending || !name.trim()}
          className="mt-5 h-10 w-full"
        >
          {pending ? "Creating…" : "Create workspace"}
        </Button>
      </div>
    </div>
  );
}
