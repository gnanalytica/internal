import { Stack } from "expo-router";

import { useTheme } from "@/theme";

/** Every screen outside the tab bar is pushed on this stack, with a themed header. */
export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
