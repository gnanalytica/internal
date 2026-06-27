"use client";

import Link from "next/link";
import { useState } from "react";
import type { JSONContent } from "@tiptap/react";

import { RichEditor } from "@/components/editor/rich-editor";
import { IssueRow } from "@/components/issue-row";
import { Topbar } from "@/components/topbar";
import { FEATURE_STATUSES } from "@/lib/departments";
import { featureProgress } from "@/lib/feature-progress";
import { updateFeature } from "@/lib/actions";
import type { FeatureDetail, Member } from "@/lib/types";

const toDateInput = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export function FeatureDetailView({
  feature,
  members,
  pages,
}: {
  feature: FeatureDetail;
  members: Member[];
  pages: { id: string; title: string; icon: string }[];
}) {
  const [title, setTitle] = useState(feature.title);
  const [status, setStatus] = useState(feature.status);
  const progress = featureProgress(feature.issues);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        breadcrumb={[
          {
            label: "Project",
            href: feature.project ? `/projects/${feature.project.id}/features` : "/features",
          },
          { label: title },
        ]}
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              void updateFeature(feature.id, { title: e.target.value.trim() || "Untitled feature" });
            }}
            className="w-full bg-transparent text-2xl font-bold outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                void updateFeature(feature.id, { status: e.target.value });
              }}
              className="rounded-md border bg-transparent px-2 py-1 text-xs"
              aria-label="Status"
            >
              {FEATURE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Start
              <input
                type="date"
                defaultValue={toDateInput(feature.startDate)}
                onChange={(e) =>
                  void updateFeature(feature.id, {
                    startDate: e.target.value ? new Date(e.target.value) : null,
                  })
                }
                className="rounded border bg-transparent px-1"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Target
              <input
                type="date"
                defaultValue={toDateInput(feature.targetDate)}
                onChange={(e) =>
                  void updateFeature(feature.id, {
                    targetDate: e.target.value ? new Date(e.target.value) : null,
                  })
                }
                className="rounded border bg-transparent px-1"
              />
            </label>
            <select
              defaultValue={feature.ownerId ?? ""}
              onChange={(e) => void updateFeature(feature.id, { ownerId: e.target.value || null })}
              className="rounded-md border bg-transparent px-2 py-1 text-xs"
              aria-label="Owner"
            >
              <option value="">No owner</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              defaultValue={feature.pageId ?? ""}
              onChange={(e) => void updateFeature(feature.id, { pageId: e.target.value || null })}
              className="rounded-md border bg-transparent px-2 py-1 text-xs"
              aria-label="Linked page"
            >
              <option value="">No linked page</option>
              {pages.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.icon} {pg.title}
                </option>
              ))}
            </select>
            {feature.page && (
              <Link
                href={`/pages/${feature.page.id}`}
                className="text-xs text-brand hover:underline"
              >
                Open {feature.page.icon} {feature.page.title}
              </Link>
            )}
          </div>

          {/* Inline spec / PRD */}
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Spec
            </h3>
            <RichEditor
              content={(feature.spec as JSONContent | null) ?? null}
              onChange={(json) => void updateFeature(feature.id, { spec: json })}
              placeholder="Write the PRD…"
            />
          </div>

          {/* Linked issues */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Issues
              </h3>
              <span className="text-xs text-muted-foreground">
                {progress.done}/{progress.total} · {progress.pct}%
              </span>
            </div>
            {feature.issues.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No issues linked yet. Set an issue&apos;s <strong>Feature</strong> to add it here.
              </p>
            ) : (
              <div className="mt-2 divide-y rounded-lg border">
                {feature.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} members={members} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
