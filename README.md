# Aeternum

A mobile fitness MMORPG where real-world runs are the primary gameplay mechanic.

## Concept

Players run outside to complete quests, fight bosses, and progress their character. Everything else — inventory, party, trading, PvP — happens before and after the run. The player never needs to look at their phone while running.

After the run, the player opens the app, taps "Sync Run", and the app reads the completed session from Android Health Connect. The backend validates the run and resolves combat, loot, and stat progression server-side.

## Tech Stack

| Layer | Technology |
|---|---|
| App framework | React Native + Expo (TypeScript) |
| UI rendering | React Native Skia (custom 2D geometry) |
| Health data | Android Health Connect (post-run sync) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Maps (Phase 2) | MapLibre |
| Analytics | Firebase Analytics |
| Push notifications | Firebase Cloud Messaging + Expo |

## Architecture

### Phase 1 — Sync Mode (current)

```
Player finishes run (any device)
    └── Opens Aeternum
    └── Taps "Sync Run"
    └── App reads completed session from Health Connect
            └── Distance, steps, duration, heart rate
    └── Sends to Supabase Edge Function
    └── Server validates + resolves combat + generates rewards
    └── Rewards screen displays loot and stat gains
```

### Phase 2 — Exploration Mode (future)

Real-time GPS tracking during run with geofenced world events. The `mode` field on `run_sessions` (`'sync' | 'exploration'`) is already in the schema — Phase 2 does not require a migration.

## Project Structure

```
aeternum/
├── app/                  Expo Router screens
├── src/
│   ├── types/            Single-source-of-truth TypeScript types
│   ├── theme/            Design tokens (colours, fonts, spacing)
│   ├── lib/              Supabase client, Health Connect, sync pipeline
│   ├── store/            Zustand global state
│   └── components/       Octagram + shared UI primitives
└── supabase/
    ├── migrations/       PostgreSQL schema
    └── functions/        Edge Functions (server-authoritative game logic)
```

## Stats System (Octagram)

Eight stats rendered as a polygon. Each stat grows from a specific run behaviour:

| Stat | Grows from |
|---|---|
| ATK | Boss kills |
| SPD | Sprint sessions (high pace) |
| INT | Arcane quests |
| LCK | Harvest quests |
| DEF | Party runs |
| END | Long runs (distance threshold) |
| PER | Exploration (Phase 2) |
| CHA | Party leadership |

## Distance-Gated Rewards

| Distance | Tier |
|---|---|
| 0–2 km | Minor encounters, common loot |
| 2–5 km | Elite encounters, uncommon loot |
| 5–8.5 km | Dungeon completion (Rank B), rare loot |
| 8.5–15 km | Rank A dungeon, rare + uncommon loot |
| 15 km+ | Rank S raid tier, legendary loot |

## Rank Ladder

`E → D → C → B → A → S → Sovereign`

## Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (`npm install -g supabase`)
- Android device or emulator with Health Connect installed

### Environment

```bash
cp .env.example .env
```

Fill in your Supabase project URL and anon key.

### Install

```bash
npm install
```

### Database

```bash
supabase db push
```

### Edge Functions

```bash
supabase functions deploy resolve-run
```

### Run

```bash
npx expo start --android
```

## Anti-Cheat

All run validation happens server-side in the `resolve-run` Edge Function. The client sends raw sensor data; the server decides whether the run is valid and what rewards it earns. Flagged runs are stored with a `flag_reason` but are not rewarded.

## Design Language

- Angular panels, borderRadius 2–4 only
- No pill-shaped buttons
- No glassmorphism
- No rounded generic cards
- Typography: Rajdhani 700 (display), Share Tech Mono 400 (data)
- All labels uppercase with wide letter-spacing
- Element accent colour shifts the entire app colour personality
