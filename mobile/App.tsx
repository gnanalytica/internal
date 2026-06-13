import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

const APP_URL: string =
  (Constants.expoConfig?.extra?.appUrl as string) ??
  "https://internal.gnanalytica.com";

const BRAND = "#5e6ad2";

// A desktop-ish Chrome UA helps some embedded auth flows render correctly.
const USER_AGENT =
  Platform.OS === "android"
    ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    : undefined;

export default function App() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState(false);
  const canGoBack = useRef(false);

  // Android hardware back button navigates the web history first.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNav = useCallback((nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
  }, []);

  const reload = useCallback(() => {
    setError(false);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {!error && (
          <WebView
            ref={webRef}
            source={{ uri: APP_URL }}
            userAgent={USER_AGENT}
            originWhitelist={["https://*", "http://*"]}
            // Keep the session: cookies + storage across launches.
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
            // UX
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            decelerationRate="normal"
            startInLoadingState={false}
            onNavigationStateChange={onNav}
            onLoadEnd={() => {
              setLoading(false);
              setFirstLoadDone(true);
            }}
            onError={() => setError(true)}
            onHttpError={(e) => {
              // Treat hard server failures as errors; ignore sub-resource 4xx.
              if (e.nativeEvent.statusCode >= 500) setError(true);
            }}
            style={styles.web}
          />
        )}

        {/* Branded launch screen until the first paint is ready. */}
        {!firstLoadDone && !error && (
          <View style={styles.splash}>
            <View style={styles.logoBox}>
              <Text style={styles.logoMark}>i</Text>
            </View>
            <Text style={styles.wordmark}>internal</Text>
            <ActivityIndicator color="#ffffff" style={{ marginTop: 24 }} />
          </View>
        )}

        {/* Subtle top loading bar on subsequent navigations. */}
        {loading && firstLoadDone && (
          <View style={styles.loadingBar}>
            <ActivityIndicator color={BRAND} />
          </View>
        )}

        {/* Offline / error state. */}
        {error && (
          <View style={styles.errorView}>
            <Text style={styles.errorTitle}>Can&apos;t reach Internal</Text>
            <Text style={styles.errorBody}>
              Check your connection and try again.
            </Text>
            <Pressable style={styles.retry} onPress={reload}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  web: { flex: 1, backgroundColor: "#ffffff" },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMark: { color: "#ffffff", fontSize: 40, fontWeight: "800" },
  wordmark: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    letterSpacing: 0.5,
  },
  loadingBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  errorView: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#ffffff",
  },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  errorBody: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  retry: {
    marginTop: 20,
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
