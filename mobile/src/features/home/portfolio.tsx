import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Badge, Button, Card, Divider, Icon, Input, Row, Section, Sheet, StatusIcon, Text } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

import { HEALTH, saveBets, type Favorite, type Health, type PortfolioRow } from "./api";

/** Starred issues, docs and projects, one tap away. */
export function FavoritesList({ items }: { items: Favorite[] }) {
  const { c } = useTheme();
  const open = (f: Favorite) => router.push(f.type === "issue" ? `/issues/${f.id}` : f.type === "page" ? `/pages/${f.id}` : `/projects/${f.id}`);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {items.map((f, i) => (
        <View key={`${f.type}-${f.id}`}>
          {i > 0 ? <Divider inset={48} /> : null}
          <Row
            onPress={() => open(f)}
            leading={
              f.type === "issue" ? (
                <StatusIcon status={f.status} />
              ) : f.type === "project" ? (
                <View style={{ width: 16, alignItems: "center" }}>
                  <Dot color={f.color} />
                </View>
              ) : (
                <Text style={{ width: 16, textAlign: "center" }}>{f.icon || "📄"}</Text>
              )
            }
            title={f.title || "Untitled"}
            subtitle={f.type === "issue" ? f.identifier : f.type === "page" ? "Doc" : "Project"}
            trailing={<Icon name="star" size={14} color={c.warning} />}
          />
        </View>
      ))}
    </Card>
  );
}

export function HealthBadge({ health }: { health: Health }) {
  const h = HEALTH[health];
  return <Badge label={h.label} tone={h.tone} dot={health !== "none"} />;
}

function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** "Focus this quarter": read-only chips for members, editable by admins. */
export function BetsSection({ bets, isAdmin }: { bets: string[]; isAdmin: boolean }) {
  const { c, space, radius } = useTheme();
  const [editing, setEditing] = useState(false);
  if (!isAdmin && bets.length === 0) return null;
  return (
    <Section title="Focus this quarter" action={isAdmin ? <Button title={bets.length ? "Edit" : "Set bets"} size="sm" variant="ghost" icon="edit-2" onPress={() => setEditing(true)} /> : null}>
      {bets.length ? (
        <View style={{ gap: space.sm }}>
          {bets.map((b, i) => (
            <View key={`${i}-${b}`} style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10 }}>
              <Icon name="target" size={16} color={c.brand} />
              <Text style={{ flex: 1 }}>{b}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text tone="muted">No bets set. Name up to three things the company is betting on this quarter.</Text>
      )}
      {isAdmin ? <BetsEditor key={editing ? "open" : "closed"} visible={editing} onClose={() => setEditing(false)} bets={bets} /> : null}
    </Section>
  );
}

function BetsEditor({ visible, onClose, bets }: { visible: boolean; onClose: () => void; bets: string[] }) {
  const { space } = useTheme();
  const [vals, setVals] = useState<string[]>(() => [bets[0] ?? "", bets[1] ?? "", bets[2] ?? ""]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await saveBets(vals);
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save the bets", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Focus this quarter">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        {vals.map((v, i) => (
          <Input key={i} label={`Bet ${i + 1}`} value={v} placeholder="e.g. Ship the mobile app" onChangeText={(t) => setVals((p) => p.map((x, j) => (j === i ? t : x)))} maxLength={200} />
        ))}
        <Text variant="small" tone="muted">
          Everyone in the workspace sees these on Home. Leave a line blank to remove it.
        </Text>
        <Button title="Save" variant="brand" loading={saving} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

/** A project on the Overview: health, current milestone, progress, owner. */
export function ProjectCard({ row }: { row: PortfolioRow }) {
  const { c, space, radius } = useTheme();
  return (
    <Card onPress={() => router.push(`/projects/${row.id}`)} style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Dot color={row.color} />
        <Text weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
          {row.name}
        </Text>
        <Text variant="caption" tone="muted" mono>
          {row.key}
        </Text>
        <View style={{ flex: 1 }} />
        <HealthBadge health={row.health} />
      </View>
      {row.tagline ? (
        <Text variant="small" tone="muted" numberOfLines={2}>
          {row.tagline}
        </Text>
      ) : null}
      {row.url ? (
        <Text variant="small" tone="brand" weight="500" onPress={() => void Linking.openURL(row.url!)} numberOfLines={1}>
          {row.url.replace(/^https?:\/\//, "")} ↗
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="flag" size={14} color={c.brand} />
        {row.milestoneName ? (
          <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {row.milestoneName}
            {row.milestoneTarget ? <Text variant="small" tone="muted">{` · ${shortDate(row.milestoneTarget)}`}</Text> : null}
          </Text>
        ) : (
          <Text variant="small" tone="muted" style={{ fontStyle: "italic" }}>
            No milestone set
          </Text>
        )}
      </View>
      <View style={{ gap: 4 }}>
        <View accessibilityLabel={`${row.progress}% done`} style={{ height: 6, borderRadius: radius.full, backgroundColor: c.muted, overflow: "hidden" }}>
          <View style={{ height: 6, width: `${row.progress}%`, backgroundColor: c.brand, borderRadius: radius.full }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="caption" tone="muted">
            {row.ownerName ?? "Unassigned"}
          </Text>
          <Text variant="caption" tone="muted" mono>
            {row.totalIssues > 0 ? `${row.doneIssues}/${row.totalIssues} · ${row.progress}%` : "No tasks"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** Operations (Finance, People & HR, …): a compact list with owner and health. */
export function OperationsList({ rows }: { rows: PortfolioRow[] }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {rows.map((o, i) => (
        <View key={o.id}>
          {i > 0 ? <Divider inset={40} /> : null}
          <Row
            onPress={() => router.push(`/projects/${o.id}`)}
            leading={<Dot color={o.color} />}
            title={o.name}
            subtitle={`${o.key} · ${o.ownerName ?? "No owner"}`}
            trailing={<HealthBadge health={o.health} />}
          />
        </View>
      ))}
    </Card>
  );
}
