import { STATUS_MAP, type StatusId, type PriorityId } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Linear-style circular status glyph. */
export function StatusIcon({
  status,
  className,
}: {
  status: StatusId;
  className?: string;
}) {
  const color = STATUS_MAP[status]?.color ?? "#bec2c8";
  const c = cn("size-3.5 shrink-0", className);

  switch (status) {
    case "backlog":
      return (
        <svg viewBox="0 0 14 14" className={c} aria-hidden>
          <circle
            cx="7"
            cy="7"
            r="6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>
      );
    case "todo":
      return (
        <svg viewBox="0 0 14 14" className={c} aria-hidden>
          <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "in_progress":
      return (
        <svg viewBox="0 0 14 14" className={c} aria-hidden>
          <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="1.5" />
          <path d="M7 7 L7 1.5 A5.5 5.5 0 0 1 12.5 7 Z" fill={color} />
        </svg>
      );
    case "in_review":
      return (
        <svg viewBox="0 0 14 14" className={c} aria-hidden>
          <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="1.5" />
          <path
            d="M7 7 L7 1.5 A5.5 5.5 0 0 1 12.5 7 A5.5 5.5 0 0 1 7 12.5 Z"
            fill={color}
          />
        </svg>
      );
    case "done":
      return (
        <svg viewBox="0 0 14 14" className={c} aria-hidden>
          <circle cx="7" cy="7" r="6.5" fill={color} />
          <path
            d="M4.2 7.1 L6.2 9 L9.8 5"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "canceled":
      return (
        <svg viewBox="0 0 14 14" className={c} aria-hidden>
          <circle cx="7" cy="7" r="6.5" fill={color} />
          <path
            d="M4.7 4.7 L9.3 9.3 M9.3 4.7 L4.7 9.3"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

/** Linear-style priority glyph (bars / urgent box). */
export function PriorityIcon({
  priority,
  className,
}: {
  priority: PriorityId;
  className?: string;
}) {
  const c = cn("size-3.5 shrink-0", className);
  const muted = "var(--color-muted-foreground)";

  if (priority === "urgent") {
    return (
      <svg viewBox="0 0 14 14" className={c} aria-hidden>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="#f97066" />
        <rect x="6.25" y="3.2" width="1.5" height="4.6" rx="0.75" fill="white" />
        <rect x="6.25" y="9.1" width="1.5" height="1.6" rx="0.75" fill="white" />
      </svg>
    );
  }

  if (priority === "none") {
    return (
      <svg viewBox="0 0 14 14" className={c} aria-hidden>
        {[2.5, 7, 11.5].map((x) => (
          <rect key={x} x={x - 0.9} y="6.4" width="1.8" height="1.6" rx="0.8" fill={muted} />
        ))}
      </svg>
    );
  }

  const levels: Record<Exclude<PriorityId, "urgent" | "none">, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };
  const active = levels[priority as "low" | "medium" | "high"];
  const bars = [
    { x: 1.5, h: 4, y: 9 },
    { x: 5.5, h: 7, y: 6 },
    { x: 9.5, h: 10, y: 3 },
  ];

  return (
    <svg viewBox="0 0 14 14" className={c} aria-hidden>
      {bars.map((b, i) => (
        <rect
          key={b.x}
          x={b.x}
          y={b.y}
          width="3"
          height={b.h}
          rx="1"
          fill={i < active ? "currentColor" : muted}
          opacity={i < active ? 1 : 0.35}
        />
      ))}
    </svg>
  );
}

/** Colored initials avatar. */
export function UserAvatar({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-[10px] font-medium text-white select-none",
        "size-5",
        className,
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials}
    </span>
  );
}
