import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { DepartmentTasks } from "@/features/business/department-tasks";
import { DeptScaffold } from "@/features/business/scaffold";
import { Tickets } from "@/features/business/support/tickets";

type Segment = "tickets" | "tasks";

/** A project's Customer Success department: the support queue and onboarding/support tasks. */
export default function CustomerSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [segment, setSegment] = useState<Segment>("tickets");
  return (
    <DeptScaffold
      title="Customer Success"
      projectId={id}
      value={segment}
      onChange={setSegment}
      segments={[
        { value: "tickets", label: "Tickets" },
        { value: "tasks", label: "Tasks" },
      ]}
    >
      {segment === "tickets" ? <Tickets projectId={id} /> : <DepartmentTasks projectId={id} department="customer-success" emptyTitle="No onboarding or support tasks yet" />}
    </DeptScaffold>
  );
}
