import { notFound } from "next/navigation";

import { FinanceView } from "@/components/finance-view";
import { isDepartmentEnabled } from "@/lib/departments";
import {
  getAccounts,
  getExpenses,
  getInvoices,
  getProject,
  getProjects,
  getWorkspace,
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
    />
  );
}
