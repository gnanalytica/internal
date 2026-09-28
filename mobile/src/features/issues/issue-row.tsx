import { router } from "expo-router";
import { View } from "react-native";

import { Avatar, PriorityIcon, Row, StatusIcon, Text } from "@/components/ui";
import { dueLabel } from "@/lib/format";
import { useTheme } from "@/theme";

import type { Issue } from "./api";

/** One issue in a list: status, identifier, title, due date, assignee — like a Linear row. */
export function IssueRow({ issue }: { issue: Issue }) {
  const { c } = useTheme();
  const due = issue.status !== "done" && issue.status !== "canceled" ? dueLabel(issue.dueDate) : null;
  const who = issue.assignees?.[0] ?? issue.assignee;
  return (
    <Row
      onPress={() => router.push(`/issues/${issue.id}`)}
      leading={<StatusIcon status={issue.status} />}
      title={issue.title}
      subtitle={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PriorityIcon priority={issue.priority} size={13} />
          <Text variant="small" tone="muted" mono>
            {issue.identifier}
          </Text>
          {issue.project ? (
            <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              · {issue.project.name}
            </Text>
          ) : null}
          {due ? (
            <Text variant="small" weight="600" style={{ color: due.late ? c.destructive : c.mutedForeground }}>
              · {due.text}
            </Text>
          ) : null}
        </View>
      }
      trailing={<Avatar name={who?.name} seed={who?.id} size={24} />}
    />
  );
}
