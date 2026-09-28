import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, Switch, View } from "react-native";

import { Badge, Button, Card, Divider, Empty, ErrorView, Icon, Input, Loading, Row, Screen, Section, Sheet, Text } from "@/components/ui";
import { apiKeysQuery, createApiKey, deleteWebhook, integrationsQuery, revokeApiKey, setWebhookActive, webhooksQuery, type ApiKey, type Webhook } from "@/features/settings/api";
import { useMe } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { ago } from "@/lib/format";
import { useTheme } from "@/theme";

/** Integrations (admins): API keys, webhooks, and GitHub / Slack status. */
export default function IntegrationsScreen() {
  const me = useMe();
  const keys = useQuery({ ...apiKeysQuery, enabled: me.isAdmin });
  const hooks = useQuery({ ...webhooksQuery, enabled: me.isAdmin });
  const integrations = useQuery({ ...integrationsQuery, enabled: me.isAdmin });
  const [creating, setCreating] = useState(false);

  if (!me.isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Integrations" }} />
        <Empty icon="lock" title="Admins only" body="API keys, webhooks and connected apps are managed by workspace admins." />
      </Screen>
    );
  }

  const refreshing = keys.isRefetching || hooks.isRefetching || integrations.isRefetching;
  return (
    <Screen refreshing={refreshing} onRefresh={() => void Promise.all([keys.refetch(), hooks.refetch(), integrations.refetch()])}>
      <Stack.Screen options={{ title: "Integrations" }} />

      <Section title="Connected apps">
        {integrations.isPending ? (
          <Loading />
        ) : integrations.isError ? (
          <ErrorView error={integrations.error} onRetry={() => void integrations.refetch()} />
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <ConnectionRow icon="github" name="GitHub" connected={integrations.data.github.connected} detail={integrations.data.github.connected ? (integrations.data.github.repo ?? "Connected") : "Push issues to a repository"} path="/settings/github" />
            <Divider inset={52} />
            <ConnectionRow icon="slack" name="Slack" connected={integrations.data.slack.connected} detail={integrations.data.slack.connected ? "Posting to a channel" : "Post workspace events to a channel"} path="/settings/slack" />
          </Card>
        )}
        <Text variant="small" tone="muted">
          Connecting and disconnecting needs a token or webhook URL, so it happens on the web. Tap an app to open its settings there.
        </Text>
      </Section>

      <Section title="API keys" action={<Button title="New key" size="sm" variant="ghost" icon="plus" onPress={() => setCreating(true)} />}>
        {keys.isPending ? <Loading /> : keys.isError ? <ErrorView error={keys.error} onRetry={() => void keys.refetch()} /> : <KeysList keys={keys.data} />}
      </Section>

      <Section title="Webhooks">
        {hooks.isPending ? <Loading /> : hooks.isError ? <ErrorView error={hooks.error} onRetry={() => void hooks.refetch()} /> : <WebhookList hooks={hooks.data} />}
        <Text variant="small" tone="muted">
          Add webhooks on the web in Settings → API, where the signing secret is shown once.
        </Text>
      </Section>

      {creating ? <NewKeySheet onClose={() => setCreating(false)} /> : null}
    </Screen>
  );
}

function ConnectionRow({ icon, name, connected, detail, path }: { icon: "github" | "slack"; name: string; connected: boolean; detail: string; path: string }) {
  const { c } = useTheme();
  return (
    <Row
      leading={<Icon name={icon} color={c.mutedForeground} />}
      title={name}
      subtitle={detail}
      trailing={<Badge label={connected ? "Connected" : "Not connected"} tone={connected ? "success" : "neutral"} dot={connected} />}
      onPress={() => void Linking.openURL(`${API_URL}${path}`)}
    />
  );
}

function KeysList({ keys }: { keys: ApiKey[] }) {
  const { c } = useTheme();
  const integration = keys.filter((k) => k.kind !== "app");
  const phones = keys.filter((k) => k.kind === "app");

  const revoke = (k: ApiKey) => {
    const isPhone = k.kind === "app";
    Alert.alert(
      k.current ? "Sign this phone out?" : isPhone ? `Sign out ${k.createdBy?.name ?? "this phone"}?` : `Revoke "${k.name}"?`,
      k.current ? "This is the key this app is using. You'll be signed out straight away." : isPhone ? "That phone loses access at once and has to sign in again." : "Anything using this key stops working at once. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isPhone ? "Sign out" : "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeApiKey(k.id);
            } catch (e) {
              Alert.alert("Couldn't revoke the key", (e as Error).message);
            }
          },
        },
      ],
    );
  };

  const row = (k: ApiKey, i: number) => (
    <View key={k.id}>
      {i > 0 ? <Divider inset={52} /> : null}
      <Row
        leading={<Icon name={k.kind === "app" ? "smartphone" : "key"} color={c.mutedForeground} />}
        title={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text weight="500" numberOfLines={1} style={{ flexShrink: 1 }}>
              {k.kind === "app" ? (k.createdBy?.name ?? "Former member") : k.name}
            </Text>
            {k.current ? <Badge label="This phone" tone="brand" /> : null}
          </View>
        }
        subtitle={
          <Text variant="small" tone="muted" numberOfLines={1}>
            <Text variant="small" tone="muted" mono>
              {k.prefix}…
            </Text>
            {` · ${k.lastUsedAt ? `used ${ago(k.lastUsedAt)} ago` : "never used"}${k.kind !== "app" && k.createdBy?.name ? ` · by ${k.createdBy.name}` : ""}`}
          </Text>
        }
        trailing={<Button title={k.kind === "app" ? "Sign out" : "Revoke"} size="sm" variant="danger" onPress={() => revoke(k)} />}
      />
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      {integration.length ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>{integration.map(row)}</Card>
      ) : (
        <Card>
          <Text tone="muted">No integration keys. Create one to let a script or another tool use the API as the workspace.</Text>
        </Card>
      )}
      {phones.length ? (
        <>
          <Text variant="small" tone="muted" weight="600">
            Mobile sign-ins · {phones.length}
          </Text>
          <Card style={{ padding: 0, overflow: "hidden" }}>{phones.map(row)}</Card>
        </>
      ) : null}
    </View>
  );
}

