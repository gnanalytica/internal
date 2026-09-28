import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Fab, Segmented } from "@/components/ui";
import type { IssueFilters } from "@/features/issues/api";
import { IssueList } from "@/features/issues/issue-list";
import { useTheme } from "@/theme";

import { projectQuery } from "./api";

/**
 * A project's tasks, open or all, with a button to add one to the project.
 * `type` narrows to one department's lens (engineering, product).
 */
export function ProjectTasks({ projectId, type, title, emptyTitle, emptyBody }: { projectId: string; type?: string; title: string; emptyTitle: string; emptyBody: string }) {
  const { space } = useTheme();
  const project = useQuery(projectQuery(projectId)).data;
  const [view, setView] = useState<"open" | "all">("open");
  const filters: IssueFilters = type ? { project: projectId, type } : { project: projectId };
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: project ? `${project.name} · ${title}` : title }} />
      <IssueList
        filters={filters}
        hideDone={view === "open"}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        header={
          <View style={{ padding: space.lg, paddingBottom: space.sm }}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "open", label: "Open" },
                { value: "all", label: "All" },
              ]}
            />
          </View>
        }
      />
      <Fab label="New task" onPress={() => router.push({ pathname: "/issues/new", params: { project: projectId } })} />
    </View>
  );
}
