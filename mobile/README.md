# Internal — Android app (Expo)

A native app for the whole Internal workspace, built with Expo SDK 56 and
Expo Router. It talks to the web app's REST API (`/api/v1`) and replaces the
earlier WebView wrapper.

## How it signs in

The app is a public OAuth client (`internal-mobile`). Signing in opens the web
sign-in in a browser tab (Google, GitHub or email), the member approves, and
the app swaps the returned code — with PKCE — for an API key that acts as that
member, with their own role. The key lives in the phone's secure storage and
signing out revokes it (`DELETE /api/v1/me`). A member signed in on a phone sees
through the API only what the web shows them (see `src/lib/api/scope.ts` in the
web app).

## Run it

```bash
cd mobile
pnpm install
pnpm start          # then press "a" for an Android emulator, or open in a dev build
```

To sign in from Expo Go, add its callback (printed as `exp://…/--/oauth`) to
`OAUTH_MOBILE_DEV_REDIRECT_URIS` on the web app. Installed builds use
`internal://oauth`, which is always allowed.

## Checks (run before pushing)

```bash
pnpm exec tsc --noEmit
npx expo export --platform android
```

## Build an APK

```bash
eas build -p android --profile preview      # installable .apk
eas build -p android --profile production   # Play Store .aab
```

## Layout

- `src/app` — screens (Expo Router). Tabs: Home, Inbox, My issues, Prospects, More.
- `src/features/<section>` — each section's API hooks and components.
- `src/components/ui` — the shared UI kit; `src/theme` — tokens from the web's `globals.css`.
- `src/lib` — API client, auth, query client, formatting, constants mirrored from the web.

`mobile/pnpm-workspace.yaml` marks this folder as its own pnpm workspace. Don't
delete it: without it pnpm installs at the repo root instead and the app has no
dependencies.
