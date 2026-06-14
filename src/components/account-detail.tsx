"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";

import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logActivity } from "@/lib/actions";
import {
  ACCOUNT_TYPES,
  ACTIVITY_TYPES,
  DEAL_STAGE_MAP,
  optionMeta,
} from "@/lib/departments";
import { formatDate, formatMoney } from "@/lib/matrix-format";
import type { AccountDetail as AccountDetailType, Member } from "@/lib/types";

const fieldCls =
  "h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

export function AccountDetail({ account }: { account: AccountDetailType; members: Member[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [type, setType] = useState("note");
  const [body, setBody] = useState("");

  const typeMeta = optionMeta(ACCOUNT_TYPES, account.type);

  function add() {
    if (!body.trim()) return;
    start(async () => {
      await logActivity({ type, body: body.trim(), accountId: account.id });
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Link href="/sales" className="text-muted-foreground hover:text-foreground" aria-label="Back to Sales">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-sm font-semibold">{account.name}</h1>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: (typeMeta.color ?? "#94a3b8") + "22", color: typeMeta.color }}
        >
          {typeMeta.label}
        </span>
        {account.industry && <span className="text-xs text-muted-foreground">{account.industry}</span>}
        <span className="text-xs text-muted-foreground">· {account.entity}</span>
        {account.website && (
          <a href={account.website} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
            {account.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        {account.owner && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserAvatar name={account.owner.name} color={account.owner.avatarColor} className="size-4 text-[8px]" />
            {account.owner.name}
          </span>
        )}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-3">
        {/* Contacts */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Contacts</h2>
          <div className="space-y-1.5">
            {account.contacts.map((c) => (
              <div key={c.id} className="rounded-md border bg-background p-2 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.title, c.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            ))}
            {account.contacts.length === 0 && (
              <p className="text-xs text-muted-foreground">No contacts.</p>
            )}
          </div>
        </section>

        {/* Deals */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Deals</h2>
          <div className="space-y-1.5">
            {account.deals.map((d) => {
              const stage = DEAL_STAGE_MAP[d.stage as keyof typeof DEAL_STAGE_MAP];
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm">
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <span className="font-medium">{formatMoney(d.value)}</span>
                  {stage && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px]"
                      style={{ backgroundColor: stage.color + "22", color: stage.color }}
                    >
                      {stage.label}
                    </span>
                  )}
                </div>
              );
            })}
            {account.deals.length === 0 && <p className="text-xs text-muted-foreground">No deals.</p>}
          </div>
        </section>

        {/* Activity */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Activity</h2>
          <div className="mb-3 flex items-center gap-2">
            <select className={fieldCls + " w-24"} value={type} onChange={(e) => setType(e.target.value)}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </select>
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Log activity…" onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button size="sm" variant="outline" onClick={add}>Add</Button>
          </div>
          <ul className="space-y-2">
            {account.activities.map((a) => (
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
            {account.activities.length === 0 && (
              <li className="text-xs text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
