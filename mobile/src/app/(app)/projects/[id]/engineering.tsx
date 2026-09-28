import { useLocalSearchParams } from "expo-router";

import { ProjectTasks } from "@/features/projects/project-tasks";

/** The project's engineering tasks. */
export default function ProjectEngineeringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectTasks projectId={id} type="engineering" title="Engineering" emptyTitle="No open engineering tasks" emptyBody="Tasks of type Engineering in this project show here." />;
}
