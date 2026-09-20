"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { AssigneePicker } from "@/components/pickers";
import { setProspectOwner } from "@/lib/sheet-crm/actions";
import type { Member } from "@/lib/types";

/**
 * Who is responsible for this prospect. The same `AssigneePicker` the issue
 * list uses, so assigning a person reads the same as assigning a task.
 */
export function ProspectOwnerPicker({
  members,
  ownerId,
  contactId,
  accountId,
  compact,
  onChanged,
}: {
  members: Member[];
  ownerId: string | null;
  contactId?: string;
  accountId?: string;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className={pending ? "pointer-events-none opacity-60" : undefined}>
      <AssigneePicker
        members={members}
        value={ownerId}
        label="Unassigned"
        compact={compact}
        onChange={(v) =>
          start(async () => {
            try {
              await setProspectOwner({
                contactIds: contactId ? [contactId] : undefined,
                accountIds: accountId ? [accountId] : undefined,
                ownerId: v,
              });
              // The list refreshes its own window; everything else falls back
              // to the router so the server-rendered header re-reads the owner.
              if (onChanged) onChanged();
              else router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not assign");
            }
          })
        }
      />
    </span>
  );
}
