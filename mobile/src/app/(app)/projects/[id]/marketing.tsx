import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { DepartmentTasks } from "@/features/business/department-tasks";
import { Campaigns } from "@/features/business/marketing/campaigns";
import { ContentCalendar } from "@/features/business/marketing/content";
import { DeptScaffold } from "@/features/business/scaffold";

type Segment = "campaigns" | "content" | "tasks";

/** A project's Marketing department: campaigns, the content calendar and marketing tasks. */
export default function MarketingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [segment, setSegment] = useState<Segment>("campaigns");
  return (
    <DeptScaffold
      title="Marketing"
      projectId={id}
      value={segment}
      onChange={setSegment}
      segments={[
        { value: "campaigns", label: "Campaigns" },
        { value: "content", label: "Content" },
        { value: "tasks", label: "Tasks" },
      ]}
    >
      {segment === "campaigns" ? <Campaigns projectId={id} /> : null}
      {segment === "content" ? <ContentCalendar projectId={id} /> : null}
      {segment === "tasks" ? <DepartmentTasks projectId={id} department="marketing" emptyTitle="No marketing tasks yet" /> : null}
    </DeptScaffold>
  );
}
