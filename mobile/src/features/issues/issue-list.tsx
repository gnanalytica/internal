import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactElement } from "react";
import { SectionList, View } from "react-native";

import { Divider, Empty, ErrorView, Loading, StatusIcon, Text } from "@/components/ui";
import { STATUSES } from "@/lib/constants";
import { useTheme } from "@/theme";

import { issuesQuery, type Issue, type IssueFilters } from "./api";
import { IssueRow } from "./issue-row";

/** Issues come 100 to a page, newest first; grouping by status needs them all, or a group's count is only what has loaded. */
const MAX_PAGES = 10;

/** Issues grouped by status (the web's list view). */
export function IssueList({ filters, header, emptyTitle = "No issues here", emptyBody, hideDone }: { filters: IssueFilters; header?: ReactElement; emptyTitle?: string; emptyBody?: string; hideDone?: boolean }) {
  const { c, space } = useTheme();
  const q = useInfiniteQuery(issuesQuery(filters));
  const pages = q.data?.pages.length ?? 0;
  useEffect(() => {
    if (q.hasNextPage && !q.isFetchingNextPage && !q.isError && pages < MAX_PAGES) void q.fetchNextPage();
  }, [q, pages]);
  const sections = useMemo(() => {
    const all: Issue[] = q.data?.pages.flatMap((p) => p.data) ?? [];
    return STATUSES.filter((s) => !(hideDone && (s.id === "done" || s.id === "canceled")))
      .map((s) => ({ key: s.id, title: s.label, data: all.filter((i) => i.status === s.id) }))
      .filter((s) => s.data.length > 0);
  }, [q.data, hideDone]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <SectionList
      sections={sections}
      keyExtractor={(i) => i.id}
      stickySectionHeadersEnabled
      refreshing={q.isRefetching && !q.isFetchingNextPage}
      onRefresh={() => void q.refetch()}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <Divider inset={48} />}
      ListEmptyComponent={<Empty icon="check-circle" title={emptyTitle} body={emptyBody} />}
      ListFooterComponent={q.isFetchingNextPage ? <Loading /> : <View style={{ height: 96 }} />}
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
