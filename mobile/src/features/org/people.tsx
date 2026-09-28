import * as Linking from "expo-linking";
import { View } from "react-native";

import { Avatar, Badge, Button, Card, Divider, Field, Sheet, Text } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/theme";

export type PersonDetail = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  title: string | null;
  entity: string | null;
  employment?: string;
  startDate?: string | null;
  manager?: { id: string; name: string | null } | null;
  positions: string[];
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A person's card: title, where they sit, the positions they hold, and a way to reach them. */
export function PersonSheet({ person, onClose }: { person: PersonDetail | null; onClose: () => void }) {
  const { space } = useTheme();
  return (
    <Sheet visible={!!person} onClose={onClose} title={person?.name ?? ""}>
      {person ? (
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Avatar name={person.name} seed={person.id} size={48} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="title">{person.name}</Text>
              <Text tone="muted">{person.title ?? "No title set"}</Text>
            </View>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            <Field label="Email">
              <Text numberOfLines={1} style={{ flex: 1 }}>
                {person.email}
              </Text>
            </Field>
            <Divider />
            <Field label="Access">
              <Badge label={person.role === "admin" ? "Admin" : "Member"} tone={person.role === "admin" ? "brand" : "neutral"} />
            </Field>
            {person.entity ? (
              <>
                <Divider />
                <Field label="Entity">
                  <Text>{person.entity}</Text>
                </Field>
              </>
            ) : null}
            {person.employment ? (
              <>
                <Divider />
                <Field label="Employment">
                  <Text>{cap(person.employment)}</Text>
                </Field>
              </>
            ) : null}
            {person.startDate ? (
              <>
                <Divider />
                <Field label="Started">
                  <Text>{shortDate(person.startDate)}</Text>
                </Field>
              </>
            ) : null}
            {person.manager ? (
              <>
                <Divider />
                <Field label="Manager">
                  <Text>{person.manager.name ?? "Former member"}</Text>
                </Field>
              </>
            ) : null}
            <Divider />
            <Field label="Positions">
              <Text tone={person.positions.length ? "default" : "muted"} style={{ flex: 1 }}>
                {person.positions.length ? person.positions.join(", ") : "None on the chart"}
              </Text>
            </Field>
          </Card>
          <Button title={`Email ${person.name.split(" ")[0]}`} icon="mail" onPress={() => void Linking.openURL(`mailto:${person.email}`)} />
        </View>
      ) : null}
    </Sheet>
  );
}
