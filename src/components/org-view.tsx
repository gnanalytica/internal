"use client";

import Link from "next/link";

import { OrgChart } from "@/components/org-chart";
import { UserAvatar } from "@/components/glyphs";
import { Topbar } from "@/components/topbar";
import type { MemberWithRole, OrgRoleNode, Project } from "@/lib/types";

/**
 * The operating model is a convention, not schema: a builder owns everything
 * whose evidence lives inside the repo, a strategist (founder) everything
 * outside it. Unowned responsibilities default to the strategist.
 */
const BUILDER_SCOPE = [
  "code",
  "architecture",
  "infrastructure",
  "AI",
  "performance",
  "monitoring",
  "quality",
  "delivery",
];
const STRATEGIST_SCOPE = [
  "customers",
  "marketing",
  "priorities",
  "launch calls",
  "pricing & budget",
  "safety",
  "compliance",
];

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border bg-background/60 px-2 py-0.5 text-[10.5px] text-muted-foreground">
      {label}
    </span>
  );
}

export function OrgView({
  members,
  orgRoles,
  products,
  isAdmin,
}: {
  members: MemberWithRole[];
  orgRoles: OrgRoleNode[];
  products: Project[];
  isAdmin: boolean;
}) {
  const founders = members.filter((m) => m.role === "admin");
  const byId = new Map(members.map((m) => [m.id, m]));
  const contractors = members.filter((m) => m.employment === "contractor").length;
  const byEntity = new Map<string, number>();
  for (const m of members) byEntity.set(m.entity, (byEntity.get(m.entity) ?? 0) + 1);

  return (
    <div className="flex h-full flex-col">
      <Topbar breadcrumb={[{ label: "Organization" }]} />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-5 px-6 py-6">
          {/* Operating model — two hats split by the repo boundary */}
          <section className="rounded-xl border">
            <div className="grid md:grid-cols-[1fr_auto_1fr]">
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Builder
                </p>
                <p className="mt-0.5 text-sm font-semibold">makes it work</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {BUILDER_SCOPE.map((s) => (
                    <Chip key={s} label={s} />
                  ))}
                </div>
              </div>
              <div className="relative hidden items-center justify-center px-3 md:flex">
                <div className="absolute inset-y-3 left-1/2 border-l border-dashed" />
                <span className="z-10 bg-background px-1 py-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
                  the repo boundary
                </span>
              </div>
              <div className="border-t p-4 md:border-t-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Strategist
                </p>
                <p className="mt-0.5 text-sm font-semibold">makes it matter</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {STRATEGIST_SCOPE.map((s) => (
                    <Chip key={s} label={s} />
                  ))}
                </div>
              </div>
            </div>
            <p className="border-t px-4 py-2 text-[10.5px] text-muted-foreground">
              anything unowned defaults to the strategist — builders are protected from
              scope creep
            </p>
          </section>

          {/* Products × hats — derived from project owners and workspace admins */}
          <section className="rounded-xl border">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 border-b px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span>Product</span>
              <span>Builder</span>
              <span>Strategist</span>
            </div>
            {products.map((p) => {
              const builder = p.ownerId ? byId.get(p.ownerId) : undefined;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 border-b px-4 py-2.5 text-sm last:border-b-0"
                >
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex min-w-0 items-center gap-2 hover:underline"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate font-medium">{p.name}</span>
                  </Link>
                  {builder ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <UserAvatar name={builder.name} color={builder.avatarColor} />
                      <span className="truncate text-[13px]">{builder.name}</span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-amber-600 dark:text-amber-400">
                      open seat
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    {founders.map((f) => (
                      <span key={f.id} className="flex items-center gap-1" title={f.name}>
                        <UserAvatar name={f.name} color={f.avatarColor} />
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </section>

          {/* Org chart — same component as People & HR, minus the HR fields */}
          <section className="rounded-xl border p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Positions
            </p>
            <OrgChart roots={orgRoles} members={members} isAdmin={isAdmin} />
          </section>

          <div className="flex flex-wrap gap-1.5 pb-4">
            <Chip label={`${members.length} people`} />
            {[...byEntity.entries()].map(([entity, n]) => (
              <Chip key={entity} label={`${entity} ${n}`} />
            ))}
            <Chip label={`${contractors} contractors`} />
          </div>
        </div>
      </div>
    </div>
  );
}
