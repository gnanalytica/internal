# Internal — Android app (Expo)

A native Android shell around the deployed web app
(`https://internal.gnanalytica.com`). It renders the real, responsive interface
in a WebView with native touches: themed status bar, a branded launch screen,
hardware back-button navigation, pull-to-refresh, persistent login (cookies +
storage), and an offline/retry screen.

## Why a WebView wrapper

The web app is already polished and responsive, so this ships that exact
interface to Android today and reuses 100% of the product — including the
rich-text editor, databases, and AI features that have no good native
equivalent. A full native rebuild would, for months, be a worse interface than
what already exists.

## Run it locally

```bash
cd mobile
npm install
npx expo install --fix   # align dependency versions to the installed Expo SDK
npx expo start           # press 'a' for an Android emulator, or scan the QR with Expo Go
```

`react-native-webview` is bundled in Expo Go, so no custom dev build is needed
to try it.

## Build an installable APK (EAS Build, cloud — no Android Studio needed)

```bash
npm i -g eas-cli
eas login
eas init                 # creates the EAS project; paste the projectId into app.json > extra.eas.projectId
eas build -p android --profile preview   # produces a downloadable .apk
```

For the Play Store, use `--profile production` (builds an `.aab`) then
`eas submit -p android`.

## Configuration

- **Target URL** — `app.json` → `expo.extra.appUrl`. Point it at a preview URL
  to test against staging.
- **Package id** — `app.json` → `expo.android.package`
  (`com.gnanalytica.internal`).

## App icon, adaptive icon & splash

Generated programmatically (no design tool needed) into `assets/`:

```bash
node scripts/make-icons.mjs   # writes icon.png, adaptive-icon.png, splash-icon.png, favicon.png
```

`app.json` wires `icon`, `android.adaptiveIcon` (white "i" on brand `#5e6ad2`),
and an `expo-splash-screen` plugin splash. Tweak the colors/mark in
`scripts/make-icons.mjs` and re-run to rebrand.

## Sign-in / OAuth

The app now handles OAuth inside the WebView:

- A clean Chrome user-agent + inline popup handling
  (`setSupportMultipleWindows={false}`) let **Google**, **GitHub**, and
  **email/password** sign-in complete in the app — the session cookie is set in
  the same WebView that runs the app.
- Genuinely external links (anything not your app or an OAuth provider) open in
  the device's system browser via `expo-web-browser`.

Why not a pure "open the login in the system browser" handoff? The app's auth is
an **httpOnly session cookie**, and Android Custom Tabs use a **separate cookie
jar** from the WebView — so a cookie set in the system browser never reaches the
app. Keeping the OAuth flow inside the WebView is what actually shares the
session. If Google ever hard-blocks the embedded flow, the fully-native
alternative is: native Google Sign-In → ID token → a backend "sign in with ID
token" endpoint → set the returned session cookie in the WebView via
`@react-native-cookies/cookies`. That needs an Android OAuth client (with the
EAS build's SHA-1) and a small backend endpoint — happy to add it if needed.
