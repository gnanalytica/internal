import { Skeleton } from "@/components/ui/skeleton";

function TopbarSkeleton() {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="ml-auto h-7 w-24" />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="mx-auto w-full max-w-3xl space-y-2 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="flex gap-3 overflow-hidden p-4">
        {Array.from({ length: 4 }).map((_, c) => (
          <div key={c} className="w-64 shrink-0 space-y-2">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  const widths = ["55%", "70%", "40%", "60%", "80%", "50%"];
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="space-y-3 p-4">
        {widths.map((w, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-48 shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-5 rounded-md" style={{ width: w }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
