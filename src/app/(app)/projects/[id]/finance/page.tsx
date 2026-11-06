import { notFound } from "next/navigation";

import { FinanceView } from "@/components/finance-view";
import { Restricted } from "@/components/restricted";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import {
  getCurrentUser,
  getExpenses,
  getInvoices,
  getProject,
  getProjects,
  getWorkspace,
  getMyRole,
} from "@/lib/data";

export default async function ProjectFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const [project, me, role] = await Promise.all([
    getProject(ws.id, id),
    getCurrentUser(ws.id),
    getMyRole(ws.id),
  ]);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "finance")) notFound();
  // Founders see every product's Finance; a product's owner sees their own.
  const canView = canSeeConfidential(role) || project.ownerId === me.id;
  if (!canView) return <Restricted label="Finance" />;

  const [invoices, expenses, projects] = await Promise.all([
    getInvoices(ws.id, id),
    getExpenses(ws.id, id),
    getProjects(ws.id),
  ]);

  return (
    <FinanceView
      heading={`${project.name} · Finance`}
      scopeProjectId={id}
      projects={projects}
      initialInvoices={invoices}
      initialExpenses={expenses}
      defaultCurrency={project.pricingModel?.currency ?? "INR"}
    />
  );
}
