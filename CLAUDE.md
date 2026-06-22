# Aeternum — Project Guide

## What this app is
Aeternum is a fitness-RPG mobile app (Expo / React Native). Real-world running
distance — pulled from **HealthKit (iOS)** / **Health Connect (Android)** — is
synced to a Supabase backend, resolved into stat gains and gear/relic rewards,
and drives a Korean-RPG-style progression: earned class pathways, ranks, rifts
("Gates"), a fortress, territory on a MapLibre world map, and co-op parties.

## Stack
- **Expo 56 / React Native 0.85**, expo-router (file-based routing in `app/`)
- **Zustand** (`src/store/useStore.ts`) with `persist` → AsyncStorage for offline state
- **Supabase** (`src/lib/supabase.ts`): auth (anonymous/guest), Postgres + RLS, edge functions
- **MapLibre** world map, **Skia + Reanimated** for visuals, **expo-location**
- TypeScript throughout; path alias `@/*` → `src/*`
- **Android 14+ only** (`minSdkVersion: 34`): Health Connect is built into the OS,
  so there's no separate-app install — the health permission flow is just an
  in-app grant. `getSdkStatus` install/update states remain as rare safety nets.

## Layout
- `app/` — screens & routing. `_layout.tsx` is the root (auth boot, tabs, error boundary).
  Tabs: world, fortress, dungeons, hunter, party, settings. `index.tsx` is the hub.
- `src/store/useStore.ts` — single Zustand store; the source of truth for offline play.
- `src/lib/` — `supabase.ts`, `runSync.ts` (health→stats), `rewardEngine.ts`,
  `health.ts` / `healthKit.ts` / `healthConnect.ts` (platform health bridges).
- `src/components/` — shared UI (`UI.tsx`), `ErrorBoundary.tsx`, `Onboarding.tsx`, `CharacterSetup.tsx`.
- `src/types/index.ts` — all domain types + `EMPTY_*` defaults + safe accessors (e.g. `gearStatBonuses`).
- `src/theme/tokens.ts` — colors, fonts, spacing, `elementAccent`, `rarityColor`.

## Commands
```bash
npm start              # expo start (dev server)
npx expo start -c      # clear Metro cache — use after store/persist changes
npx tsc --noEmit       # type-check (MUST be clean before committing)
npm test               # run the Vitest game-logic suite (MUST pass)
npm run test:watch     # watch mode while developing logic
```
`tsc` + `npm test` are the gates before committing. Verify UI changes by running
the app.

## Tests
Pure game-logic lives behind exported functions in `src/types/index.ts`
(stamina, territory upgrades/health/defense, siege thresholds, rift rewards,
`gearStatBonuses`, etc.). These are unit-tested with **Vitest** in `tests/`
(`vitest.config.ts` maps the `@/` alias). The tests run in Node — no React
Native runtime — so they're fast and safe in CI.

When you add or change a game-logic rule, **add/update a test** in
`tests/gameLogic.test.ts` (or a sibling file) and keep `npm test` green. Keep
new logic as pure exported functions so it stays testable without the RN
runtime. Component/screen rendering is not yet covered — `tsc` + manual run
remain the gate there.

## Working norms
- Match the surrounding file's style. Screens are functional components with a
  `StyleSheet.create` block at the bottom and a banner comment header.
