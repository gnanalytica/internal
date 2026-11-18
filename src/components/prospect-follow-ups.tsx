import Link from "next/link";

import { HomePanel } from "@/components/my-work-view";
import { DueChip } from "@/components/prospects-dashboard/bits";
import { prospectHref } from "@/lib/prospects/access";
import { loadProspectSnapshot } from "@/lib/prospects/read";
import { myTasks, todayIST } from "@/lib/prospects/stats";
import { everyRow } from "@/lib/prospects/views";

const SHOWN = 5;

/**
 * Home's "Sales follow-ups": the prospects assigned to you that are overdue or
 * due today, by the same rule as Your day on the Sales page (`myTasks`, focus
 * states). It reads the prospects sheet, so the home page streams it in
 * behind a Suspense boundary and renders nothing if the sheet can't be read:
 * a slow or failing sheet never holds up or breaks the rest of home.
 */
export async function ProspectFollowUps({ person, projectId }: { person: string; projectId: string }) {
  let tasks: ReturnType<typeof myTasks>;
  const today = todayIST();
  try {
    tasks = myTasks(everyRow(await loadProspectSnapshot(), "focus"), person, today);
  } catch (err) {
    console.error("[home] prospect follow-ups unavailable", err);
    return null;
  }
  const due = tasks.filter((t) => t.reason !== "new");
  const fresh = tasks.length - due.length;
  if (!tasks.length) return null;
  return (
    <HomePanel title="Sales follow-ups" count={due.length} href={`/projects/${projectId}/sales?tab=today`} linkLabel="Your day">
      {due.length === 0 ? (
        <p className="px-3 py-4 text-ui text-muted-foreground">Nothing due. {fresh} A-band {fresh === 1 ? "valuer is" : "valuers are"} waiting for a first call.</p>
      ) : (
        <ul>
          {due.slice(0, SHOWN).map(({ row }) => (
            <li key={`${row.kind}:${row.id}`} className="border-t border-border-subtle first:border-t-0">
              <Link href={prospectHref(projectId, row)} className="flex items-baseline gap-2.5 px-3 py-2.5 hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui">{row.name}</span>
                  {row.nextStep && <span className="block truncate text-xs text-muted-foreground">{row.nextStep}</span>}
                </span>
                <DueChip date={row.nextStepDate} today={today} className="shrink-0" />
              </Link>
            </li>
          ))}
          {(due.length > SHOWN || fresh > 0) && (
            <li className="border-t border-border-subtle px-3 py-2 text-xs text-muted-foreground">
              {[due.length > SHOWN ? `${due.length - SHOWN} more due` : "", fresh ? `${fresh} A-band to first contact` : ""].filter(Boolean).join(" · ")}
            </li>
          )}
        </ul>
      )}
    </HomePanel>
  );
}
