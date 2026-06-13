"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { deletePageForever, restorePage } from "@/lib/actions";

type TrashedPage = {
  id: string;
  title: string;
  icon: string;
  deletedAt: Date | null;
};

export function TrashView({ pages }: { pages: TrashedPage[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function restore(id: string) {
    startTransition(async () => {
      await restorePage(id);
      toast.success("Page restored");
      router.refresh();
    });
  }

  function purge(id: string) {
    startTransition(async () => {
      await deletePageForever(id);
      toast.success("Page permanently deleted");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Trash" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <Trash2 className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Trash is empty</p>
                <p className="text-xs text-muted-foreground">
                  Deleted pages land here and can be restored.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Deleted pages are kept here until you remove them permanently.
              </p>
              <div className="space-y-1">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <span className="text-base leading-none">{p.icon}</span>
                    <span className="flex-1 truncate text-sm">{p.title || "Untitled"}</span>
                    {p.deletedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(p.deletedAt), { addSuffix: true })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => restore(p.id)}
                    >
                      <RotateCcw className="size-3.5" /> Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => purge(p.id)}
                      aria-label="Delete forever"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
