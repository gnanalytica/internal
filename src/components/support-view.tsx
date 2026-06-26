"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { ChartCard, ColumnChart, type Slice } from "@/components/charts";
import { TicketBoard } from "@/components/ticket-board";
import { TicketDialog } from "@/components/ticket-dialog";
import { Button } from "@/components/ui/button";
import { moveTickets } from "@/lib/actions";
import { OPEN_TICKET_STATUSES, TICKET_PRIORITIES } from "@/lib/departments";
import type {
  ContactWithAccount,
  CrmAccount,
  Member,
  Project,
  TicketWithRelations,
} from "@/lib/types";

export function SupportView({
  heading,
  scopeProductId,
  products,
  members,
  accounts,
  contacts,
  initialTickets,
}: {
  heading: string;
  scopeProductId: string | null;
  products: Project[];
  members: Member[];
  accounts: CrmAccount[];
  contacts: ContactWithAccount[];
  initialTickets: TicketWithRelations[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TicketWithRelations | null>(null);

  const openCount = initialTickets.filter((t) =>
    OPEN_TICKET_STATUSES.includes(t.status as (typeof OPEN_TICKET_STATUSES)[number]),
  ).length;
  const boardKey = initialTickets.map((t) => t.id).join(",");
  const byPriority: Slice[] = TICKET_PRIORITIES.map((p) => ({
    label: p.label,
    value: initialTickets.filter((t) => t.priority === p.id).length,
    color: p.color,
  }));

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <h1 className="text-sm font-semibold">{heading}</h1>
        <span className="text-xs text-muted-foreground">{openCount} open</span>
        <Button
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> New ticket
        </Button>
      </header>

      {initialTickets.length > 0 && (
        <div className="px-4 pt-3">
          <ChartCard title="Tickets by priority" hint={`${initialTickets.length} total`}>
            <ColumnChart data={byPriority} height={96} />
          </ChartCard>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {initialTickets.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No tickets yet. Create one to start the queue.
          </div>
        ) : (
          <TicketBoard
            key={boardKey}
            tickets={initialTickets}
            showProduct={!scopeProductId}
            persist={(changed) => startTransition(() => void moveTickets(changed))}
            onOpen={(t) => {
              setEditing(t);
              setDialogOpen(true);
            }}
          />
        )}
      </div>

      <TicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ticket={editing}
        products={products}
        accounts={accounts}
        contacts={contacts}
        members={members}
        scopeProductId={scopeProductId}
        onSaved={() => router.refresh()}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
