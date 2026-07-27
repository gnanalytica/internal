"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { deleteAttachment, uploadAttachment } from "@/lib/actions";
import type { Attachment } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

export function IssueAttachments({
  issueId,
  attachments,
}: {
  issueId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(files: FileList | File[]) {
    for (const file of [...files]) {
      const fd = new FormData();
      fd.append("file", file);
      const id = toast.loading(`Uploading ${file.name}…`);
      try {
        await uploadAttachment(issueId, fd);
        toast.success("Attached", { id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed", { id });
      }
    }
    router.refresh();
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Attachments {attachments.length > 0 && `(${attachments.length})`}
      </h3>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground transition-colors hover:bg-accent",
          dragOver && "border-brand bg-brand/5 text-brand",
        )}
      >
        <Upload className="size-4" />
        Drop files or click to upload
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="mt-2 space-y-1">
          {attachments.map((a) => {
            const isImage = a.contentType?.startsWith("image/");
            return (
              <div
                key={a.id}
                className="group flex items-center gap-2.5 rounded-md border px-2 py-1.5"
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="size-8 rounded object-cover" />
                ) : (
                  <span className="grid size-8 place-items-center rounded bg-muted text-muted-foreground">
                    <FileText className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="block truncate text-sm hover:underline"
                  >
                    {a.name}
                  </a>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(a.size)}
                    {a.uploader ? ` · ${a.uploader.name}` : ""} ·{" "}
                    {formatDistanceToNowStrict(new Date(a.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await deleteAttachment(a.id, issueId);
                      router.refresh();
                    })
                  }
                  className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete attachment"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
