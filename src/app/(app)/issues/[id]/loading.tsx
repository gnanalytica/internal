import { DetailSkeleton } from "@/components/page-skeleton";

// Without this the nearest boundary is issues/loading.tsx, whose list skeleton
// is the wrong shape for a single issue.
export default function Loading() {
  return <DetailSkeleton />;
}
