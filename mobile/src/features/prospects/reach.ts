import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";

import type { Channel } from "./model";

/**
 * Open the dialer, WhatsApp or the mail app, and — for a call or a WhatsApp —
 * hand the channel back once the member returns to the app, so the screen can
 * ask them to log what happened while it is fresh.
 */
export function useReach(onReturn: (channel: Channel) => void) {
  const pending = useRef<{ channel: Channel; left: boolean } | null>(null);
  const handler = useRef(onReturn);
  useEffect(() => {
    handler.current = onReturn;
  }, [onReturn]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const p = pending.current;
      if (!p) return;
      if (state === "background") p.left = true;
      else if (state === "active" && p.left) {
        pending.current = null;
        // Let the app finish coming back before a sheet slides up over it.
        setTimeout(() => handler.current(p.channel), 350);
      }
    });
    return () => sub.remove();
  }, []);

  return useCallback(async (href: string | null, channel: Channel | null) => {
    if (!href) return;
    pending.current = channel === "Call" || channel === "WhatsApp" ? { channel, left: false } : null;
    try {
      await Linking.openURL(href);
    } catch {
      pending.current = null;
      Alert.alert("Couldn't open that", channel === "WhatsApp" ? "Is WhatsApp installed on this phone?" : "No app on this phone can open it.");
    }
  }, []);
}
