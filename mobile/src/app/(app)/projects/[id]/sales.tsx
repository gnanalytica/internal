import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { ErrorView, Loading } from "@/components/ui";
import { DepartmentTasks } from "@/features/business/department-tasks";
import { Pipeline } from "@/features/business/sales/pipeline";
import { DeptScaffold } from "@/features/business/scaffold";
import { Restricted } from "@/features/business/ui";
import { projectQuery } from "@/features/projects/api";
import { isDepartmentEnabled, PROSPECTS_PRODUCT_KEY } from "@/features/projects/departments";
import { ProspectsWorkspace } from "@/features/prospects/workspace";

type Segment = "tasks" | "pipeline";

/**
 * A project's Sales, as on the web. For Valytica that is its prospects — the
 * sheet the team works every day — with Insights, Prospects, Customers (when
 * Customer Success is on) and Deals, plus Your day. Other products get their
 * sales tasks and the deal pipeline.
 *
 * Who may open it is the server's one department rule: Sales is in the
 * project's `visibleDepartments` for everyone the web's tab shows it to.
 */
export default function SalesScreen() {
  const { id, tab, cf, layout } = useLocalSearchParams<{ id: string; tab?: string; cf?: string; layout?: string }>();
  const q = useQuery(projectQuery(id));
  const [segment, setSegment] = useState<Segment>("tasks");

  if (q.isPending || q.isError)
    return <DeptScaffold title="Sales" projectId={id}>{q.isPending ? <Loading /> : <ErrorView error={q.error} onRetry={() => void q.refetch()} />}</DeptScaffold>;

  const p = q.data;
  if (!p.visibleDepartments.some((d) => d.slug === "sales"))
    return (
      <DeptScaffold title="Sales" projectId={id}>
        {isDepartmentEnabled(p.enabledDepartments, "sales") ? (
          <Restricted title="Sales isn't open to you" body="Ask an admin if you need something from this project's pipeline." />
        ) : (
          <Restricted icon="trending-up" title="Sales isn't turned on for this project" body="An admin can turn the Sales department on in the project's settings on the web." />
        )}
      </DeptScaffold>
    );

  if (p.key === PROSPECTS_PRODUCT_KEY)
    return (
      <DeptScaffold title="Sales" projectId={id}>
        <ProspectsWorkspace
          project={{ id, customers: isDepartmentEnabled(p.enabledDepartments, "customer-success") }}
          initialTab={tab}
          initialLayout={layout}
          initialCustomers={cf === "requests" ? "requests" : undefined}
        />
      </DeptScaffold>
    );

  return (
    <DeptScaffold
      title="Sales"
      projectId={id}
      value={segment}
      onChange={setSegment}
      segments={[
        { value: "tasks", label: "Tasks" },
        { value: "pipeline", label: "Pipeline" },
      ]}
    >
      {segment === "tasks" ? <DepartmentTasks projectId={id} department="sales" emptyTitle="No sales tasks yet" /> : <Pipeline projectId={id} />}
    </DeptScaffold>
  );
}
