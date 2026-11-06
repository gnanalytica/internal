import { notFound } from "next/navigation";

import { CustomerSuccessView } from "@/components/customer-success/view";
import { loadCustomerSuccess } from "@/lib/customer-success-data";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import { getMyRole, getProject, getWorkspace } from "@/lib/data";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";

/**
 * The project's Customer Success, customer first. For Valytica the customers
 * are its prospects at Pilot running or Won, read from the prospects sheet,
 * each with an onboarding checklist, requests and check-ins. Deal values show
 * only to those who can see Sales.
 */
export default async function ProjectCustomerSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "customer-success")) notFound();

  const data = await loadCustomerSuccess({
    workspaceId: ws.id,
    projectId: id,
    fromSheet: project.key === PROSPECTS_PRODUCT_KEY,
    showValue: canSeeConfidential(await getMyRole(ws.id)),
  });
  return <CustomerSuccessView data={data} />;
}
