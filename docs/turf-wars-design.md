# Aeternum — Turf Wars (Cozy PvP) Design

Status: **DRAFT / for review** · Tone: **Protective / cozy** (retention-first)
Builds on existing tables: `territories`, `resource_nodes`, `territory_attacks`,
`player_resources`. New columns/tables flagged as **[migration]**.

---

## 1. Core loop

1. **Claim** a territory at the map crosshair (near your real location).
2. Territory **passively generates resources** from its nodes while owned.
3. Each map **area has limited territory slots** → scarcity → conflict.
4. To expand into a full area you must **attack** an existing territory…
5. …or **place under** a higher-level owner as a **vassal** (pay tax, gain
   protection). Turf wars, but with an off-ramp from pure aggression.

The cozy principle: **a new or weaker player can always keep playing.** Conflict
is opt-in pressure, never a wall.

---

## 2. Areas & slot scarcity

- The world is divided into **area cells** (e.g. ~500 m grid, derived from
  lat/lng rounding — no new geo system needed).
- Each cell has a **slot cap** (start: 3 territories per cell).
- **Diminishing yield with density**: each additional territory *one player*
  owns in the same cell yields less (100% → 70% → 50%). Stops one whale owning
  a whole city; rewards spreading out.

**[migration]** add to `territories`:
- `area_key text` (computed `round(lat,3)||'_'||round(lng,3)` or similar) — index it.

---

## 3. Shields & grace periods (the cozy core)

A territory is **immune to attack** while shielded.

| Trigger                         | Shield duration |
|---------------------------------|-----------------|
| Just claimed                    | 24 h            |
| Just survived/lost an attack    | 12 h            |
| Owner is a **new player** (< L5)| Permanent until L5 |

Plus a global rule: **no punching down** — you cannot attack a territory whose
owner is **5+ levels below you**. Strong players fight strong players.

**[migration]** add to `territories`:
- `shield_until timestamptz` (nullable)
- attack logic (edge function) rejects if `now() < shield_until` or level gap > 5.

---

## 4. Attacking (costly & deliberate, not spam)

- Costs **influence** (e.g. 50) + an **attack cooldown** per attacker (e.g. 1/hr).
- Resolution uses existing `atk_power` vs `def_power` (already in
  `territory_attacks`). Defender power = owner stats + fortress `walls_level`
  bonus + territory `level`.
- **Win** → ownership transfers; new owner gets a 12 h shield; loser keeps their
  *other* territories. **Loss** → attacker loses the influence, territory gains a
  small temporary defense buff ("rallied").
- Never wipe a player out: a player's **last remaining territory cannot be taken**
  — only contested down to level 1. Guarantees everyone always has a home base.

---

## 5. Vassalage & tax (the novel, non-extortion part)

When a lower-level player claims in a cell **dominated** by a higher-level player
(owner of the most/highest-level territory there), they may place as a **vassal**
instead of fighting.

**Vassal gets:**
- Protection: **cannot be attacked by third parties** (overlord's banner).
- A small **yield bonus** (+10%) for being in a developed area.

**Vassal gives:**
- **Tax**: a share of passive resource yield to the overlord.

**Tax is capped and scales DOWN with the vassal's level** (a growth path, not a
trap):

| Vassal level | Tax rate |
|--------------|----------|
| 1–4          | 20%      |
| 5–9          | 15%      |
| 10–14        | 10%      |
| 15+          | 0% (independent) |

**Overlord obligation (keeps it fair):** if the vassal is attacked and the
overlord's banner is what's protecting them, and the overlord has gone inactive
(no login > 7 days), the vassal can **break away tax-free** and the protection
lapses. Alliances must be *maintained*, not just collected.

**[migration]** new table `territory_vassalage`:
- `vassal_territory_id`, `overlord_id`, `tax_rate`, `created_at`.
- RLS: vassal or overlord can read; only vassal can dissolve (or system on
  overlord inactivity).

---

## 6. Passive resource generation

- A node yields `richness * base` per **tick** (e.g. hourly), accrued server-side
  or computed on next login from `last_harvested_at`.
- Owner collects; if vassal, tax share is split to overlord at collection time.
- Density multiplier (§2) and vassal bonus (§5) applied here.

---

## 7. Newcomer experience (retention)

- **Free starter territory** on first scan (already implemented) — instant
  ownership, permanent shield until L5.
- Under-L5 players see a **"Protected" badge** and cannot be attacked.
- Clear UI copy everywhere: *why* you can't attack/claim, what to do instead.

---

## 8. UI/UX additions

- Crosshair claim (done). Add: **slot counter** for the focused cell
  ("2 / 3 claimed"), **shield timer** on pins, **Protected** badge on newbies.
- Claim modal offers **Claim** vs **Become Vassal** when the cell is dominated.
- Attack modal shows win odds, cost, cooldown, and the no-punching-down reason
  when blocked.

---

## 9. Build phases (suggested order)

1. **Foundation**: `area_key` + slot cap + density yield. (Scarcity exists.)
2. **Shields**: `shield_until` + no-punching-down + newbie protection. (Cozy.)
3. **Attack polish**: cost, cooldown, last-territory protection, rally buff.
4. **Vassalage**: table, tax (scaling), overlord obligation, vassal bonus.
5. **Passive yield + tax split**, then UI badges/timers/counters.

Each phase is shippable on its own and each schema change ships **with its
migration applied** (see CLAUDE.md migration rule).

---

## Open questions for product

- Area cell size — 500 m feels right for urban density; revisit for rural.
- Tick length for passive yield — hourly vs on-login compute.
- Should overlords get a **cap on number of vassals** to prevent feudal sprawl?
- Cosmetic/leaderboard reward for holding contested areas (prestige loop)?
