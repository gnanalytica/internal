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
  createDeal,
  deleteDeal,
  loadDealActivities,
  logActivity,
  updateDeal,
} from "@/lib/actions";
import { ACTIVITY_TYPES, DEAL_STAGES, ENTITIES } from "@/lib/departments";
import { dateInputValue, formatDate } from "@/lib/matrix-format";
import type {
  ActivityWithActor,
  ContactWithAccount,
  CrmAccount,
  DealWithRelations,
  Member,
  Project,
} from "@/lib/types";

const fieldCls =
  "h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

type Props = {
  deal: DealWithRelations | null;
  products: Project[];
  accounts: CrmAccount[];
  contacts: ContactWithAccount[];
  members: Member[];
  scopeProductId: string | null;
  onSaved: () => void;
  onClose: () => void;
};

export function DealDialog({
  open,
  onOpenChange,
  ...rest
}: Props & { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rest.deal ? "Deal" : "New deal"}</DialogTitle>
        </DialogHeader>
        {/* Keyed so the form fully remounts (fresh state) per deal/new session. */}
        {open && <DealForm key={rest.deal?.id ?? "new"} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}

function DealForm({
  deal,
  products,
  accounts,
  contacts,
  members,
  scopeProductId,
  onSaved,
  onClose,
}: Props) {
  const isEdit = !!deal;
  const [name, setName] = useState(deal?.name ?? "");
  const [productId, setProductId] = useState<string | null>(deal?.productId ?? scopeProductId);
  const [accountId, setAccountId] = useState<string | null>(deal?.accountId ?? null);
  const [contactId, setContactId] = useState<string | null>(deal?.contactId ?? null);
  const [stage, setStage] = useState(deal?.stage ?? "lead");
  const [value, setValue] = useState(deal?.value ?? 0);
  const [ownerId, setOwnerId] = useState<string | null>(deal?.ownerId ?? null);
  const [entity, setEntity] = useState(deal?.entity ?? "Global");
  const [expectedClose, setExpectedClose] = useState(dateInputValue(deal?.expectedClose));
  const [pending, startTransition] = useTransition();

  const [activities, setActivities] = useState<ActivityWithActor[]>([]);
  const [actType, setActType] = useState("note");
  const [actBody, setActBody] = useState("");

  useEffect(() => {
    if (!deal) return;
    let alive = true;
    loadDealActivities(deal.id).then((a) => {
      if (alive) setActivities(a);
    });
    return () => {
      alive = false;
    };
  }, [deal]);

  function save() {
    if (!productId) {
      toast.error("Pick a product for this deal.");
      return;
    }
    startTransition(async () => {
      if (deal) {
        await updateDeal(deal.id, {
          name,
          accountId,
          contactId,
          stage,
          value,
          entity,
          ownerId,
          expectedClose: expectedClose || null,
        });
        toast.success("Deal updated");
      } else {
        await createDeal({
          productId,
          name,
          accountId,
          contactId,
          stage,
          value,
          entity,
          expectedClose: expectedClose || null,
        });
        toast.success("Deal created");
      }
      onSaved();
      onClose();
    });
  }

  function addActivity() {
    if (!deal || !actBody.trim()) return;
    startTransition(async () => {
      await logActivity({
        type: actType,
        body: actBody.trim(),
        dealId: deal.id,
        accountId: deal.accountId,
        productId: deal.productId,
      });
      setActBody("");
      setActivities(await loadDealActivities(deal.id));
    });
  }

  function remove() {
    if (!deal) return;
    startTransition(async () => {
      await deleteDeal(deal.id);
      toast.success("Deal deleted");
      onSaved();
      onClose();
    });
  }

  const contactOptions = accountId
    ? contacts.filter((c) => c.accountId === accountId)
    : contacts;

  return (
    <>
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deal name" />

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Product">
            <select
              className={fieldCls}
              value={productId ?? ""}
              disabled={!!scopeProductId}
              onChange={(e) => setProductId(e.target.value || null)}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Stage">
            <select className={fieldCls} value={stage} onChange={(e) => setStage(e.target.value)}>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Account">
            <select
              className={fieldCls}
              value={accountId ?? ""}
              onChange={(e) => {
                setAccountId(e.target.value || null);
                setContactId(null);
              }}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Contact">
            <select
              className={fieldCls}
              value={contactId ?? ""}
              onChange={(e) => setContactId(e.target.value || null)}
            >
              <option value="">—</option>
              {contactOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Value ($)">
            <input
              type="number"
              className={fieldCls}
              value={value}
              onChange={(e) => setValue(Number(e.target.value) || 0)}
            />
          </Labeled>
          <Labeled label="Owner">
            <select
              className={fieldCls}
              value={ownerId ?? ""}
              onChange={(e) => setOwnerId(e.target.value || null)}
            >
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Entity">
            <select className={fieldCls} value={entity} onChange={(e) => setEntity(e.target.value)}>
              {ENTITIES.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Expected close">
            <input
              type="date"
              className={fieldCls}
              value={expectedClose}
              onChange={(e) => setExpectedClose(e.target.value)}
            />
          </Labeled>
        </div>

        {isEdit && (
          <div className="border-t pt-3">
            <div className="mb-2 text-sm font-medium">Activity</div>
            <div className="flex items-center gap-2">
              <select
                className={fieldCls + " w-28"}
                value={actType}
                onChange={(e) => setActType(e.target.value)}
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
              <Input
                value={actBody}
                onChange={(e) => setActBody(e.target.value)}
                placeholder="Log a call, email, note…"
                onKeyDown={(e) => e.key === "Enter" && addActivity()}
              />
              <Button size="sm" variant="outline" onClick={addActivity} disabled={pending}>
                Add
              </Button>
            </div>
            <ul className="mt-3 space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <span>{ACTIVITY_TYPES.find((t) => t.id === a.type)?.icon ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words">{a.body}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.actor?.name ?? "Someone"} · {formatDate(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
              {activities.length === 0 && (
                <li className="text-xs text-muted-foreground">No activity yet.</li>
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
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
