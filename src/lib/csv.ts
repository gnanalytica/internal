import { issueIdentifier } from "@/lib/types";
import type { IssueWithRelations } from "@/lib/types";

function cell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  // Quote when the value contains a comma, quote, or newline.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  "ID",
  "Title",
  "Status",
  "Priority",
  "Assignee",
  "Project",
  "Cycle",
  "Estimate",
  "Due",
  "Labels",
] as const;

export function issuesToCsv(issues: IssueWithRelations[]): string {
  const rows = issues.map((i) =>
    [
      issueIdentifier(i),
      i.title,
      i.status,
      i.priority,
      i.assignee?.name ?? "",
      i.project?.name ?? "",
      i.cycle?.name ?? "",
      i.estimate ?? "",
      i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : "",
      i.labels.map((l) => l.name).join("; "),
    ]
      .map(cell)
      .join(","),
  );
  return [HEADERS.join(","), ...rows].join("\n");
}
