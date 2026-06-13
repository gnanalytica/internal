/** An issue is overdue when its due date is in the past and it isn't closed. */
export function isOverdue(
  dueDate: Date | string | null | undefined,
  status: string,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  if (status === "done" || status === "canceled") return false;
  return new Date(dueDate).getTime() < now.getTime();
}

/** Compact due-date label, e.g. "Mar 4". */
export function formatDue(dueDate: Date | string): string {
  const d = new Date(dueDate);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
