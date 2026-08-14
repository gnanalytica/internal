"use client";

import type { JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock, History } from "lucide-react";
import { toast } from "sonner";

import { RelativeTime } from "@/components/relative-time";
import { RichEditor } from "@/components/editor/rich-editor";
import { UserAvatar } from "@/components/glyphs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadPageVersionContent, restorePageVersion } from "@/lib/actions";
import type { PageVersionItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHistory({
  currentTitle,
  versions,
}: {
  currentTitle: string;
  versions: PageVersionItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; content: JSONContent | null } | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [loading, startLoad] = useTransition();
  const [restoring, startRestore] = useTransition();

  function select(id: string) {
    setSelected(id);
    setConfirming(false);
    setPreview(null);
    startLoad(async () => {
      const v = await loadPageVersionContent(id);
      if (v) setPreview({ title: v.title, content: (v.content as JSONContent) ?? null });
    });
  }

  function restore() {
    if (!selected) return;
    startRestore(async () => {
      await restorePageVersion(selected);
      toast.success("Page restored — the previous state was saved as a version");
      setOpen(false);
      setSelected(null);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="size-7" />}
        aria-label="Version history"
        title="Version history"
      >
        <History className="size-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Clock className="size-4" /> Version history
          </SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1">
          {/* Version list */}
          <div className="w-56 shrink-0 overflow-y-auto border-r">
            <button
              onClick={() => {
                setSelected(null);
                setPreview(null);
                setConfirming(false);
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-xs hover:bg-accent",
                selected === null && "bg-accent",
              )}
            >
              <span className="font-medium">Current</span>
              <span className="truncate text-muted-foreground">{currentTitle}</span>
            </button>
            {versions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                No history yet. Versions are captured automatically as you edit.
              </p>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => select(v.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-xs hover:bg-accent",
                    selected === v.id && "bg-accent",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <UserAvatar
                      name={v.author?.name ?? "?"}
                      color={v.author?.avatarColor ?? "#94a3b8"}
                      className="size-4 text-[7px]"
                    />
                    <span className="font-medium">
                      <RelativeTime date={v.createdAt} />
                    </span>
                    {v.cause === "restore" && (
                      <span className="rounded bg-amber-500/15 px-1 text-[9px] font-medium text-amber-600">
                        restored
                      </span>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {v.author?.name ?? "Unknown"} · {v.title}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Preview */}
          <div className="flex min-w-0 flex-1 flex-col">
            {selected === null ? (
              <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
                Select a version to preview it here.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
                  {confirming ? (
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Restore this version? Current state is saved first.
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => setConfirming(false)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" className="h-7" onClick={restore} disabled={restoring}>
                          {restoring ? "Restoring…" : "Confirm restore"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="truncate text-sm font-medium">
                        {preview?.title ?? "…"}
                      </span>
                      <Button
                        size="sm"
                        className="h-7 shrink-0"
                        onClick={() => setConfirming(true)}
                        disabled={loading}
                      >
                        Restore this version
                      </Button>
                    </>
                  )}
                </div>
                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-6 text-[15px]">
                  {loading || !preview ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <RichEditor content={preview.content} editable={false} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
