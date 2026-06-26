import Link from "next/link";
import { CircleDot, Compass, LifeBuoy, Megaphone, TrendingUp, Wallet } from "lucide-react";

import { enabledDepartments, type DepartmentSlug } from "@/lib/departments";
import { formatMoney } from "@/lib/matrix-format";
import type { ProductSummary } from "@/lib/types";

const DEPT_ICONS: Record<DepartmentSlug, React.ReactNode> = {
  engineering: <CircleDot className="size-3.5" />,
  sales: <TrendingUp className="size-3.5" />,
  marketing: <Megaphone className="size-3.5" />,
  finance: <Wallet className="size-3.5" />,
  support: <LifeBuoy className="size-3.5" />,
  features: <Compass className="size-3.5" />,
};

/**
 * The products hub: every product is a project, and each card links into that
 * product's department modules (Engineering / Sales / Marketing). The counts are
 * the company data filtered to this product — the product lens of the matrix.
 */
export function ProductsView({ products }: { products: ProductSummary[] }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <h1 className="text-sm font-semibold">Projects</h1>
        <span className="text-xs text-muted-foreground">
          {products.length} projects · Engineering · Sales · Marketing per project
        </span>
      </header>

      <div className="grid gap-3 overflow-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border bg-background p-4 shadow-sm">
            <Link href={`/products/${p.id}`} className="flex items-center gap-2 hover:underline">
              <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="font-semibold">{p.name}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{p.key}</span>
            </Link>
            {p.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
            )}

            <div className="mt-3 grid grid-cols-5 gap-2 text-center">
              <Stat value={String(p.openIssues)} label="Issues" />
              <Stat value={formatMoney(p.pipelineValue)} label={`${p.openDeals} deals`} />
              <Stat value={String(p.activeCampaigns)} label="Campaigns" />
              <Stat value={formatMoney(p.revenue)} label="Revenue" />
              <Stat value={String(p.openTickets)} label="Tickets" />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {enabledDepartments(p.enabledDepartments).map((d) => (
                <DeptLink
                  key={d.slug}
                  href={`/products/${p.id}/${d.slug}`}
                  icon={DEPT_ICONS[d.slug]}
                  label={d.label}
                />
              ))}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="col-span-full grid place-items-center py-12 text-sm text-muted-foreground">
            No products yet. Create a project and it will appear here with its departments.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DeptLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}
