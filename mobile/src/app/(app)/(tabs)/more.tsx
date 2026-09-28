import { router, type Href } from "expo-router";
import { Alert, View } from "react-native";

import { Avatar, Card, Divider, Icon, Row, Screen, Section, Text, type IconName } from "@/components/ui";
import { useAuth, useMe } from "@/lib/auth";
import { useTheme } from "@/theme";

type Item = { label: string; icon: IconName; href: Href; adminOnly?: boolean };

/** Everything in the web sidebar that isn't a tab, in the web's order. */
const WORK: Item[] = [
  { label: "Tasks", icon: "list", href: "/issues" },
  { label: "Projects", icon: "folder", href: "/projects" },
  { label: "Docs", icon: "file-text", href: "/pages" },
  { label: "Databases", icon: "grid", href: "/databases" },
  { label: "Org", icon: "users", href: "/org" },
  { label: "Ask AI", icon: "message-circle", href: "/ask" },
  { label: "Search", icon: "search", href: "/search" },
  { label: "Trash", icon: "trash-2", href: "/trash" },
];
const SETTINGS: Item[] = [
  { label: "Account", icon: "user", href: "/settings" },
  { label: "Labels", icon: "tag", href: "/settings/labels" },
  { label: "Integrations", icon: "link", href: "/settings/integrations", adminOnly: true },
];

export default function More() {
  const me = useMe();
  const { signOut } = useAuth();
  const { c } = useTheme();
  const list = (items: Item[]) => (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {items
        .filter((i) => !i.adminOnly || me.isAdmin)
        .map((i, n) => (
          <View key={i.label}>
            {n > 0 ? <Divider inset={52} /> : null}
            <Row title={i.label} leading={<Icon name={i.icon} color={c.mutedForeground} />} chevron onPress={() => router.push(i.href)} />
          </View>
        ))}
    </Card>
  );
  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={me.actor?.name} seed={me.actor?.id} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="title">{me.actor?.name ?? "Signed in"}</Text>
            <Text variant="small" tone="muted">
              {me.actor?.email}
              {me.workspace ? ` · ${me.workspace.name}` : ""}
            </Text>
          </View>
        </View>
      </Card>
      <Section title="Workspace">{list(WORK)}</Section>
      <Section title="Settings">{list(SETTINGS)}</Section>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row
          title={<Text tone="danger" weight="600">Sign out</Text>}
          leading={<Icon name="log-out" color={c.destructive} />}
          onPress={() =>
            Alert.alert("Sign out?", "You'll need to sign in again to use the app on this phone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void signOut() },
            ])
          }
        />
      </Card>
      <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
        To switch workspace, sign out and pick another when you sign in.
      </Text>
    </Screen>
  );
}
