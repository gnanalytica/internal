// Design tokens ported from the web app's src/app/globals.css (OKLCH converted
// to hex so StyleSheet can use them). Keep in step with the web: neutral
// greys, one indigo brand colour, Geist-like system type.
import { useColorScheme } from "react-native";

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  brand: string;
  brandForeground: string;
  brandTint: string;
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  dangerTint: string;
  overlay: string;
};

export const light: Palette = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f5f5f5",
  secondaryForeground: "#171717",
  muted: "#f4f5f6",
  mutedForeground: "#6e7279",
  accent: "#f2f3f6",
  accentForeground: "#171717",
  destructive: "#e7000b",
  destructiveForeground: "#fafafa",
  border: "#e4e5e8",
  input: "#e4e5e8",
  brand: "#5b60d7",
  brandForeground: "#fafafa",
  brandTint: "#eef0fc",
  success: "#5e9b51",
  successTint: "#ecf5e9",
  warning: "#b7791f",
  warningTint: "#fdf6e3",
  dangerTint: "#fdecec",
  overlay: "rgba(10,10,10,0.45)",
};

export const dark: Palette = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  card: "#171717",
  cardForeground: "#fafafa",
  primary: "#e5e5e5",
  primaryForeground: "#171717",
  secondary: "#262626",
  secondaryForeground: "#fafafa",
  muted: "#262626",
  mutedForeground: "#a1a1a1",
  accent: "#262626",
  accentForeground: "#fafafa",
  destructive: "#ff6467",
  destructiveForeground: "#fafafa",
  border: "rgba(255,255,255,0.10)",
  input: "rgba(255,255,255,0.15)",
  brand: "#6f77ea",
  brandForeground: "#fafafa",
  brandTint: "#1e2040",
  success: "#7bbf6c",
  successTint: "#1c2b19",
  warning: "#e0b25a",
  warningTint: "#2e2512",
  dangerTint: "#3a1717",
  overlay: "rgba(0,0,0,0.6)",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 6, md: 8, lg: 10, xl: 14, full: 999 } as const;
export const type = {
  caption: { fontSize: 11, lineHeight: 14 },
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 21 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: "600" as const },
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
} as const;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { c: isDark ? dark : light, isDark, space, radius, type };
}

export type Theme = ReturnType<typeof useTheme>;
