import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Badge, Button, Card, Divider, ErrorView, Input, Loading, Section, Sheet, Text } from "@/components/ui";
import { useTheme } from "@/theme";

import { createMetric, updateMetric } from "./api";
import { Chips, SheetActions } from "./components";
import { formatScore, parseCell, scorecardQuery, setScorecardValue, weekLabel, type Scorecard as ScorecardData, type ScorecardRow, type ScoreStatus } from "./scorecard-api";

/** Blue for on track, orange for behind, grey for no number yet — never red and green, as on the web. */
const STATUS: Record<ScoreStatus, { label: string; tone: "brand" | "warning" | "neutral" }> = {
  on: { label: "On track", tone: "brand" },
  behind: { label: "Behind", tone: "warning" },
  empty: { label: "No number yet", tone: "neutral" },
  untargeted: { label: "Trend only", tone: "neutral" },
};

/**
 * The weekly scorecard — the web's first project tab (ScorecardSection) on a
 * phone. Rows are grouped by area; each shows this week against its target, a
 * status, and the last five weeks as small bars. Numbers the app counts (from
 * Prospects, deals, the content calendar, tasks) are read-only; the rest are
 * typed in: tap this week's number to enter it. Tap a name to change its target.
 */
export function Scorecard({ projectId }: { projectId: string }) {
  const { space } = useTheme();
  const q = useQuery(scorecardQuery(projectId));
  const [adding, setAdding] = useState(false);
  const [entering, setEntering] = useState<ScorecardRow | null>(null);
  const [editing, setEditing] = useState<ScorecardRow | null>(null);

  const enterFirst = (d: ScorecardData) => {
    const typed = d.rows.filter((r) => r.editable);
    if (!typed.length) return Alert.alert("Nothing to type in", "The app counts every number here. Add a metric to type one in.");
    setEntering(typed.find((r) => r.now === null) ?? typed[0]);
  };

  return (
    <Section
      title="Scorecard"
      action={
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Button size="sm" variant="ghost" icon="plus" title="Metric" onPress={() => setAdding(true)} />
          {q.data?.rows.length ? <Button size="sm" variant="brand" title="Enter this week" onPress={() => enterFirst(q.data)} /> : null}
        </View>
      }
    >
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.rows.length ? (
        <View style={{ gap: space.md }}>
          <Summary summary={q.data.summary} />
          <Text variant="caption" tone="muted">
            Weeks start Monday · this week is {weekLabel(q.data.thisWeek)} · tap a highlighted number to type it in
          </Text>
          {q.data.areas.map((a) => {
            const rows = q.data.rows.filter((r) => r.area === a.id);
            return (
              <View key={a.id} style={{ gap: 6 }}>
                <Text variant="small" weight="600">
                  {a.label}{" "}
                  <Text variant="small" tone="muted">
                    · {rows.every((r) => r.editable) ? "you type these in" : a.from}
                  </Text>
                </Text>
                <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
                  {rows.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 ? <Divider inset={space.md} /> : null}
                      <ScoreRow row={r} onEnter={() => setEntering(r)} onEdit={() => setEditing(r)} />
                    </View>
                  ))}
                </Card>
              </View>
            );
          })}
          {q.data.notes.length ? (
            <View style={{ gap: 4 }}>
              {q.data.notes.map((n) => (
                <Text key={n} variant="caption" tone="muted">
                  {n}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Card style={{ alignItems: "flex-start" }}>
          <Text weight="600">No metrics on the scorecard yet</Text>
          <Text tone="muted">{"Add the numbers this product steers by. The suggested set, with the ones the app counts itself, is one tap on the web's Scorecard tab."}</Text>
          <Button size="sm" title="Add a metric" icon="plus" variant="brand" onPress={() => setAdding(true)} />
        </Card>
      )}
      <NewMetricSheet visible={adding} onClose={() => setAdding(false)} projectId={projectId} />
      {q.data ? <EnterSheet key={entering?.id ?? "none"} row={entering} scorecard={q.data} projectId={projectId} onClose={() => setEntering(null)} onNext={setEntering} /> : null}
      <TargetSheet key={`t-${editing?.id ?? "none"}`} row={editing} onClose={() => setEditing(null)} projectId={projectId} />
    </Section>
  );
}

function Summary({ summary }: { summary: ScorecardData["summary"] }) {
  const { c } = useTheme();
  const items = [
    { label: "On track", value: summary.on, dot: c.brand },
    { label: "Behind", value: summary.behind, dot: c.warning },
    { label: "Waiting", value: summary.waiting, dot: c.mutedForeground },
    { label: "Metrics", value: summary.total, dot: c.foreground },
  ];
  return (
    <Card style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 0, gap: 0 }}>
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, alignItems: "center", gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
          <Text variant="heading" mono>
            {it.value}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: it.dot }} />
            <Text variant="caption" tone="muted">
              {it.label}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function ScoreRow({ row: r, onEnter, onEdit }: { row: ScorecardRow; onEnter: () => void; onEdit: () => void }) {
  const { c, space, radius } = useTheme();
  const s = STATUS[r.status];
  const target = r.target === null ? "No target" : `Target ${r.targetLabel}`;
  const value = (
    <Text mono weight="600" style={{ color: r.editable ? c.brand : c.foreground }}>
      {r.editable && r.now === null ? "Enter" : formatScore(r.now)}
    </Text>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, paddingVertical: 10 }}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityHint="Change this metric's target" style={{ flex: 1, gap: 4 }}>
        <Text weight="500" numberOfLines={2}>
          {r.name}
          {r.unit ? (
            <Text variant="caption" tone="muted">
              {"  "}
              {r.unit}
            </Text>
          ) : null}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge label={s.label} tone={s.tone} dot={r.status !== "untargeted"} />
          <Text variant="caption" tone="muted" mono>
            {target}
          </Text>
        </View>
      </Pressable>
      <Trend values={r.values} target={r.target} status={r.status} />
      {r.editable ? (
        <Pressable
          onPress={onEnter}
          accessibilityRole="button"
          accessibilityLabel={`${r.name}, this week: ${r.now === null ? "no number yet" : formatScore(r.now)}. Tap to type it in.`}
          style={({ pressed }) => ({ minWidth: 64, alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, backgroundColor: pressed ? c.brand + "33" : c.brandTint, borderWidth: 1, borderColor: c.brand + "4d" })}
        >
          {value}
        </Pressable>
      ) : (
        <View accessibilityLabel={`${r.name}, this week: ${formatScore(r.now)}. Counted by the app.`} style={{ minWidth: 64, alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, backgroundColor: c.muted, borderWidth: 1, borderColor: c.border }}>
          {value}
        </View>
      )}
    </View>
  );
}