- Read data through the store's selectors (`selectPlayer`, etc.), not ad-hoc access.
- After any change to `src/store/useStore.ts`, reload with `npx expo start -c`
  and test BOTH a fresh install and an existing-storage upgrade (see rule #6).
- Server data is untrusted: guard with `?.` / `??` / `Array.isArray` before use.

## Local backend — host URL per target (common "Begin won't load" cause)
`EXPO_PUBLIC_SUPABASE_URL` in `.env` must point at the local Supabase host in a
way the *current test target* can reach. The #1 cause of "stuck on loading" /
"Begin Ascent does nothing" is a host mismatch — the backend is running but the
device can't reach the URL:

| Test target          | URL host to use                              |
|----------------------|----------------------------------------------|
| Android **emulator** | `http://10.0.2.2:54321` (host alias)         |
| **iOS simulator**    | `http://localhost:54321` / `127.0.0.1`       |
| **Physical phone**   | `http://<your-PC-LAN-IP>:54321` (same Wi-Fi) |

Checklist when the entry screen won't progress:
1. Is Supabase running? `curl http://localhost:54321/auth/v1/health` → expect 200.
2. Is it reachable over the LAN IP (for physical devices)?
   `curl http://<LAN-IP>:54321/auth/v1/health` → expect 200. If not, bind the API
   to `0.0.0.0` in `supabase/config.toml`.
3. Phone on the **same Wi-Fi** as the dev machine?
4. After editing `.env`, **restart Expo with `npx expo start -c`** — env is
   bundled at build time, a hot reload won't pick it up.
5. Anonymous auth on? `enable_anonymous_sign_ins = true` in `supabase/config.toml`.

## Database migrations — ALWAYS apply, never assume (hard-won rule)
**Any change that touches the schema (new table/column/policy/function) MUST be
applied to the running DB in the same step — do not assume migration files on
disk are applied.** A whole class of "silent empty" bugs (empty map, "could not
claim territory / influence refunded", broken fortress & party) came from
migration files existing but never having been run, so the tables didn't exist.
Every Supabase query swallows errors and returns empty, so missing tables fail
invisibly — there is no crash to point you at the cause.

Workflow for ANY schema change:
1. Add/edit the `supabase/migrations/NNN_*.sql` file.
2. **Apply it immediately:** `supabase migration up --local` (non-destructive —
   applies only pending migrations, keeps data). Use `supabase db reset` only
   when you intend to wipe and rebuild from scratch.
3. **Verify the table/column exists** before testing the feature:
   `curl -s -o /dev/null -w "%{http_code}" \
     "http://localhost:54321/rest/v1/<table>?select=*&limit=1" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` → expect `200` (`404` = missing).
4. For the **hosted** project later, the equivalent is `supabase db push`.

Schema-drift smoke check (run when *any* backend feature shows no data): probe
each table — `players run_sessions territories resource_nodes fortress
player_resources party_invites` — and confirm each returns 200, not 404.

Note: the migration sequence currently skips `006` (005 → 007). Harmless, but
keep new migrations strictly increasing and contiguous where possible.

Find the LAN IP: Windows `ipconfig` (Wi-Fi IPv4) / macOS `ipconfig getifaddr en0`.

## Boot must never hang silently
The root layout (`app/_layout.tsx`) and Onboarding bound every auth/network call
with a timeout and surface a real error + **Retry** / **Continue Offline** instead
of an infinite spinner. Any new launch-path network call MUST do the same — a
boot path that can `await` forever is a release blocker.

---

## React / Expo Router — Bug Prevention

These are recurring foot-guns in this codebase. Follow them to avoid the
"Can't perform a React state update on a component that hasn't mounted yet"
warning and other render-time crashes.

### 1. Never call setState during render
A `setState` call must live inside `useEffect`, an event handler, or a callback —
**never** in the render body. If render needs derived data, compute it inline
(like `isNewPlayer` in `app/_layout.tsx`) instead of writing it to state.

### 2. Guard every async effect against unmount
Any effect that `await`s and then calls `setState` MUST bail out if the component
has unmounted. Use a local flag captured by the cleanup function:

```tsx
useEffect(() => {
  let active = true
  ;(async () => {
    const data = await fetchThing()
    if (!active) return        // <-- guard after EVERY await
    setData(data)
  })()
  return () => { active = false }
}, [deps])
```

Check `if (!active) return` (or `if (!mounted) return`) **after each `await`**,
not just the first. Both `init` and `autoSync` in `app/_layout.tsx` follow this.
Forgetting the guard is the #1 cause of the "state update on unmounted
component" warning — it fires constantly during Expo Fast Refresh / HMR.

### 3. Subscriptions and timers must be cleaned up
Anything that fires a callback later — `supabase.auth.onAuthStateChange`,
`setTimeout`, `setInterval`, event listeners — must be torn down in the effect's
cleanup return. Otherwise it updates state after unmount.

### 4. Keep effect dependency arrays honest
Every value from props/state/store used inside an effect belongs in its deps
array. Zustand setters are stable so they're safe, but don't omit reactive values
to silence the linter — that causes stale-closure bugs. Use a `useRef` flag
(e.g. `syncFired`) for "run once" semantics instead of an empty deps array hack.

### 5. The stack trace may point at node_modules, not your code
The warning often surfaces from `expo-router`'s `useLinking.native.js` or
`ReactFabric-dev.js`. That's just where React *detected* it. The real cause is
almost always one of your own unguarded async effects. Search your `useEffect`s
with `await` + `setState` before blaming the library. Many of these warnings are
benign HMR artifacts that vanish on a clean reload — confirm in a fresh build
before chasing them.

### 6. Persisted store schema changes MUST stay backward-compatible
`src/store/useStore.ts` persists state to AsyncStorage. Zustand's DEFAULT merge
is **shallow**, so when you add a new field (or nested sub-field) to a persisted
object, a user with old storage gets the stale partial object and the new
sub-field reads as `undefined` → **red-screen crash on load**.

This is now prevented by a custom deep-`merge` + `version` in the persist
config. When you add persisted state:
- Add the field to `INITIAL_PERSISTENT` (a real default, never `undefined`).
- Add it to `partialize`.
- If you change the SHAPE of an existing persisted field incompatibly, bump
  `version` and add a `migrate` function.
- The `deepMerge` helper handles additive changes automatically — don't remove it.

### 7. Errors must never break the whole app
The tree is wrapped in `<ErrorBoundary>` (`src/components/ErrorBoundary.tsx`) in
`app/_layout.tsx`. Any render/lifecycle throw shows a recoverable "SYSTEM FAULT"
fallback with a RETRY button instead of a dead red screen. Wrap any new
risky/independent subtree (a new tab, an experimental screen) in its own
`<ErrorBoundary>` so a crash there can't take down siblings.

### 8. Guard against `undefined` when reading nested data in screens
Even with the deep-merge safety net, defensively read optional/server data:
use `?.`, `??` defaults, and `Array.isArray(x) ? x : []` before `.map()`.
Screens render before async data arrives — never assume a field exists.

### 9. Don't read `.then()` results into state without guards
Promise `.then(setX)` patterns have the same unmount problem as `await`. Wrap
them with the `active` flag too.

### 10. Persist `version` and `migrate` go together
If `version` is set on the persist config, a `migrate` function MUST exist, or
Zustand throws "State loaded from storage couldn't be migrated…". Whenever you
bump `version`, update `migrate` to transform old shapes forward. Never bump one
without the other.

---

## Production / App-Store Readiness Rules

Rules for shipping a stable, reviewable build to the Apple App Store and Google
Play. This app uses Expo 56, Supabase, MapLibre, location, and HealthKit /
Health Connect — all of which have store-review and runtime implications.

### Secrets & configuration
- **Never hardcode secrets.** Only `EXPO_PUBLIC_*` vars are safe in the client
  (they ship in the bundle and are world-readable). The Supabase **anon** key is
  fine; the **service-role** key must NEVER appear in app code — server/edge only.
- `.env` is git-ignored and MUST stay that way. Keep `.env.example` current so
  new envs are documented. CI/EAS secrets live in EAS, not the repo.
- All real authorization MUST be enforced by **Supabase Row Level Security**, not
  the client. Assume any client check can be bypassed.

### Permissions (App Store rejection risk)
- Location, Health, and Motion permissions MUST have clear, specific usage
  strings in `app.json` (`NS*UsageDescription` / Android `permissions`). Vague
  strings get rejected. Only request a permission at the moment the feature needs
  it, never on cold start.
- Health data (HealthKit / Health Connect) is highly scrutinized: it may only be
  used for the user-facing fitness feature, never advertising/analytics. Apple
  requires a privacy policy URL when HealthKit is present.
- Always handle **permission denied** gracefully — show an explanatory state with
  a path to Settings, never a crash or dead screen.

### Network & backend resilience
- Every Supabase / edge-function call MUST handle: offline, timeout, non-200, and
  malformed payloads. Wrap in try/catch, surface a user-friendly message, and
  keep the app usable. The app must not hard-depend on connectivity at launch.
- Validate/parse server responses before use; never trust shape. Treat all
  external data as untrusted (defensive `?.`, `??`, `Array.isArray`).
- Add timeouts to network calls so the UI can't hang forever.

### State, data safety & offline
- The persisted store is the source of truth for offline play — keep it
  backward-compatible (see persist rules above). Never ship a change that can
  brick existing users' saved data.
- User progress is precious: writes to Supabase are debounced/best-effort
  (`usePersistenceSync`); never block the UI on a save and never lose local state
  if a save fails.

### Crash safety & observability
- Wrap independent feature subtrees in `<ErrorBoundary>` so one screen's crash
  can't take down the app (already at root in `app/_layout.tsx`).
- Before release, integrate a crash/error reporter (e.g. Sentry) and forward
  `ErrorBoundary.componentDidCatch` to it. `console.error` is not enough in prod.
- No unhandled promise rejections. Every `async` path has a `catch`.

### Performance & UX
- Lists that can grow (inventory, leaderboard, territories) MUST use
  `FlatList`/`FlashList` with `keyExtractor`, not `.map()` in a `ScrollView`.
- Memoize expensive renders (`React.memo`, `useMemo`) and use stable Zustand
  selectors to avoid re-render storms. Never create new objects/arrays inline in
  a selector — it breaks referential equality and loops renders.
- Reanimated/Skia work belongs on the UI thread via worklets; never block JS.
- Every screen needs three states: **loading**, **empty**, and **error** — no
  blank screens.
- Respect safe-area insets on all screens (notch / home indicator).

### Accessibility & store polish
- Interactive elements need `accessibilityLabel` / `accessibilityRole`. Touch
  targets ≥ 44×44 pt.
- Don't rely on color alone to convey state (element/rarity colors need text too).
- Lock supported orientations and test on small + large devices and a tablet.

### Release hygiene
- `npx tsc --noEmit` and `eslint` MUST pass clean before any build. No `// @ts-ignore`
  without a comment explaining why.
- Bump `version` and `ios.buildNumber` / `android.versionCode` every submission.
- Test a **fresh install** (cleared storage) AND an **upgrade** (existing storage)
  on every release — the upgrade path is where persist/migration bugs surface.
- Strip debug logging and dev-only screens from production builds.
- Verify deep links / `expo-router` linking work from a cold start (the
  `useLinking` path), since that's a real launch route.
