import { Lock } from "lucide-react";

/** Shown in place of a confidential surface for non-admins. */
export function Restricted({ label = "This area" }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
        <Lock className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{label} is restricted</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Finance, Sales and People &amp; HR are visible to founders only. Ask an
          admin if you need access.
        </p>
      </div>
    </div>
  );
}
