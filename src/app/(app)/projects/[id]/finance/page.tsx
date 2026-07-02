import { notFound } from "next/navigation";

import { EconomicsCard } from "@/components/economics-card";
import { FinanceView } from "@/components/finance-view";
import { Restricted } from "@/components/restricted";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
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
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "finance")) notFound();
  // Founders see every product's Finance; a product's owner sees their own.
  const me = await getCurrentUser(ws.id);
  const canView = canSeeConfidential(await getMyRole(ws.id)) || project.ownerId === me.id;
  if (!canView) return <Restricted label="Finance" />;

  const [invoices, expenses, accounts, projects] = await Promise.all([
    getInvoices(ws.id, id),
    getExpenses(ws.id, id),
    getAccounts(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <FinanceView
      heading={`${project.name} · Finance`}
      scopeProjectId={id}
      projects={projects}
      accounts={accounts}
      initialInvoices={invoices}
      initialExpenses={expenses}
      defaultCurrency={project.economics?.currency ?? "INR"}
      intro={<EconomicsCard projectId={id} economics={project.economics} />}
    />
  );
}
