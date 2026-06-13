"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ListFilter } from "lucide-react";

import { StatusIcon } from "@/components/glyphs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getEmbedProjects,
  queryEmbeddedIssues,
  type EmbedProject,
  type EmbeddedIssue,
} from "@/lib/actions";
import { STATUSES, type StatusId } from "@/lib/constants";

function IssueEmbedView({ node, updateAttributes, editor }: NodeViewProps) {
  const projectId: string | null = node.attrs.projectId ?? null;
  const status: string | null = node.attrs.status ?? null;
  const editable = editor.isEditable;

  const [issues, setIssues] = useState<EmbeddedIssue[]>([]);
  const [projects, setProjects] = useState<EmbedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmbedProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    queryEmbeddedIssues({ projectId, status })
      .then((rows) => {
        if (alive) {
          setIssues(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, status]);

  const project = projects.find((p) => p.id === projectId);
  const statusDef = STATUSES.find((s) => s.id === status);

  return (
    <NodeViewWrapper
      className="my-3 overflow-hidden rounded-xl border bg-muted/20"
      contentEditable={false}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5">
        <ListFilter className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Issues</span>

        {editable ? (
          <>
            <FilterDropdown
              label={project ? project.name : "All projects"}
              dot={project?.color}
            >
              <DropdownMenuItem
                onClick={() => updateAttributes({ projectId: null })}
                className="gap-2 text-xs text-muted-foreground"
              >
                All projects
                {!projectId && <Check className="size-3.5 opacity-70" />}
              </DropdownMenuItem>
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => updateAttributes({ projectId: p.id })}
                  className="gap-2 text-xs"
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {projectId === p.id && <Check className="size-3.5 opacity-70" />}
                </DropdownMenuItem>
              ))}
            </FilterDropdown>

            <FilterDropdown label={statusDef ? statusDef.label : "Any status"}>
              <DropdownMenuItem
                onClick={() => updateAttributes({ status: null })}
                className="gap-2 text-xs text-muted-foreground"
              >
                Any status
                {!status && <Check className="size-3.5 opacity-70" />}
              </DropdownMenuItem>
              {STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => updateAttributes({ status: s.id })}
                  className="gap-2 text-xs"
                >
                  <StatusIcon status={s.id} />
                  <span className="flex-1">{s.label}</span>
                  {status === s.id && <Check className="size-3.5 opacity-70" />}
                </DropdownMenuItem>
              ))}
            </FilterDropdown>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {project ? project.name : "All projects"}
            {statusDef ? ` · ${statusDef.label}` : ""}
          </span>
        )}

        <span className="ml-auto text-xs text-muted-foreground">{issues.length}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">No matching issues.</div>
      ) : (
        <div className="divide-y">
          {issues.map((i) => (
            <Link
              key={i.id}
              href={`/issues/${i.id}`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
            >
              <StatusIcon status={i.status as StatusId} />
              <span className="font-mono text-[11px] text-muted-foreground">{i.identifier}</span>
              <span className="truncate">{i.title}</span>
            </Link>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}

function FilterDropdown({
  label,
  dot,
  children,
}: {
  label: string;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-accent">
        {dot && <span className="size-2 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const IssueEmbed = Node.create({
  name: "issueEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      projectId: { default: null },
      status: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-issue-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-issue-embed": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(IssueEmbedView);
  },
});
