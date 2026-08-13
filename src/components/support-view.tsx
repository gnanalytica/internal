"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LifeBuoy, Plus } from "lucide-react";

import { ChartCard, ColumnChart, type Slice } from "@/components/charts";
import { DepartmentTasks } from "@/components/department-tasks";
import { EmptyState } from "@/components/empty-state";
import { TicketBoard } from "@/components/ticket-board";
import { TicketDialog } from "@/components/ticket-dialog";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { moveTickets } from "@/lib/actions";
import { OPEN_TICKET_STATUSES, TICKET_PRIORITIES } from "@/lib/departments";
import type {
  IssueWithRelations,
  ContactWithAccount,
  CrmAccount,
  Member,
  Project,
  TicketWithRelations,
} from "@/lib/types";

export function SupportView({
  heading,
  scopeProjectId,
  projects,
  members,
  accounts,
  contacts,
  initialTickets,
  issues,
}: {
  heading: string;
  scopeProjectId: string | null;
  projects: Project[];
  members: Member[];
  accounts: CrmAccount[];
  contacts: ContactWithAccount[];
  initialTickets: TicketWithRelations[];
  issues: IssueWithRelations[];
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
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <>
            <span className="text-xs text-muted-foreground">{openCount} open</span>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> New ticket
            </Button>
          </>
        }
      />

      <Tabs defaultValue="tasks" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="min-h-0 flex-1 overflow-auto p-4">
          <DepartmentTasks
            issues={issues}
            department="customer-success"
            emptyLabel="No onboarding or support tasks yet."
          />
        </TabsContent>

        <TabsContent value="tickets" className="flex min-h-0 flex-1 flex-col">
      {initialTickets.length > 0 && (
        <div className="px-4 pt-3">
          <ChartCard title="Tickets by priority" hint={`${initialTickets.length} total`}>
            <ColumnChart data={byPriority} height={96} />
          </ChartCard>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {initialTickets.length === 0 ? (
          <EmptyState
            className="h-full"
            icon={<LifeBuoy className="size-6" />}
            title="No tickets yet"
            description="Track customer questions and bugs through an open → solved queue."
            action={
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" /> New ticket
              </Button>
            }
          />
        ) : (
          <TicketBoard
            key={boardKey}
            tickets={initialTickets}
            showProject={!scopeProjectId}
            persist={(changed) => startTransition(() => void moveTickets(changed))}
            onOpen={(t) => {
              setEditing(t);
              setDialogOpen(true);
            }}
          />
        )}
      </div>
        </TabsContent>
      </Tabs>

      <TicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ticket={editing}
        projects={projects}
        accounts={accounts}
        contacts={contacts}
        members={members}
        scopeProjectId={scopeProjectId}
        onSaved={() => router.refresh()}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
