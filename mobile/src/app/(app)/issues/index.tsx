import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Fab, Picker, Segmented } from "@/components/ui";
import { IssueList } from "@/features/issues/issue-list";
import { projectsQuery } from "@/features/workspace/api";
import { useTheme } from "@/theme";

/** "Tasks" — every issue in the workspace, or one project's with ?project=. */
export default function Tasks() {
  const { space } = useTheme();
  const params = useLocalSearchParams<{ project?: string }>();
  const projects = useQuery(projectsQuery).data ?? [];
  const [project, setProject] = useState<string | null>(params.project ?? null);
  const [view, setView] = useState<"open" | "all">("open");
  const [picking, setPicking] = useState(false);
  const current = projects.find((p) => p.id === project);
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: current ? current.name : "Tasks" }} />
      <IssueList
        filters={project ? { project } : {}}
        hideDone={view === "open"}
        header={
          <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
            <Segmented
              value={view === "open" ? (project ? "project" : "open") : "all"}
              onChange={(v) => (v === "project" ? setPicking(true) : setView(v as "open" | "all"))}
              options={[
                { value: "open", label: "Open" },
                { value: "all", label: "All" },
                { value: "project", label: current ? current.key : "Project…" },
              ]}
            />
          </View>
        }
      />
      <Picker
        visible={picking}
        onClose={() => setPicking(false)}
        title="Project"
        value={project ?? "__all"}
        options={[{ value: "__all", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name, subtitle: p.key }))]}
        onPick={(v) => setProject(v === "__all" ? null : v)}
      />
      <Fab label="New issue" onPress={() => router.push({ pathname: "/issues/new", params: project ? { project } : {} })} />
    </View>
  );
}
