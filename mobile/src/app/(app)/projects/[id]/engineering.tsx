import { useQuery } from "@tanstack/react-query";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { Segmented } from "@/components/ui";
import { projectQuery } from "@/features/projects/api";
import { CyclesView } from "@/features/projects/cycles-view";
import { hasEngineering } from "@/features/projects/departments";
import { ProjectTasks } from "@/features/projects/project-tasks";

type Tab = "tasks" | "cycles";

/**
 * A project's Engineering: the build tasks and the project's cycles (Tasks |
 * Cycles), as on the web. Cycles used to be a project entry of its own;
 * `?tab=cycles` opens on them.
 */
export default function ProjectEngineeringScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const project = useQuery(projectQuery(id)).data;
  const [tab, setTab] = useState<Tab>(initialTab === "cycles" ? "cycles" : "tasks");

  // A project without Engineering still has cycles: they keep their own screen there.
  if (tab === "cycles" && project && !hasEngineering(project)) return <Redirect href={{ pathname: "/projects/[id]/cycles", params: { id } }} />;

  const tabs = (
    <Segmented<Tab>
      value={tab}
      onChange={setTab}
      options={[
        { value: "tasks", label: "Tasks" },
        { value: "cycles", label: "Cycles" },
      ]}
    />
  );
  if (tab === "cycles")
    return (
      <>
        <Stack.Screen options={{ title: project ? `${project.name} · Engineering` : "Engineering" }} />
        <CyclesView projectId={id} header={tabs} />
      </>
    );
  return <ProjectTasks projectId={id} type="engineering" title="Engineering" emptyTitle="No open engineering tasks" emptyBody="Tasks of type Engineering in this project show here." tabs={tabs} />;
}
