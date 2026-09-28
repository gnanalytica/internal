import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Avatar, Badge, Button, Card, Divider, Field, Icon, Loading, Row, Screen, Section, Text } from "@/components/ui";
import { signInMethodsQuery } from "@/features/settings/api";
import { useAuth, useMe } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { useTheme } from "@/theme";

/** Account: who you are, where, with what access, how you sign in — and sign out. */
export default function Account() {
  const me = useMe();
  const { signOut, refreshMe } = useAuth();
  const { c } = useTheme();
  const methods = useQuery(signInMethodsQuery);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshMe().catch(() => undefined), methods.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You'll need to sign in again to use the app on this phone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Stack.Screen options={{ title: "Account" }} />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={me.actor?.name} seed={me.actor?.id} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{me.actor?.name ?? "Couldn't load your profile"}</Text>
            <Text tone="muted" numberOfLines={1}>
              {me.actor?.email ?? "Pull down to try again."}
            </Text>
          </View>
        </View>
      </Card>

      <Section title="Workspace">
        <Card style={{ paddingVertical: 4 }}>
          <Field label="Workspace">
            <Text numberOfLines={1} style={{ flex: 1 }}>
              {me.workspace?.name ?? "—"}
            </Text>
          </Field>
          <Divider />
          <Field label="Your role">
            <Badge label={me.isAdmin ? "Admin" : "Member"} tone={me.isAdmin ? "brand" : "neutral"} />
          </Field>
        </Card>
        <Text variant="small" tone="muted">
          {me.isAdmin ? "Admins manage members, integrations and the org chart." : "Ask an admin if you need access to settings or confidential operations."}
        </Text>
      </Section>

      <Section title="Sign-in methods">
        {methods.isPending ? (
          <Loading />
        ) : methods.isError || !methods.data.available ? (
          <Card>
            <Text tone="muted">{methods.isError ? (methods.error as Error).message : "Sign-in methods can't be shown right now."}</Text>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {methods.data.data.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Divider inset={52} /> : null}
                <Row
                  leading={<Icon name={m.id === "github" ? "github" : m.id === "google" ? "globe" : "mail"} color={c.mutedForeground} />}
                  title={m.label}
                  trailing={<Badge label={m.connected ? "Connected" : "Not connected"} tone={m.connected ? "success" : "neutral"} dot={m.connected} />}
                />
              </View>
            ))}
          </Card>
        )}
        <Text variant="small" tone="muted">
          Connect or remove sign-in methods in Settings → Account on the web. Any connected method signs you in to this same account.
        </Text>
        <Button title="Open account settings on the web" icon="external-link" onPress={() => void Linking.openURL(`${API_URL}/settings`)} />
      </Section>

      <Section title="Settings">
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Row title="Labels" leading={<Icon name="tag" color={c.mutedForeground} />} chevron onPress={() => router.push("/settings/labels")} />
          {me.isAdmin ? (
            <>
              <Divider inset={52} />
              <Row title="Integrations" subtitle="API keys, webhooks, GitHub, Slack" leading={<Icon name="link" color={c.mutedForeground} />} chevron onPress={() => router.push("/settings/integrations")} />
            </>
          ) : null}
        </Card>
      </Section>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row title={<Text tone="danger" weight="600">Sign out</Text>} leading={<Icon name="log-out" color={c.destructive} />} onPress={confirmSignOut} />
      </Card>
      <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
        Signing out removes this phone’s access. To switch workspace, sign out and pick another when you sign in.
      </Text>
    </Screen>
  );
}
