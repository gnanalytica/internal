import { Alert, Linking, View } from "react-native";

import { Button, IconButton } from "@/components/ui";
import { useTheme } from "@/theme";

import { telUrl, whatsappNumber } from "./constants";

const open = (url: string, what: string) =>
  Linking.openURL(url).catch(() => Alert.alert(`Couldn't open ${what}`, "Check that an app for it is installed on this phone."));

/** Call, WhatsApp and email a person, from whatever details we hold for them. */
export function ContactActions({ phone, email, compact }: { phone?: string | null; email?: string | null; compact?: boolean }) {
  const { c, space } = useTheme();
  const wa = whatsappNumber(phone);
  if (!phone && !email) return null;
  if (compact)
    return (
      <View style={{ flexDirection: "row" }}>
        {phone ? <IconButton icon="phone" label="Call" color={c.brand} size={18} onPress={() => void open(telUrl(phone), "the dialer")} /> : null}
        {wa ? <IconButton icon="message-circle" label="WhatsApp" color="#22c55e" size={18} onPress={() => void open(`https://wa.me/${wa}`, "WhatsApp")} /> : null}
        {email ? <IconButton icon="mail" label="Email" color={c.mutedForeground} size={18} onPress={() => void open(`mailto:${email}`, "email")} /> : null}
      </View>
    );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {phone ? <Button size="sm" icon="phone" title="Call" onPress={() => void open(telUrl(phone), "the dialer")} /> : null}
      {wa ? <Button size="sm" icon="message-circle" title="WhatsApp" onPress={() => void open(`https://wa.me/${wa}`, "WhatsApp")} /> : null}
      {email ? <Button size="sm" icon="mail" title="Email" onPress={() => void open(`mailto:${email}`, "email")} /> : null}
    </View>
  );
}
