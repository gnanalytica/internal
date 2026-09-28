import { useState } from "react";
import { Pressable, View } from "react-native";

import { IconButton, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query";
import { useTheme } from "@/theme";

export const REACTION_EMOJI = ["👍", "❤️", "🎉", "😄", "🚀", "👀", "✅"];

type Reaction = { emoji: string; count: number; mine: boolean };

export async function toggleReaction(issueId: string, commentId: string, emoji: string): Promise<void> {
  await api.post(`/comments/${commentId}/reactions`, { emoji });
  await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
}

/** Reaction chips under a comment; tap one to toggle it, or the smile to add another. */
export function Reactions({ issueId, commentId, reactions }: { issueId: string; commentId: string; reactions: Reaction[] }) {
  const { c, radius } = useTheme();
  const [picking, setPicking] = useState(false);
  const react = (emoji: string) => {
    setPicking(false);
    void toggleReaction(issueId, commentId, emoji);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {reactions.map((r) => (
          <Pressable
            key={r.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ", you reacted" : ""}`}
            onPress={() => react(r.emoji)}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: r.mine ? c.brand : c.border, backgroundColor: r.mine ? c.brandTint : "transparent" }}
          >
            <Text>{r.emoji}</Text>
            <Text variant="caption" mono weight="600" style={{ color: r.mine ? c.brand : c.mutedForeground }}>
              {r.count}
            </Text>
          </Pressable>
        ))}
        <IconButton icon="smile" size={16} label="Add reaction" color={c.mutedForeground} onPress={() => setPicking((p) => !p)} />
      </View>
      {picking ? (
        <View style={{ flexDirection: "row", gap: 4, alignSelf: "flex-start", padding: 4, borderRadius: radius.full, backgroundColor: c.muted }}>
          {REACTION_EMOJI.map((e) => (
            <Pressable key={e} accessibilityRole="button" accessibilityLabel={`React ${e}`} onPress={() => react(e)} style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 20 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
