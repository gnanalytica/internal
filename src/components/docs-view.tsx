"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText, Plus } from "lucide-react";

import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { createPage } from "@/lib/actions";
import type { PageNode } from "@/lib/types";

/**
 * A project's Docs: pages scoped to this project (specs, PRDs). The company
 * wiki is the same page system with no project — both edited at /pages/[id].
 */
export function DocsView({
  projectId,
  heading,
  tree,
}: {
  projectId: string;
  heading: string;
  tree: PageNode[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newDoc(parentId: string | null) {
    startTransition(async () => {
      const page = await createPage(parentId, projectId);
      router.push(`/pages/${page.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[{ label: heading }]}
        actions={
          <Button size="sm" className="h-7 gap-1.5" onClick={() => newDoc(null)} disabled={pending}>
            <Plus className="size-4" /> New doc
          </Button>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-xl border bg-muted/50">
                <FileText className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No docs yet</p>
                <p className="text-xs text-muted-foreground">
                  Specs, PRDs and notes for this project. Company-wide docs live in the Wiki.
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => newDoc(null)} disabled={pending}>
                <Plus className="size-4" /> New doc
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <DocRow key={node.id} node={node} depth={0} onAddChild={(id) => newDoc(id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocRow({
  node,
  depth,
  onAddChild,
}: {
  node: PageNode;
  depth: number;
  onAddChild: (id: string) => void;
}) {
  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <Link href={`/pages/${node.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-base leading-none">{node.icon}</span>
          <span className="truncate">{node.title || "Untitled"}</span>
        </Link>
        <button
          onClick={() => onAddChild(node.id)}
          className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
          aria-label="Add sub-page"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {node.children.map((child) => (
        <DocRow key={child.id} node={child} depth={depth + 1} onAddChild={onAddChild} />
      ))}
    </div>
  );
}
