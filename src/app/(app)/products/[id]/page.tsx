import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleDot, Megaphone, TrendingUp, Wallet } from "lucide-react";

import { getProductSummaries, getWorkspace } from "@/lib/data";
import { formatMoney } from "@/lib/matrix-format";

export default async function ProductOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const product = (await getProductSummaries(ws.id)).find((p) => p.id === id);
  if (!product) notFound();

  const cards = [
    {
      href: `/products/${id}/engineering`,
      icon: <CircleDot className="size-4" />,
      label: "Engineering",
      stat: `${product.openIssues} open issues`,
      tool: "Linear-style issues",
    },
    {
      href: `/products/${id}/sales`,
      icon: <TrendingUp className="size-4" />,
      label: "Sales",
      stat: `${formatMoney(product.pipelineValue)} · ${product.openDeals} open deals`,
      tool: "Apollo / HubSpot-style pipeline",
    },
    {
      href: `/products/${id}/marketing`,
      icon: <Megaphone className="size-4" />,
      label: "Marketing",
      stat: `${product.activeCampaigns} active campaigns`,
      tool: "Campaigns & content calendar",
    },
    {
      href: `/products/${id}/finance`,
      icon: <Wallet className="size-4" />,
      label: "Finance",
      stat: `${formatMoney(product.revenue)} revenue`,
      tool: "Invoices & expenses",
    },
  ];

  return (
    <div className="overflow-auto p-4">
      {product.description && (
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{product.description}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border bg-background p-4 shadow-sm transition-colors hover:border-foreground/20"
          >
            <div className="flex items-center gap-2 font-medium">
              {c.icon}
              {c.label}
            </div>
            <div className="mt-2 text-sm">{c.stat}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.tool}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
