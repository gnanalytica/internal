import { Topbar } from "@/components/topbar";

/** Temporary empty surface shell — replaced by Plans 2–4. */
export function SurfacePlaceholder({
  projectName,
  projectId,
  title,
}: {
  projectName: string;
  projectId: string;
  title: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: projectName, href: `/projects/${projectId}` }, { label: title }]} />
      <div className="flex flex-1 items-center justify-center p-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          {title} for {projectName} will live here.
        </p>
      </div>
    </div>
  );
}
