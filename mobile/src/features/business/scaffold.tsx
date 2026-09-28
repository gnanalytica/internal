import { Stack } from "expo-router";
import { type ReactNode } from "react";
import { View } from "react-native";

import { Segmented } from "@/components/ui";
import { useTheme } from "@/theme";

import { HeaderTitle, useProject } from "./ui";

/**
 * A department screen: the department and project in the header, a segment
 * switcher pinned under it, and the chosen segment filling the rest.
 */
export function DeptScaffold<T extends string>({
  title,
  projectId,
  segments,
  value,
  onChange,
  children,
  headerRight,
}: {
  title: string;
  projectId: string;
  segments?: { value: T; label: string }[];
  value?: T;
  onChange?: (v: T) => void;
  children: ReactNode;
  headerRight?: () => ReactNode;
}) {
  const { c, space } = useTheme();
  const project = useProject(projectId);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title, headerTitle: () => <HeaderTitle title={title} project={project?.name} />, headerRight }} />
      {segments && value && onChange ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md }}>
          <Segmented value={value} onChange={onChange} options={segments} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
