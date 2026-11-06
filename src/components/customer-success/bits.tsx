"use client";

import { HEALTH, requestState, requestStateMeta, type Health } from "@/lib/customer-success";
import type { Customer } from "@/lib/customer-success-data";
import type { TicketWithRelations } from "@/lib/types";
import { tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** "2 Nov" from an ISO date or timestamp, read as the calendar day it names. */
export function dayMonth(iso: string): string {
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(Date.parse(iso) + 5.5 * 3600_000);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function HealthDot({ health, className }: { health: Health; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", tone(HEALTH[health].tone).dot, className)} />;
}

export function HealthChip({ health, className }: { health: Health; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap", tone(HEALTH[health].tone).chip, className)}>
      <HealthDot health={health} />
      {HEALTH[health].label}
    </span>
  );
}

export function RequestStateChip({ status, className }: { status: string; className?: string }) {
  const meta = requestStateMeta(requestState(status));
  return <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", tone(meta.tone).chip, className)}>{meta.label}</span>;
}

/** A customer with everything the page works out about them. */
export type CustomerView = Customer & {
  health: Health;
  requests: TicketWithRelations[];
  openRequests: number;
};
