import { ProjectTabSkeleton } from "@/components/page-skeleton";

// Sits under this segment's layout, so switching department tabs keeps the
// project tab bar in place and shows this below it while the tab loads.
// (`projects/loading.tsx` is above the layout: it covers arriving at a project,
// before there is a tab bar to keep.)
export default function Loading() {
  return <ProjectTabSkeleton />;
}