function WebhookList({ hooks }: { hooks: Webhook[] }) {
  const { c } = useTheme();
  if (!hooks.length)
    return (
      <Card>
        <Text tone="muted">No webhooks. They send issue and page events to another system as they happen.</Text>
      </Card>
    );

  const toggle = (w: Webhook, active: boolean) => void setWebhookActive(w.id, active).catch((e: Error) => Alert.alert("Couldn't update the webhook", e.message));
  const remove = (w: Webhook) =>
    Alert.alert("Delete this webhook?", `${w.url}\n\nIt stops receiving events and its secret is discarded.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteWebhook(w.id).catch((e: Error) => Alert.alert("Couldn't delete the webhook", e.message)) },
    ]);

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {hooks.map((w, i) => {
        const failing = w.lastStatus !== null && (w.lastStatus < 200 || w.lastStatus >= 300);
        return (
          <View key={w.id}>
            {i > 0 ? <Divider inset={16} /> : null}
            <Row
              onLongPress={() => remove(w)}
              title={
                <Text weight="500" numberOfLines={1} style={{ color: w.active ? c.foreground : c.mutedForeground }}>
                  {w.url.replace(/^https?:\/\//, "")}
                </Text>
              }
              subtitle={
                <Text variant="small" tone={failing ? "danger" : "muted"} numberOfLines={1}>
                  {`${w.events.includes("*") ? "All events" : `${w.events.length} event${w.events.length === 1 ? "" : "s"}`} · ${
                    w.lastDeliveryAt ? `last ${w.lastStatus ?? "sent"} ${ago(w.lastDeliveryAt)} ago` : "nothing sent yet"
                  }${w.active ? "" : " · paused"}`}
                </Text>
              }
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Switch value={w.active} onValueChange={(v) => toggle(w, v)} trackColor={{ true: c.brand, false: c.border }} thumbColor="#fff" accessibilityLabel={w.active ? "Pause webhook" : "Resume webhook"} />
                  <Button title="Delete" size="sm" variant="ghost" icon="trash-2" onPress={() => remove(w)} />
                </View>
              }
            />
          </View>
        );
      })}
    </Card>
  );
}

function NewKeySheet({ onClose }: { onClose: () => void }) {
  const { c, space, radius } = useTheme();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await createApiKey(name.trim());
      setCreated({ key: res.key, name: res.name });
    } catch (e) {
      Alert.alert("Couldn't create the key", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (created && !copied) {
      Alert.alert("Close without copying?", "The key won't be shown again. You'd have to revoke it and make a new one.", [
        { text: "Keep open", style: "cancel" },
        { text: "Close", style: "destructive", onPress: onClose },
      ]);
    } else onClose();
  };

  return (
    <Sheet visible onClose={close} title={created ? "Copy your key" : "New API key"}>
      <View style={{ padding: space.lg, paddingTop: 0, gap: space.md }}>
        {created ? (
          <>
            <Text tone="muted">This is the only time “{created.name}” is shown in full. Store it somewhere safe — it acts with admin access to the workspace.</Text>
            <View style={{ backgroundColor: c.muted, borderRadius: radius.md, padding: space.md }}>
              <Text mono selectable>
                {created.key}
              </Text>
            </View>
            <Button
              title={copied ? "Copied" : "Copy key"}
              icon={copied ? "check" : "copy"}
              variant="brand"
              onPress={async () => {
                await Clipboard.setStringAsync(created.key);
                setCopied(true);
              }}
            />
            <Button title="Done" onPress={close} />
          </>
        ) : (
          <>
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Zapier, deploy script" autoFocus maxLength={60} hint="So you can tell keys apart later." />
            <Button title="Create key" variant="brand" loading={busy} onPress={() => void create()} />
          </>
        )}
      </View>
    </Sheet>
  );
}
