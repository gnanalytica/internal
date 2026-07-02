import { notFound } from "next/navigation";

import { EconomicsCard } from "@/components/economics-card";
import { FinanceView } from "@/components/finance-view";
import { Restricted } from "@/components/restricted";
import { canSeeConfidential, isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getExpenses,
  getInvoices,
  getProject,
  getProjects,
  getWorkspace,
  getMyRole,
} from "@/lib/data";

export default async function ProjectEconomicsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  const project = await getProject(ws.id, id);
  if (!project) notFound();
  if (!isDepartmentEnabled(project.enabledDepartments, "economics")) notFound();
  if (!canSeeConfidential(await getMyRole(ws.id))) return <Restricted label="Economics" />;

  const [invoices, expenses, accounts, projects] = await Promise.all([
    getInvoices(ws.id, id),
    getExpenses(ws.id, id),
    getAccounts(ws.id),
    getProjects(ws.id),
  ]);

  return (
    <FinanceView
      heading={`${project.name} · Economics`}
      scopeProjectId={id}
      projects={projects}
      accounts={accounts}
      initialInvoices={invoices}
      initialExpenses={expenses}
      intro={<EconomicsCard projectId={id} economics={project.economics} />}
    />
  );
}
