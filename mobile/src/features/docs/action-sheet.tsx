import { View } from "react-native";

import { Divider, Icon, Row, Sheet, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme";

export type SheetAction = { label: string; icon: IconName; onPress: () => void; destructive?: boolean };

/** A menu of actions in a bottom sheet — Android's Alert shows at most three buttons. */
export function ActionSheet({ visible, onClose, title, actions }: { visible: boolean; onClose: () => void; title: string; actions: SheetAction[] }) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {actions.map((a, i) => (
        <View key={a.label}>
          {i > 0 ? <Divider inset={52} /> : null}
          <Row
            leading={<Icon name={a.icon} color={a.destructive ? c.destructive : c.mutedForeground} />}
            title={
              <Text weight="500" tone={a.destructive ? "danger" : "default"}>
                {a.label}
              </Text>
            }
            onPress={() => {
              onClose();
              // Let the sheet finish closing before a follow-up dialog or modal opens.
              setTimeout(a.onPress, 250);
            }}
          />
        </View>
      ))}
    </Sheet>
  );
}
