import * as Linking from "expo-linking";
import { Fragment, type ReactNode } from "react";
import { Text as RNText, View } from "react-native";

import { useTheme } from "@/theme";

/**
 * Renders the Markdown the API serves for issue descriptions, pages and
 * comments: headings, lists, task lists, quotes, code, rules, and inline
 * bold / italic / code / strikethrough / links. Anything richer (embeds,
 * coloured blocks) arrives as plain text, which is the honest fallback.
 */
export function Markdown({ source, compact }: { source: string | null | undefined; compact?: boolean }) {
  const { c, type, radius } = useTheme();
  const text = (source ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;
  const body = { ...type.body, color: c.foreground };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <View key={key++} style={{ backgroundColor: c.muted, borderRadius: radius.md, padding: 10 }}>
          <RNText style={{ fontFamily: "monospace", fontSize: 13, color: c.foreground }}>{code.join("\n")}</RNText>
        </View>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const style = level === 1 ? type.heading : level === 2 ? { fontSize: 19, lineHeight: 25, fontWeight: "600" as const } : type.title;
      blocks.push(
        <RNText key={key++} style={[style, { color: c.foreground, marginTop: compact ? 0 : 6 }]}>
          {inline(h[2], c.brand)}
        </RNText>,
      );
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<View key={key++} style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <View key={key++} style={{ borderLeftWidth: 3, borderLeftColor: c.border, paddingLeft: 10 }}>
          <RNText style={[body, { color: c.mutedForeground }]}>{inline(quote.join(" "), c.brand)}</RNText>
        </View>,
      );
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?(.*)$/)!;
        const depth = Math.min(3, Math.floor(m[1].length / 2));
        const task = m[3] !== undefined;
        const done = task && m[4]?.toLowerCase() === "x";
        const marker = task ? (done ? "☑" : "☐") : /\d/.test(m[2]) ? m[2] : "•";
        items.push(
          <View key={items.length} style={{ flexDirection: "row", gap: 8, paddingLeft: depth * 16 }}>
            <RNText style={[body, { color: c.mutedForeground, minWidth: 14 }]}>{marker}</RNText>
            <RNText style={[body, { flex: 1, textDecorationLine: done ? "line-through" : "none", color: done ? c.mutedForeground : c.foreground }]}>{inline(m[5], c.brand)}</RNText>
          </View>,
        );
        i++;
      }
      blocks.push(
        <View key={key++} style={{ gap: 4 }}>
          {items}
        </View>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <RNText key={key++} style={body}>
        {inline(para.join("\n"), c.brand)}
      </RNText>,
    );
  }
  return <View style={{ gap: compact ? 6 : 10 }}>{blocks}</View>;
}

/** Inline marks: **bold**, *italic*, `code`, ~~strike~~, [text](url), bare urls. */
function inline(src: string, linkColor: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(<Fragment key={k++}>{src.slice(last, m.index)}</Fragment>);
    const t = m[0];
    if (t.startsWith("**") || t.startsWith("__")) out.push(<RNText key={k++} style={{ fontWeight: "700" }}>{t.slice(2, -2)}</RNText>);
    else if (t.startsWith("`")) out.push(<RNText key={k++} style={{ fontFamily: "monospace", fontSize: 13 }}>{t.slice(1, -1)}</RNText>);
    else if (t.startsWith("~~")) out.push(<RNText key={k++} style={{ textDecorationLine: "line-through" }}>{t.slice(2, -2)}</RNText>);
    else if (t.startsWith("[")) {
      const lm = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      out.push(<RNText key={k++} style={{ color: linkColor }} onPress={() => void Linking.openURL(lm[2])}>{lm[1]}</RNText>);
    } else if (t.startsWith("http")) out.push(<RNText key={k++} style={{ color: linkColor }} onPress={() => void Linking.openURL(t)}>{t}</RNText>);
    else out.push(<RNText key={k++} style={{ fontStyle: "italic" }}>{t.slice(1, -1)}</RNText>);
    last = m.index + t.length;
  }
  if (last < src.length) out.push(<Fragment key={k++}>{src.slice(last)}</Fragment>);
  return out;
}
