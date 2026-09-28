import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";

import { unreadCountQuery } from "@/features/inbox/api";
import { useTheme } from "@/theme";

/** The same five places as the web's mobile bottom bar: Home, Inbox, My issues, Prospects, More. */
export default function TabsLayout() {
  const { c } = useTheme();
  const unread = useQuery(unreadCountQuery).data ?? 0;
  const icon = (name: React.ComponentProps<typeof Feather>["name"]) =>
    function TabIcon({ color }: { color: import("react-native").ColorValue }) {
      return <Feather name={name} size={21} color={color} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarIcon: icon("inbox"), tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined, tabBarBadgeStyle: { backgroundColor: c.brand, fontSize: 10 } }} />
      <Tabs.Screen name="my-issues" options={{ title: "My issues", tabBarIcon: icon("check-circle") }} />
      <Tabs.Screen name="prospects" options={{ title: "Prospects", tabBarIcon: icon("phone-call") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: icon("menu") }} />
    </Tabs>
  );
}
