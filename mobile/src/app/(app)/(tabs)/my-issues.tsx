import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Fab, Segmented } from "@/components/ui";
import { IssueList } from "@/features/issues/issue-list";
import { useTheme } from "@/theme";

export default function MyIssues() {
  const { space } = useTheme();
  const [view, setView] = useState<"open" | "all">("open");
  return (
    <View style={{ flex: 1 }}>
      <IssueList
        filters={{ mine: true }}
        hideDone={view === "open"}
        emptyTitle={view === "open" ? "Nothing on your plate" : "Nothing assigned to you"}
        emptyBody="Issues assigned to you, as owner or co-assignee, show up here."
        header={
          <View style={{ padding: space.lg, paddingBottom: space.sm }}>
            <Segmented value={view} onChange={setView} options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]} />
          </View>
        }
      />
      <Fab label="New issue" onPress={() => router.push("/issues/new")} />
    </View>
  );
}
