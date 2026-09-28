import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, loadToken, saveToken, setUnauthorizedHandler } from "./api";
import { API_URL, OAUTH_CLIENT_ID } from "./config";
import { queryClient } from "./query";

WebBrowser.maybeCompleteAuthSession();

export type Me = {
  workspace: { id: string; name: string; slug: string } | null;
  actor: { id: string; name: string; email: string } | null;
  isAdmin: boolean;
};

type AuthState =
  | { status: "loading" }
  | { status: "signedOut"; error?: string }
  | { status: "signedIn"; me: Me };

type AuthContextValue = {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${API_URL}/oauth/authorize`,
  tokenEndpoint: `${API_URL}/api/oauth/token`,
};

/**
 * Sign-in is the web's own OAuth flow with PKCE: the phone opens the Internal
 * sign-in in a browser tab, the member approves, and the app swaps the code
 * for a key that acts as them. No password or secret is ever held by the app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const clearLocal = useCallback(async (error?: string) => {
    await saveToken(null);
    queryClient.clear();
    setState({ status: "signedOut", error });
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await api.get<Me>("/me");
    setState({ status: "signedIn", me });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clearLocal("Your sign-in ended. Sign in again to continue."));
    (async () => {
      const token = await loadToken();
      if (!token) return setState({ status: "signedOut" });
      try {
        await refreshMe();
      } catch (e) {
        if ((e as { status?: number }).status === 401) return clearLocal();
        // Offline: keep the member signed in; screens show their own errors.
        setState({ status: "signedIn", me: { workspace: null, actor: null, isAdmin: false } });
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearLocal, refreshMe]);

  const signIn = useCallback(async () => {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: "internal", path: "oauth" });
    const request = new AuthSession.AuthRequest({
      clientId: OAUTH_CLIENT_ID,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      scopes: [],
    });
    const result = await request.promptAsync(discovery);
    if (result.type !== "success") {
      if (result.type === "error") setState({ status: "signedOut", error: result.error?.message ?? "Sign-in didn't finish." });
      return;
    }
    const code = result.params.code;
    if (!code || !request.codeVerifier) return setState({ status: "signedOut", error: "Sign-in didn't return a code. Try again." });
    const res = await fetch(discovery.tokenEndpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: OAUTH_CLIENT_ID,
        redirect_uri: redirectUri,
        code_verifier: request.codeVerifier,
      }).toString(),
    });
    const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
    if (!res.ok || !body?.access_token) return setState({ status: "signedOut", error: body?.error ? `Sign-in failed (${body.error}).` : "Sign-in failed. Try again." });
    await saveToken(body.access_token);
    await refreshMe();
  }, [refreshMe]);

  const signOut = useCallback(async () => {
    try {
      await api.del("/me");
    } catch {
      // Signing out locally still matters when the server can't be reached.
    }
    await clearLocal();
  }, [clearLocal]);

  const value = useMemo(() => ({ state, signIn, signOut, refreshMe }), [state, signIn, signOut, refreshMe]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** The signed-in member. Only call inside the signed-in part of the app. */
export function useMe(): Me {
  const { state } = useAuth();
  return state.status === "signedIn" ? state.me : { workspace: null, actor: null, isAdmin: false };
}
