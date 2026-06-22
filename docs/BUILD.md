# Aeternum — Building for Alpha Testers (EAS)

Produces a shareable Android APK for testers. Run from the project root.

## One-time setup
```bash
# 1. Log in to Expo (create a free account at expo.dev if needed)
npx eas login

# 2. Link this project to an EAS project — this fills in the real projectId
#    in app.json (currently the placeholder "your-eas-project-id").
npx eas init
```

## Environment variables (the #1 gotcha)
EAS cloud builds **do not** read your local `.env`. The `EXPO_PUBLIC_*` vars must
be registered as EAS environment variables, or the APK builds fine but **can't
reach Supabase** (stuck on "Begin" / offline mode).

For an alpha you almost always want the **cloud Supabase** URL (local LAN URLs
only work on your own Wi-Fi). Register the vars EAS should bake in:

```bash
# Point at your CLOUD Supabase (not a LAN IP) so testers anywhere can connect.
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --environment preview --visibility plaintext
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>" --environment preview --visibility sensitive

# Optional — crash reporting. Skip to keep Sentry inert.
npx eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "<dsn>" --environment preview --visibility sensitive
```
(The `alpha` profile extends `preview`, so it inherits these.)

Pre-flight check: confirm the cloud backend is live before building —
`curl https://<ref>.supabase.co/auth/v1/health` should return 200, and
**Anonymous sign-ins must be ON** in Dashboard → Authentication → Providers.

## Build the APK
```bash
npx eas build --profile alpha --platform android
```
EAS builds in the cloud (~10–20 min) and gives you a download URL + QR. Send the
URL to testers — they tap it on their Android 14+ phone, allow "install unknown
apps", and install.

## Updating testers without a full rebuild
Pure JS/asset changes can ship over-the-air to installed alpha builds:
```bash
npx eas update --branch alpha --message "what changed"
```
(Native changes — new packages, app.json plugin/permission changes — still need a
full `eas build`.)

## Before you build — checklist
- [ ] `npx tsc --noEmit` clean and `npm test` green (the commit gates)
- [ ] Cloud Supabase reachable (200) + anonymous auth enabled
- [ ] EAS env vars set for the `preview`/`alpha` environment (above)
- [ ] `app.json` projectId is real (filled by `eas init`)
- [ ] Bump `version` / let `autoIncrement` handle versionCode each build
- [ ] Tested the Begin → Sync → Claim path on a real device once
