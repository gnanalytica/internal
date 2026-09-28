import { useQuery } from "@tanstack/react-query";
import { addDays, nextMonday } from "date-fns";
import { useState } from "react";
import { View } from "react-native";

import { Avatar, Button, Icon, Input, Picker, PriorityIcon, Row, Sheet, StatusIcon } from "@/components/ui";
import { ISSUE_TYPES, PRIORITIES, STATUSES } from "@/lib/constants";
import { isoDay, shortDate } from "@/lib/format";
import { labelsQuery, membersQuery, projectsQuery } from "@/features/workspace/api";
import { useTheme } from "@/theme";

type Base<T> = { visible: boolean; onClose: () => void; value: T; onPick: (v: T) => void };

export function StatusPicker(p: Base<string>) {
  return <Picker {...p} title="Status" options={STATUSES.map((s) => ({ value: s.id, label: s.label, leading: <StatusIcon status={s.id} /> }))} />;
}

export function PriorityPicker(p: Base<string>) {
  return <Picker {...p} title="Priority" options={PRIORITIES.map((s) => ({ value: s.id, label: s.label, leading: <PriorityIcon priority={s.id} /> }))} />;
}

export function TypePicker(p: Base<string>) {
  return <Picker {...p} title="Type" options={ISSUE_TYPES.map((t) => ({ value: t.id, label: t.label, leading: <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color }} /> }))} />;
}

export function ProjectPicker(p: Base<string | null>) {
  const projects = useQuery(projectsQuery).data ?? [];
  return (
    <Picker
      visible={p.visible}
      onClose={p.onClose}
      title="Project"
      value={p.value ?? "__none"}
      options={[{ value: "__none", label: "No project" }, ...projects.map((x) => ({ value: x.id, label: x.name, subtitle: x.key }))]}
      onPick={(v) => p.onPick(v === "__none" ? null : v)}
    />
  );
}

/** Pick any number of people; the first is the primary assignee, as on the web. */
export function AssigneesPicker({ visible, onClose, value, onPick }: Base<string[]>) {
  const { c } = useTheme();
  const members = useQuery(membersQuery).data ?? [];
  return (
    <Sheet visible={visible} onClose={onClose} title="Assignees">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <Row
            key={m.id}
            title={m.name}
            subtitle={m.title ?? m.email}
            leading={<Avatar name={m.name} seed={m.id} />}
            trailing={on ? <Icon name="check" color={c.brand} /> : null}
            onPress={() => onPick(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
          />
        );
      })}
    </Sheet>
  );
}

export function LabelsPicker({ visible, onClose, value, onPick }: Base<string[]>) {
  const { c } = useTheme();
  const labels = useQuery(labelsQuery).data ?? [];
  return (
    <Sheet visible={visible} onClose={onClose} title="Labels">
      {labels.map((l) => {
        const on = value.includes(l.id);
        return (
          <Row
            key={l.id}
            title={l.name}
            leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />}
            trailing={on ? <Icon name="check" color={c.brand} /> : null}
            onPress={() => onPick(on ? value.filter((x) => x !== l.id) : [...value, l.id])}
          />
        );
      })}
    </Sheet>
  );
}

/** Quick choices plus a typed date — no native date dialog needed. */
export function DatePicker({ visible, onClose, value, onPick, title = "Date" }: Base<string | null> & { title?: string }) {
  const { space } = useTheme();
  const [typed, setTyped] = useState(value ?? "");
  const today = new Date();
  const choices: [string, Date][] = [
    ["Today", today],
    ["Tomorrow", addDays(today, 1)],
    ["Next Monday", nextMonday(today)],
    ["In a week", addDays(today, 7)],
    ["In two weeks", addDays(today, 14)],
  ];
  const pick = (v: string | null) => {
    onPick(v);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {choices.map(([label, d]) => (
        <Row key={label} title={label} trailing={<Icon name="calendar" size={16} />} subtitle={shortDate(d)} onPress={() => pick(isoDay(d))} />
      ))}
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Input label="Or type a date" placeholder="yyyy-mm-dd" value={typed} onChangeText={setTyped} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button title="Set" variant="primary" style={{ flex: 1 }} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(typed)} onPress={() => pick(typed)} />
          {value ? <Button title="Clear" style={{ flex: 1 }} onPress={() => pick(null)} /> : null}
        </View>
      </View>
    </Sheet>
  );
}

export function NumberPicker({ visible, onClose, value, onPick, title }: Base<number | null> & { title: string }) {
  const { space } = useTheme();
  const [typed, setTyped] = useState(value?.toString() ?? "");
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {[1, 2, 3, 5, 8].map((n) => (
            <Button key={n} title={String(n)} variant={value === n ? "primary" : "secondary"} onPress={() => { onPick(n); onClose(); }} />
          ))}
        </View>
        <Input label="Or type a number" value={typed} onChangeText={setTyped} keyboardType="number-pad" />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button title="Set" variant="primary" style={{ flex: 1 }} disabled={!/^\d+$/.test(typed)} onPress={() => { onPick(Number(typed)); onClose(); }} />
          {value !== null ? <Button title="Clear" style={{ flex: 1 }} onPress={() => { onPick(null); onClose(); }} /> : null}
        </View>
      </View>
    </Sheet>
  );
}
