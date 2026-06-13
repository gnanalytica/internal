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
- **App icon / splash image** — drop `icon.png` (1024×1024) and an adaptive icon
  into `assets/`, then reference them under `expo.android.adaptiveIcon` /
  `expo.icon`. Until then the branded in-app launch screen covers first paint.

## Known caveat: Google sign-in inside a WebView

Google blocks OAuth in embedded WebViews ("disallowed_useragent"). In the app,
use **email/password** or **GitHub** sign-in, which work in a WebView. To enable
native Google sign-in later, route it through the system browser with
`expo-auth-session` / `expo-web-browser` — happy to wire that up when needed.
