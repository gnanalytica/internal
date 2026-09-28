import { useLocalSearchParams } from "expo-router";

import { ProjectTasks } from "@/features/projects/project-tasks";

/** Every task in the project (an operation's whole task list). */
export default function ProjectTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectTasks projectId={id} title="Tasks" emptyTitle="No open tasks" emptyBody="Add one with the + button." />;
}
