import { notFound } from "next/navigation";

import { CompanyPage } from "@/components/prospects/company-page";
import { getWorkspace } from "@/lib/data";
import { getCompanyView } from "@/lib/sheet-crm/queries";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  const view = await getCompanyView(ws.id, id);
  if (!view) notFound();
  return <CompanyPage view={view} backHref="/prospects" />;
}
