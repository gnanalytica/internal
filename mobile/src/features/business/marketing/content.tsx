import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { Alert, Linking, SectionList, View } from "react-native";

import { Divider, Empty, ErrorView, Fab, IconButton, Loading, Row, Segmented, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { campaignsQuery, contentQuery, createRecord, deleteRecord, patchRecord, type ContentItem } from "../api";
import { CAMPAIGN_CHANNELS, CONTENT_STATUSES, optionOf } from "../constants";
import { FormSheet, type FieldSpec, type FormValues } from "../form-sheet";
import { campaignOptions, useMemberOptions } from "../pick-options";
import { day, GroupHeader, OptionBadge } from "../ui";

/** "Today", "Tomorrow", "Mon 6 Oct" — the heading for one day of the calendar. */
function dayHeading(iso: string): string {
  const d = parseISO(iso);
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "EEE d MMM" : "EEE d MMM yyyy");
}

/** The content calendar: items grouped by publish date, unscheduled ideas last. */
export function ContentCalendar({ projectId }: { projectId: string }) {
  const { space } = useTheme();
  const q = useQuery(contentQuery(projectId));
  const campaigns = useQuery(campaignsQuery(projectId)).data;
  const members = useMemberOptions();
  const [view, setView] = useState<"upcoming" | "all">("upcoming");
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);

  const sections = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const items = (q.data ?? []).filter((i) => view === "all" || !i.publishDate || day(i.publishDate)! >= today || i.status !== "published");
    const byDay = new Map<string, ContentItem[]>();
    const unscheduled: ContentItem[] = [];
    for (const i of items) {
      const d = day(i.publishDate);
      if (!d) unscheduled.push(i);
      else byDay.set(d, [...(byDay.get(d) ?? []), i]);
    }
    const out = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, data]) => ({ key: d, title: dayHeading(d), late: d < today, data }));
    if (unscheduled.length) out.push({ key: "none", title: "Not scheduled", late: false, data: unscheduled });
    return out;
  }, [q.data, view]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  const current = editing && editing !== "new" ? editing : null;
  const fields: FieldSpec[] = [
    { key: "title", label: "Title", kind: "text", required: true, placeholder: "e.g. How a bank reads your valuation" },
    { key: "status", label: "Status", kind: "choice", options: CONTENT_STATUSES },
    { key: "publishDate", label: "Publish on", kind: "date" },
    { key: "channel", label: "Channel", kind: "choice", options: CAMPAIGN_CHANNELS, noneLabel: "No channel" },
    { key: "campaignId", label: "Campaign", kind: "choice", options: campaignOptions(campaigns), noneLabel: "No campaign" },
    { key: "ownerId", label: "Owner", kind: "choice", options: members, noneLabel: "No owner" },
    { key: "url", label: "Link", kind: "text", keyboard: "url", placeholder: "https://" },
    { key: "notes", label: "Notes", kind: "multiline" },
  ];
  const initial: FormValues = current
    ? { title: current.title, status: current.status, publishDate: day(current.publishDate), channel: current.channel, campaignId: current.campaign?.id ?? null, ownerId: current.ownerId, url: current.url, notes: current.notes }
    : { title: "", status: "idea", publishDate: null, channel: null, campaignId: null, ownerId: null, url: null, notes: null };

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "upcoming", label: "Upcoming" },
                { value: "all", label: `All ${q.data?.length ?? 0}` },
              ]}
            />
          </View>
        }
        renderSectionHeader={({ section }) => <GroupHeader label={section.title} count={section.data.length} right={section.late ? <Text variant="small" tone="danger" weight="600">Past due</Text> : null} />}
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        renderItem={({ item }) => (
          <Row
            title={item.title}
            subtitle={[item.channel ? optionOf(CAMPAIGN_CHANNELS, item.channel).label : null, item.campaign?.name].filter(Boolean).join(" · ") || "No channel"}
            trailing={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <OptionBadge list={CONTENT_STATUSES} value={item.status} />
                {item.url ? <IconButton icon="external-link" size={16} label="Open link" onPress={() => void Linking.openURL(item.url!).catch(() => Alert.alert("Couldn't open that link"))} /> : null}
              </View>
            }
            onPress={() => setEditing(item)}
          />
        )}
        ListEmptyComponent={<Empty icon="calendar" title={q.data?.length ? "Nothing coming up" : "The calendar is empty"} body={q.data?.length ? "Switch to All to see published pieces." : "Add a post, article or video with the + button."} />}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <Fab label="New content" onPress={() => setEditing("new")} />
      <FormSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.title : "New content"}
        submitLabel={current ? "Save" : "Create"}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          if (current) {
            const campaign = campaignOptions(campaigns).find((o) => o.value === v.campaignId);
            await patchRecord("content", current.id, v, { campaign: campaign ? { id: campaign.value, name: campaign.label } : null });
          } else await createRecord("content", { ...v, projectId });
        }}
        onDelete={current ? () => deleteRecord("content", current.id) : undefined}
        deleteLabel="Delete content"
      />
    </View>
  );
}
