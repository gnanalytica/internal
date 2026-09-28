import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SectionList, View } from "react-native";

import { Divider, Empty, ErrorView, Loading, Segmented, StatusIcon, Text } from "@/components/ui";
import { issuesQuery, type Issue } from "@/features/issues/api";
import { IssueRow } from "@/features/issues/issue-row";
import { STATUSES } from "@/lib/constants";
import { useTheme } from "@/theme";

import { DEPARTMENT_LABELS, type BusinessDepartment } from "./constants";

/**
 * A department's tasks: the project's issues carrying that department's labels,
 * top-level only — the same scoping as the web's DepartmentTasks. The issues
 * API has no label filter, so this pages through the project's issues (shared
 * cache with every other issue list) and filters here.
 */
export function DepartmentTasks({ projectId, department, emptyTitle }: { projectId: string; department: BusinessDepartment; emptyTitle: string }) {
  const { c, space } = useTheme();
  const q = useInfiniteQuery(issuesQuery({ project: projectId }));
  const [view, setView] = useState<"open" | "all">("open");

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const labels: readonly string[] = DEPARTMENT_LABELS[department];
  const sections = useMemo(() => {
    const mine: Issue[] = (q.data?.pages.flatMap((p) => p.data) ?? []).filter((i) => !i.parentId && i.labels.some((l) => labels.includes(l.name)));
    return STATUSES.filter((s) => view === "all" || (s.id !== "done" && s.id !== "canceled"))
      .map((s) => ({ key: s.id, title: s.label, data: mine.filter((i) => i.status === s.id) }))
      .filter((s) => s.data.length > 0);
  }, [q.data, labels, view]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <SectionList
      sections={sections}
      keyExtractor={(i) => i.id}
      stickySectionHeadersEnabled
      refreshing={q.isRefetching && !q.isFetchingNextPage}
      onRefresh={() => void q.refetch()}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
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
      ItemSeparatorComponent={() => <Divider inset={48} />}
      ListEmptyComponent={
        hasNextPage ? (
          <Loading />
        ) : (
          <Empty icon="check-circle" title={emptyTitle} body={`Tasks in this project labelled ${labels.join(", ")} show here.`} />
        )
      }
      ListFooterComponent={<View style={{ height: 96 }} />}
      renderSectionHeader={({ section }) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: space.lg, paddingVertical: 8, backgroundColor: c.muted }}>
          <StatusIcon status={section.key} size={14} />
          <Text variant="small" weight="600">
            {section.title}
          </Text>
          <Text variant="small" tone="muted">
            {section.data.length}
          </Text>
        </View>
      )}
      renderItem={({ item }) => <IssueRow issue={item} />}
    />
  );
}
