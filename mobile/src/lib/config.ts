import Constants from "expo-constants";

/** The deployed Internal web app — the API and the sign-in live there. */
export const API_URL: string = String(Constants.expoConfig?.extra?.apiUrl ?? "https://internal.gnanalytica.com").replace(/\/+$/, "");

export const OAUTH_CLIENT_ID = "internal-mobile";
