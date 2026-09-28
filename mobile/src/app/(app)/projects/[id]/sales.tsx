import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { DepartmentTasks } from "@/features/business/department-tasks";
import { Accounts } from "@/features/business/sales/accounts";
import { Contacts } from "@/features/business/sales/contacts";
import { Pipeline } from "@/features/business/sales/pipeline";
import { DeptScaffold } from "@/features/business/scaffold";
import { Restricted } from "@/features/business/ui";
import { useMe } from "@/lib/auth";

type Segment = "pipeline" | "accounts" | "contacts" | "tasks";

/** A project's Sales department: its pipeline, the workspace's accounts and contacts, and sales tasks. Admins only, as on the web. */
export default function SalesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [segment, setSegment] = useState<Segment>("pipeline");

  if (!me.isAdmin)
    return (
      <DeptScaffold title="Sales" projectId={id}>
        <Restricted title="Sales is for workspace admins" body="Deals, accounts and contacts are only open to admins. Ask an admin if you need something from the pipeline." />
      </DeptScaffold>
    );

  return (
    <DeptScaffold
      title="Sales"
      projectId={id}
      value={segment}
      onChange={setSegment}
      segments={[
        { value: "pipeline", label: "Pipeline" },
        { value: "accounts", label: "Accounts" },
        { value: "contacts", label: "Contacts" },
        { value: "tasks", label: "Tasks" },
      ]}
    >
      {segment === "pipeline" ? <Pipeline projectId={id} /> : null}
      {segment === "accounts" ? <Accounts /> : null}
      {segment === "contacts" ? <Contacts /> : null}
      {segment === "tasks" ? <DepartmentTasks projectId={id} department="sales" emptyTitle="No sales tasks yet" /> : null}
    </DeptScaffold>
  );
}
