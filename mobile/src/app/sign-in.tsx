import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function SignIn() {
  const { state, signIn } = useAuth();
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const error = state.status === "signedOut" ? state.error : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 80, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, justifyContent: "space-between" }}>
      <View style={{ gap: space.lg }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.xl, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" }}>
          <Text variant="heading" style={{ color: c.brandForeground }}>
            i
          </Text>
        </View>
        <Text variant="display">Internal</Text>
        <Text tone="muted">Tasks, projects, docs and prospects — the whole workspace, on your phone.</Text>
      </View>
      <View style={{ gap: space.md }}>
        {error ? (
          <View style={{ backgroundColor: c.dangerTint, borderRadius: radius.md, padding: space.md }}>
            <Text tone="danger">{error}</Text>
          </View>
        ) : null}
        <Button
          title="Sign in"
          variant="brand"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signIn();
            } finally {
              setBusy(false);
            }
          }}
        />
        <Text variant="small" tone="muted" style={{ textAlign: "center" }}>
          Opens the Internal sign-in in your browser. Google, GitHub and email all work.
        </Text>
      </View>
    </View>
  );
}