/** Five small bars, oldest first, scaled to the larger of the target and the biggest number (web: Trend). */
function Trend({ values, target, status }: { values: (number | null)[]; target: number | null; status: ScoreStatus }) {
  const { c } = useTheme();
  const max = Math.max(1, target ?? 0, ...values.map((v) => v ?? 0));
  const bar = status === "on" ? c.brand : status === "behind" ? c.warning : c.mutedForeground;
  return (
    <View accessibilityLabel={`Last ${values.length} weeks: ${values.map(formatScore).join(", ")}`} style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20 }}>
      {values.map((v, i) => (
        <View key={i} style={{ width: 5, borderRadius: 2, height: v === null ? 2 : Math.max(3, Math.round((Math.max(0, v) / max) * 20)), backgroundColor: v === null ? c.border : bar }} />
      ))}
    </View>
  );
}

/** This week's number for a typed-in row. Save moves on to the next row still waiting for its number. */
function EnterSheet({ row, scorecard, projectId, onClose, onNext }: { row: ScorecardRow | null; scorecard: ScorecardData; projectId: string; onClose: () => void; onNext: (r: ScorecardRow | null) => void }) {
  const { space } = useTheme();
  const [text, setText] = useState(row?.now == null ? "" : String(row.now));
  const [saving, setSaving] = useState(false);
  const parsed = parseCell(text);
  const typed = scorecard.rows.filter((r) => r.editable);
  const next = row ? typed.slice(typed.findIndex((r) => r.id === row.id) + 1).find((r) => r.now === null) ?? null : null;

  const save = async (value: number | null) => {
    if (!row) return;
    setSaving(true);
    try {
      if (value !== row.now) await setScorecardValue(projectId, row, scorecard.thisWeek, value);
      onNext(next);
    } catch (e) {
      Alert.alert(`Couldn't save ${row.name}`, (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={!!row} onClose={onClose} title={row ? row.name : "This week"}>
      {row ? (
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          <View style={{ flexDirection: "row", gap: space.md, flexWrap: "wrap" }}>
            {scorecard.weeks.slice(0, -1).map((w, i) => (
              <View key={w} style={{ gap: 2 }}>
                <Text variant="caption" tone="muted">
                  {weekLabel(w)}
                </Text>
                <Text mono>{formatScore(row.values[i] ?? null)}</Text>
              </View>
            ))}
            <View style={{ gap: 2 }}>
              <Text variant="caption" tone="muted">
                Target
              </Text>
              <Text mono>{row.targetLabel}</Text>
            </View>
          </View>
          <Input
            label={`Week of ${weekLabel(scorecard.thisWeek)}${row.unit ? ` (${row.unit})` : ""}`}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="—"
            autoFocus
            hint={parsed === undefined ? `“${text}” isn't a number.` : "Leave it empty to clear this week's number."}
            onSubmitEditing={() => parsed !== undefined && void save(parsed)}
          />
          <SheetActions onCancel={onClose} onSave={() => parsed !== undefined && void save(parsed)} saveLabel={next ? "Save and next" : "Save"} saving={saving} disabled={parsed === undefined} />
        </View>
      ) : null}
    </Sheet>
  );
}

const DIRECTIONS = [
  { id: "above", label: "At least" },
  { id: "below", label: "At most" },
] as const;

function NewMetricSheet({ visible, onClose, projectId }: { visible: boolean; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [saving, setSaving] = useState(false);
  const targetOk = !target.trim() || Number.isFinite(Number(target));
  const save = async () => {
    setSaving(true);
    try {
      // Weekly and typed in, as the web's "Add metric" makes them; its group and source are set on the web.
      await createMetric({ projectId, name: name.trim(), unit: unit.trim() || null, cadence: "weekly", target: target.trim() ? Number(target) : null, targetDirection: direction });
      setName("");
      setUnit("");
      setTarget("");
      onClose();
    } catch (e) {
      Alert.alert("Couldn't add the metric", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New metric">
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        <Input label="Name" placeholder="e.g. Weekly active valuers" value={name} onChangeText={setName} autoFocus />
        <Input label="Unit" placeholder="e.g. per week, %, ₹ (optional)" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        <Chips value={direction} onChange={setDirection} options={DIRECTIONS} />
        <Input label="Target" placeholder="Optional" value={target} onChangeText={setTarget} keyboardType="decimal-pad" hint={targetOk ? "You type its number in each week. It goes under Product." : "Enter a number."} />
        <SheetActions onCancel={onClose} onSave={() => void save()} saveLabel="Add metric" saving={saving} disabled={!name.trim() || !targetOk} />
      </View>
    </Sheet>
  );
}

function TargetSheet({ row, onClose, projectId }: { row: ScorecardRow | null; onClose: () => void; projectId: string }) {
  const { space } = useTheme();
  const [target, setTarget] = useState(row?.target != null ? String(row.target) : "");
  const [direction, setDirection] = useState<"above" | "below">(row?.targetDirection ?? "above");
  const ok = !target.trim() || Number.isFinite(Number(target));
  return (
    <Sheet visible={!!row} onClose={onClose} title={row ? row.name : "Target"}>
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        {row?.how ? (
          <Text variant="small" tone="muted">
            Counted by the app: {row.how.charAt(0).toLowerCase() + row.how.slice(1)}
          </Text>
        ) : null}
        <Chips value={direction} onChange={setDirection} options={DIRECTIONS} />
        <Input label={row?.unit ? `Target (${row.unit})` : "Target"} placeholder="Leave empty to just track the trend" value={target} onChangeText={setTarget} keyboardType="decimal-pad" hint={ok ? undefined : "Enter a number."} />
        <SheetActions
          onCancel={onClose}
          disabled={!ok}
          onSave={() => {
            if (row) void updateMetric(row.id, projectId, { target: target.trim() ? Number(target) : null, targetDirection: direction }).catch((e: Error) => Alert.alert("Couldn't save", e.message));
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
