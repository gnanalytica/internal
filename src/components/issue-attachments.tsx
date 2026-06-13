"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Download, FileIcon, ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteAttachment, uploadAttachment } from "@/lib/actions";
import type { Attachment } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string | null): boolean {
  return Boolean(contentType?.startsWith("image/"));
}

export function IssueAttachments({
  issueId,
  attachments,
  enabled,
}: {
  issueId: string;
  attachments: Attachment[];
  enabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        await uploadAttachment(issueId, fd);
      }
      toast.success(files.length === 1 ? "File attached" : `${files.length} files attached`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(a: Attachment) {
    startTransition(async () => {
      await deleteAttachment(a.id, issueId);
      toast.success("Attachment removed");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Attachments
        </h3>
        {enabled && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
            </Button>
          </>
        )}
      </div>

      {!enabled ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" />
          File storage isn&apos;t configured yet. Add a{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">BLOB_READ_WRITE_TOKEN</code>{" "}
          to enable attachments.
        </p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No attachments yet. Upload screenshots, specs, or any file.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-lg border bg-muted/20"
            >
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                {isImage(a.contentType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt={a.name}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-muted/40">
                    {isImage(a.contentType) ? (
                      <ImageIcon className="size-7 text-muted-foreground" />
                    ) : (
                      <FileIcon className="size-7 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Download className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs">{a.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {formatSize(a.size)}
                  </span>
                </div>
              </a>
              <button
                onClick={() => remove(a)}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm hover:text-destructive group-hover:opacity-100"
                aria-label="Remove attachment"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
