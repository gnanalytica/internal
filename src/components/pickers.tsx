"use client";

import { Check, Timer } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityIcon, StatusIcon, UserAvatar } from "@/components/glyphs";
import {
  PRIORITIES,
  PRIORITY_MAP,
  STATUSES,
  STATUS_MAP,
  type PriorityId,
  type StatusId,
} from "@/lib/constants";
import type { Cycle, Label, Member, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const triggerCls =
  "inline-flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-xs text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors";

function Dot({ color }: { color: string }) {
  return (
    <span
      className="size-2.5 rounded-full ring-1 ring-inset ring-black/10"
      style={{ backgroundColor: color }}
    />
  );
}

export function StatusPicker({
  value,
  onChange,
  compact,
}: {
  value: StatusId;
  onChange: (v: StatusId) => void;
  compact?: boolean;
}) {
  const s = STATUS_MAP[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set status">
        <StatusIcon status={value} />
        {!compact && <span>{s?.label}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {STATUSES.map((st) => (
          <DropdownMenuItem
            key={st.id}
            onClick={() => onChange(st.id)}
            className="gap-2 text-xs"
          >
            <StatusIcon status={st.id} />
            <span className="flex-1">{st.label}</span>
            {value === st.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityPicker({
  value,
  onChange,
  compact,
}: {
  value: PriorityId;
  onChange: (v: PriorityId) => void;
  compact?: boolean;
}) {
  const p = PRIORITY_MAP[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set priority">
        <PriorityIcon priority={value} />
        {!compact && <span>{p?.label}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {PRIORITIES.map((pr) => (
          <DropdownMenuItem
            key={pr.id}
            onClick={() => onChange(pr.id)}
            className="gap-2 text-xs"
          >
            <PriorityIcon priority={pr.id} />
            <span className="flex-1">{pr.label}</span>
            {value === pr.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneePicker({
  members,
  value,
  onChange,
  compact,
}: {
  members: Member[];
  value: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}) {
  const m = members.find((x) => x.id === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set assignee">
        {m ? (
          <UserAvatar name={m.name} color={m.avatarColor} className="size-4 text-[8px]" />
        ) : (
          <span className="grid size-4 place-items-center rounded-full border border-dashed border-muted-foreground/60 text-[9px] text-muted-foreground">
            ?
          </span>
        )}
        {!compact && <span>{m ? m.name : "Unassigned"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => onChange(null)} className="gap-2 text-xs">
          <span className="grid size-4 place-items-center rounded-full border border-dashed border-muted-foreground/60 text-[9px] text-muted-foreground">
            ?
          </span>
          <span className="flex-1">Unassigned</span>
          {!value && <Check className="size-3.5 opacity-70" />}
        </DropdownMenuItem>
        {members.map((mem) => (
          <DropdownMenuItem
            key={mem.id}
            onClick={() => onChange(mem.id)}
            className="gap-2 text-xs"
          >
            <UserAvatar name={mem.name} color={mem.avatarColor} className="size-4 text-[8px]" />
            <span className="flex-1">{mem.name}</span>
            {value === mem.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectPicker({
  projects,
  value,
  onChange,
  compact,
}: {
  projects: Project[];
  value: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}) {
  const p = projects.find((x) => x.id === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set project">
        {p ? (
          <Dot color={p.color} />
        ) : (
          <span className="size-2.5 rounded-full border border-dashed border-muted-foreground/60" />
        )}
        {!compact && <span>{p ? p.name : "No project"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => onChange(null)} className="gap-2 text-xs">
          <span className="size-2.5 rounded-full border border-dashed border-muted-foreground/60" />
          <span className="flex-1">No project</span>
          {!value && <Check className="size-3.5 opacity-70" />}
        </DropdownMenuItem>
        {projects.map((proj) => (
          <DropdownMenuItem
            key={proj.id}
            onClick={() => onChange(proj.id)}
            className="gap-2 text-xs"
          >
            <Dot color={proj.color} />
            <span className="flex-1">{proj.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{proj.key}</span>
            {value === proj.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FeaturePicker({
  features,
  value,
  onChange,
  compact,
}: {
  features: { id: string; title: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}) {
  const f = features.find((x) => x.id === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set feature">
        <span className="size-2.5 rounded-full border border-dashed border-muted-foreground/60" />
        {!compact && <span>{f ? f.title : "No feature"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => onChange(null)} className="gap-2 text-xs">
          <span className="flex-1">No feature</span>
          {!value && <Check className="size-3.5 opacity-70" />}
        </DropdownMenuItem>
        {features.map((feat) => (
          <DropdownMenuItem
            key={feat.id}
            onClick={() => onChange(feat.id)}
            className="gap-2 text-xs"
          >
            <span className="flex-1 truncate">{feat.title}</span>
            {value === feat.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LabelPicker({
  labels,
  value,
  onChange,
}: {
  labels: Label[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set labels">
        <span className="text-muted-foreground">
          {value.length ? `${value.length} label${value.length > 1 ? "s" : ""}` : "Labels"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {labels.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No labels</div>
        )}
        {labels.map((lb) => (
          <DropdownMenuItem
            key={lb.id}
            closeOnClick={false}
            onClick={() => toggle(lb.id)}
            className="gap-2 text-xs"
          >
            <Dot color={lb.color} />
            <span className="flex-1">{lb.name}</span>
            {value.includes(lb.id) && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CyclePicker({
  cycles,
  value,
  onChange,
  compact,
}: {
  cycles: Cycle[];
  value: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}) {
  const c = cycles.find((x) => x.id === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerCls} aria-label="Set cycle">
        <Timer className={cn("size-3.5", c ? "text-foreground" : "text-muted-foreground")} />
        {!compact && <span>{c ? c.name : "No cycle"}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => onChange(null)} className="gap-2 text-xs">
          <Timer className="size-3.5 text-muted-foreground" />
          <span className="flex-1">No cycle</span>
          {!value && <Check className="size-3.5 opacity-70" />}
        </DropdownMenuItem>
        {cycles.map((cy) => (
          <DropdownMenuItem
            key={cy.id}
            onClick={() => onChange(cy.id)}
            className="gap-2 text-xs"
          >
            <Timer className="size-3.5" />
            <span className="flex-1 truncate">{cy.name}</span>
            {value === cy.id && <Check className="size-3.5 opacity-70" />}
          </DropdownMenuItem>
        ))}
        {cycles.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No cycles yet</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
      )}
      style={{
        borderColor: `color-mix(in oklch, ${label.color} 40%, transparent)`,
        color: label.color,
        backgroundColor: `color-mix(in oklch, ${label.color} 12%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
    </span>
  );
}
