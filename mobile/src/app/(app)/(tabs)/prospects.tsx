import { useQuery } from "@tanstack/react-query";

import { projectQuery } from "@/features/projects/api";
import { isDepartmentEnabled, PROSPECTS_PRODUCT_KEY } from "@/features/projects/departments";
import { ProspectsWorkspace } from "@/features/prospects/workspace";
import { projectsQuery } from "@/features/workspace/api";

/**
 * The sales team's calling tool — the same workspace as Valytica's project
 * Sales (the web's bottom bar opens that page too): Insights, Prospects,
 * Customers and Deals, with Your day and the Playbook, read from and written to
 * the prospects sheet. Without Valytica it is the prospects on their own.
 */
export default function Prospects() {
  const val = useQuery(projectsQuery).data?.find((p) => p.key === PROSPECTS_PRODUCT_KEY);
  const detail = useQuery({ ...projectQuery(val?.id ?? ""), enabled: !!val }).data;
  const project = val && detail?.visibleDepartments.some((d) => d.slug === "sales") ? { id: val.id, customers: isDepartmentEnabled(detail.enabledDepartments, "customer-success") } : undefined;
  return <ProspectsWorkspace project={project} />;
}
