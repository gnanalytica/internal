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

/** A department tab under the project tab bar: its toolbar, then rows. */
export function ProjectTabSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="space-y-2 p-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Home: title, the four-count strip, then bucketed rows beside the side panels. */
export function HomeSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-6 sm:px-6 lg:py-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-[74px] w-full rounded-lg" />
          <div className="overflow-hidden rounded-lg border">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex h-9 items-center gap-3 border-b border-border-subtle px-3 last:border-b-0">
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-3.5" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
                <Skeleton className="ml-auto h-3.5 w-12" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-6 xl:block">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** A narrow feed of rows (the inbox). */
export function FeedSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="mx-auto w-full max-w-2xl space-y-3 px-2 py-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocLines() {
  const widths = ["92%", "85%", "96%", "60%", "88%", "74%"];
  return (
    <div className="space-y-2.5">
      {widths.map((w, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: w }} />
      ))}
    </div>
  );
}

/** A document page: title, then body text in a reading column. */
export function DocSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-12 py-12">
        <Skeleton className="h-9 w-2/3" />
        <DocLines />
      </div>
    </div>
  );
}

/** An issue: title and body beside the properties panel. */
export function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <TopbarSkeleton />
      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <div className="flex-1">
          <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8 md:px-10 md:py-10">
            <Skeleton className="h-8 w-3/4" />
            <DocLines />
          </div>
        </div>
        <div className="w-full shrink-0 space-y-3 border-b bg-muted/20 p-4 md:w-64 md:border-b-0 md:border-l">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
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
