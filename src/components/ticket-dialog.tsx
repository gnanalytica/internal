"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addTicketComment,
  createTicket,
  deleteTicket,
  loadTicketComments,
  updateTicket,
} from "@/lib/actions";
import { ENTITIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/departments";
import { formatDate } from "@/lib/matrix-format";
import type {
  ContactWithAccount,
  CrmAccount,
  Member,
  Project,
  TicketCommentWithAuthor,
  TicketWithRelations,
} from "@/lib/types";

const fieldCls =
  "h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

type Props = {
  ticket: TicketWithRelations | null;
  products: Project[];
  accounts: CrmAccount[];
  contacts: ContactWithAccount[];
  members: Member[];
  scopeProductId: string | null;
  onSaved: () => void;
  onClose: () => void;
};

export function TicketDialog({
  open,
  onOpenChange,
  ...rest
}: Props & { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rest.ticket ? "Ticket" : "New ticket"}</DialogTitle>
        </DialogHeader>
        {open && <TicketForm key={rest.ticket?.id ?? "new"} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}

function TicketForm({
  ticket,
  products,
  accounts,
  contacts,
  members,
  scopeProductId,
  onSaved,
  onClose,
}: Props) {
  const isEdit = !!ticket;
  const [subject, setSubject] = useState(ticket?.subject ?? "");
  const [productId, setProductId] = useState<string | null>(ticket?.productId ?? scopeProductId);
  const [status, setStatus] = useState(ticket?.status ?? "open");
  const [priority, setPriority] = useState(ticket?.priority ?? "normal");
  const [accountId, setAccountId] = useState<string | null>(ticket?.accountId ?? null);
  const [contactId, setContactId] = useState<string | null>(ticket?.contactId ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(ticket?.assigneeId ?? null);
  const [requesterEmail, setRequesterEmail] = useState(ticket?.requesterEmail ?? "");
  const [entity, setEntity] = useState(ticket?.entity ?? "Global");
  const [body, setBody] = useState(ticket?.body ?? "");
  const [pending, startTransition] = useTransition();

  const [comments, setComments] = useState<TicketCommentWithAuthor[]>([]);
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (!ticket) return;
    let alive = true;
    loadTicketComments(ticket.id).then((c) => {
      if (alive) setComments(c);
    });
    return () => {
      alive = false;
    };
  }, [ticket]);

  function save() {
    startTransition(async () => {
      if (ticket) {
        await updateTicket(ticket.id, {
          subject,
          status,
          priority,
          accountId,
          contactId,
          assigneeId,
          requesterEmail: requesterEmail || null,
          entity,
          body: body || null,
        });
        toast.success("Ticket updated");
      } else {
        await createTicket({
          productId,
          subject,
          status,
          priority,
          accountId,
          contactId,
          assigneeId,
          requesterEmail: requesterEmail || null,
          entity,
          body: body || null,
        });
        toast.success("Ticket created");
      }
      onSaved();
      onClose();
    });
  }

  function sendReply() {
    if (!ticket || !reply.trim()) return;
    startTransition(async () => {
      await addTicketComment(ticket.id, reply.trim());
      setReply("");
      setComments(await loadTicketComments(ticket.id));
    });
  }

  function remove() {
    if (!ticket) return;
    startTransition(async () => {
      await deleteTicket(ticket.id);
      toast.success("Ticket deleted");
      onSaved();
      onClose();
    });
  }

  const contactOptions = accountId ? contacts.filter((c) => c.accountId === accountId) : contacts;

  return (
    <>
      <div className="space-y-3">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue…"
          rows={3}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Product">
            <select
              className={fieldCls}
              value={productId ?? ""}
              disabled={!!scopeProductId}
              onChange={(e) => setProductId(e.target.value || null)}
            >
              <option value="">No product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Status">
            <select className={fieldCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              {TICKET_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Labeled>
          <Labeled label="Priority">
            <select className={fieldCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {TICKET_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Labeled>
          <Labeled label="Assignee">
            <select className={fieldCls} value={assigneeId ?? ""} onChange={(e) => setAssigneeId(e.target.value || null)}>
              <option value="">—</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Account">
            <select
              className={fieldCls}
              value={accountId ?? ""}
              onChange={(e) => { setAccountId(e.target.value || null); setContactId(null); }}
            >
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Contact">
            <select className={fieldCls} value={contactId ?? ""} onChange={(e) => setContactId(e.target.value || null)}>
              <option value="">—</option>
              {contactOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Requester email">
            <input className={fieldCls} value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="customer@example.com" />
          </Labeled>
          <Labeled label="Entity">
            <select className={fieldCls} value={entity} onChange={(e) => setEntity(e.target.value)}>
              {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
            </select>
          </Labeled>
        </div>

        {isEdit && (
          <div className="border-t pt-3">
            <div className="mb-2 text-sm font-medium">Conversation</div>
            <div className="flex items-center gap-2">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply…"
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
              />
              <Button size="sm" variant="outline" onClick={sendReply} disabled={pending}>
                Reply
              </Button>
            </div>
            <ul className="mt-3 space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="break-words">{c.body}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.author?.name ?? "Someone"} · {formatDate(c.createdAt)}
                  </div>
                </li>
              ))}
              {comments.length === 0 && (
                <li className="text-xs text-muted-foreground">No replies yet.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
        {isEdit ? (
          <Button variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </DialogFooter>
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
