"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { AssigneePicker } from "@/components/pickers";
import { updateProject } from "@/lib/actions";
import type { Member } from "@/lib/types";

/** Inline owner control for the project overview header (admins only). */
export function OwnerPicker({
  projectId,
  ownerId,
  members,
}: {
  projectId: string;
  ownerId: string | null;
  members: Member[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
      <span>Owner</span>
      <AssigneePicker
        members={members}
        value={ownerId}
        label="No owner"
        onChange={(v) =>
          start(async () => {
            await updateProject(projectId, { ownerId: v });
            router.refresh();
          })
        }
      />
    </div>
  );
}
