"use client";

import { useTransition } from "react";

import { setOutreachStatus } from "@/lib/sheet-crm/actions";
import { OUTREACH_STATUSES, OUTREACH_STATUS_MAP, isOutreachStatus } from "@/lib/sheet-crm/outreach";

/** The outreach status, as a pill that is also the control to change it. */
export function StatusPill({
  status,
  contactId,
  accountId,
  onChanged,
  readOnly,
}: {
  status: string;
  contactId?: string;
  accountId?: string;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const meta = isOutreachStatus(status) ? OUTREACH_STATUS_MAP[status] : OUTREACH_STATUS_MAP.not_planned;
  if (readOnly) return <Pill color={meta.color}>{meta.label}</Pill>;
  return (
    <select
      value={meta.id}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await setOutreachStatus({ contactId, accountId, status: e.target.value });
          onChanged?.();
        })
      }
      className="h-7 max-w-full rounded-full border px-2 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-ring/40 sm:h-6"
      style={{ backgroundColor: meta.color + "22", color: meta.color, borderColor: meta.color + "55" }}
      aria-label="Outreach status"
    >
      {OUTREACH_STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function Pill({ color, children, title }: { color?: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium whitespace-nowrap"
      style={color ? { backgroundColor: color + "22", color, borderColor: color + "55" } : undefined}
    >
      {children}
    </span>
  );
}

export const PRIORITY_COLORS: Record<string, string> = { A: "#10b981", B: "#6366f1", C: "#94a3b8", D: "#ef4444" };
export const BAND_COLORS: Record<string, string> = { A: "#10b981", B: "#f59e0b", C: "#94a3b8", WATCH: "#64748b" };
