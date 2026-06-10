// =============================================================================
// Aeternum — resolve-run Edge Function
// =============================================================================
// This function is the authoritative game server. The client sends raw sensor
// data; this function decides validity, rewards, and stat gains.
//
// Why server-authoritative: the client cannot be trusted to determine what loot
// it earns. All reward logic lives here so cheating requires compromising the
// server, not the app binary.
//
// Why Supabase Edge Functions: zero cold-start overhead for this use case,
// direct access to the database via service_role, and TypeScript throughout.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunRequest {
  player_id: string
  mode: 'sync' | 'exploration'
  distance_km: number
  duration_seconds: number
  steps: number
  avg_heart_rate?: number
  started_at: string
  ended_at: string
}

interface ValidationResult {
  valid: boolean
  confidence: number
  flagReason?: string
}

interface Reward {
  id: string
  name: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  type: 'gear' | 'scroll' | 'consumable' | 'material'
}

interface Stats {
  ATK: number
  SPD: number
  INT: number
  LCK: number
  DEF: number
  END: number
  PER: number
  CHA: number
}

interface RunResponse {
  run_id: string
  validated: boolean
  rewards: Reward[]
  stat_gains: Partial<Stats>
  flag_reason?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_STEPS_PER_KM = 1200
const MAX_STEPS_PER_KM = 1600
const RATIO_LOWER_BOUND = 0.6
const RATIO_UPPER_BOUND = 2.0
const MIN_PACE_SECONDS_PER_KM = 180    // 3 min/km — sprint world record territory
const MAX_PACE_SECONDS_PER_KM = 1800   // 30 min/km — near-stationary

const RANK_THRESHOLDS: Record<string, number> = {
  D: 50,
  C: 150,
  B: 350,
  A: 750,
  S: 1500,
  Sovereign: 3000,
}

// ---------------------------------------------------------------------------
// Anti-cheat validation
// ---------------------------------------------------------------------------

function validateRun(req: RunRequest): ValidationResult {
  const { distance_km, duration_seconds, steps } = req

  const paceSecondsPerKm = duration_seconds / distance_km
  const stepsPerKm = steps / distance_km
  const expectedStepsPerKm = (MIN_STEPS_PER_KM + MAX_STEPS_PER_KM) / 2
  const ratio = stepsPerKm / expectedStepsPerKm

  if (paceSecondsPerKm < MIN_PACE_SECONDS_PER_KM) {
    return {
      valid: false,
      confidence: 0,
      flagReason: `Pace ${paceSecondsPerKm.toFixed(0)}s/km is faster than 3 min/km — implausible`,
    }
  }

  if (paceSecondsPerKm > MAX_PACE_SECONDS_PER_KM) {
    return {
      valid: false,
      confidence: 0,
      flagReason: `Pace ${paceSecondsPerKm.toFixed(0)}s/km is slower than 30 min/km — implausible`,
    }
  }

  if (distance_km < 0.1 && steps > 500) {
    return {
      valid: false,
      confidence: 0,
      flagReason: `Distance ${distance_km}km with ${steps} steps — GPS/step data inconsistent`,
    }
  }

  if (ratio < RATIO_LOWER_BOUND || ratio > RATIO_UPPER_BOUND) {
    // Suspicious but not a hard reject — reduce confidence
    const confidence = ratio < RATIO_LOWER_BOUND
      ? ratio / RATIO_LOWER_BOUND
      : RATIO_UPPER_BOUND / ratio

    return {
      valid: true,
      confidence: Math.min(confidence, 0.6),
      flagReason: `Step/distance ratio ${ratio.toFixed(2)}x outside expected 0.6–2.0x bounds`,
    }
  }

  // Linear confidence from ratio closeness to 1.0 (perfect ratio)
  const ratioDeviation = Math.abs(ratio - 1.0)
  const confidence = Math.max(0.7, 1.0 - ratioDeviation * 0.5)

  return { valid: true, confidence }
}

// ---------------------------------------------------------------------------
// Reward generation
// ---------------------------------------------------------------------------

type RewardTier = {
  rarity: Reward['rarity']
  encounterLabel: string
}

function getRewardTier(distance_km: number): RewardTier {
  if (distance_km >= 15) return { rarity: 'legendary', encounterLabel: 'Rank S Raid' }
  if (distance_km >= 8.5) return { rarity: 'rare', encounterLabel: 'Rank A Dungeon' }
  if (distance_km >= 5) return { rarity: 'rare', encounterLabel: 'Rank B Dungeon' }
  if (distance_km >= 2) return { rarity: 'uncommon', encounterLabel: 'Elite Encounter' }
  return { rarity: 'common', encounterLabel: 'Minor Encounter' }
}

// Deterministic reward pool seeded by session data — not random each call.
// This prevents reward re-rolling by re-submitting the same run.
function generateRewards(
  distance_km: number,
  player_id: string,
  started_at: string,
  confidence: number,
): Reward[] {
  const { rarity } = getRewardTier(distance_km)

  // Seed from player + time so re-submitting the same data produces the same rewards
  const seed = parseInt(player_id.replace(/-/g, '').slice(0, 8), 16)
    + new Date(started_at).getTime()

  const rewardCount = Math.floor((seed % 3) + 1 + Math.floor(distance_km / 5))

  const REWARD_POOLS: Record<Reward['rarity'], Omit<Reward, 'id'>[]> = {
    common: [
      { name: 'Iron Shard', rarity: 'common', type: 'material' },
      { name: 'Runner\'s Tonic', rarity: 'common', type: 'consumable' },
      { name: 'Trail Dust', rarity: 'common', type: 'material' },
      { name: 'Worn Bracer', rarity: 'common', type: 'gear' },
    ],
    uncommon: [
      { name: 'Vitality Scroll', rarity: 'uncommon', type: 'scroll' },
      { name: 'Thornmail Fragment', rarity: 'uncommon', type: 'material' },
      { name: 'Elite Badge', rarity: 'uncommon', type: 'consumable' },
      { name: 'Dusk Charm', rarity: 'uncommon', type: 'gear' },
    ],
    rare: [
      { name: 'Arcane Codex', rarity: 'rare', type: 'scroll' },
      { name: 'Dungeon Key', rarity: 'rare', type: 'consumable' },
      { name: 'Storm Pendant', rarity: 'rare', type: 'gear' },
      { name: 'Forge Core', rarity: 'rare', type: 'material' },
    ],
    legendary: [
      { name: 'Sovereign\'s Sigil', rarity: 'legendary', type: 'gear' },
      { name: 'Raid Trophy', rarity: 'legendary', type: 'consumable' },
      { name: 'Elder Scroll', rarity: 'legendary', type: 'scroll' },
    ],
  }

  const pool = REWARD_POOLS[rarity]
  const rewards: Reward[] = []

  for (let i = 0; i < Math.min(rewardCount, pool.length); i++) {
    const item = pool[(seed + i) % pool.length]
    if (item) {
      // confidence below 0.6 downgrades rarity one step
      const effectiveRarity = confidence < 0.6 && rarity !== 'common'
        ? downgradeRarity(rarity)
        : rarity
      rewards.push({
        id: `${started_at}-${i}`,
        ...item,
        rarity: effectiveRarity,
      })
    }
  }

  return rewards
}

function downgradeRarity(rarity: Reward['rarity']): Reward['rarity'] {
  const ladder: Reward['rarity'][] = ['common', 'uncommon', 'rare', 'legendary']
  const idx = ladder.indexOf(rarity)
  return idx > 0 ? (ladder[idx - 1] as Reward['rarity']) : 'common'
}

// ---------------------------------------------------------------------------
// Stat gains
// ---------------------------------------------------------------------------

function resolveStatGains(req: RunRequest): Partial<Stats> {
  const gains: Partial<Stats> = {}
  const paceSecondsPerKm = req.duration_seconds / req.distance_km

  // END — long run threshold
  if (req.distance_km >= 5) gains.END = Math.floor(req.distance_km / 5)

  // SPD — sprint session (sub-5 min/km pace)
  if (paceSecondsPerKm < 300) gains.SPD = 2

  // ATK — boss encounter threshold (Rank B+)
  if (req.distance_km >= 5) gains.ATK = 1

  // LCK — any completed run
  gains.LCK = 1

  return gains
}

// ---------------------------------------------------------------------------
// Rank calculation
// ---------------------------------------------------------------------------

function resolveRank(totalDistanceKm: number): string {
  if (totalDistanceKm >= RANK_THRESHOLDS['Sovereign']!) return 'Sovereign'
  if (totalDistanceKm >= RANK_THRESHOLDS['S']!) return 'S'
  if (totalDistanceKm >= RANK_THRESHOLDS['A']!) return 'A'
  if (totalDistanceKm >= RANK_THRESHOLDS['B']!) return 'B'
  if (totalDistanceKm >= RANK_THRESHOLDS['C']!) return 'C'
  if (totalDistanceKm >= RANK_THRESHOLDS['D']!) return 'D'
  return 'E'
}

// ---------------------------------------------------------------------------
// Title generator
// ---------------------------------------------------------------------------

type RunPattern = 'sprint' | 'endurance' | 'consistent' | 'rare' | 'balanced'

const TITLE_MAP: Record<string, Record<RunPattern, string>> = {
  fire:    { sprint: 'Flashfire Striker', endurance: 'Ember Sovereign', consistent: 'Pyrewalker', rare: 'Cinderborn', balanced: 'Flamecaller' },
  water:   { sprint: 'Tidal Dasher', endurance: 'Deepcurrent', consistent: 'Tidecaller', rare: 'Abyssal Envoy', balanced: 'Wavebreaker' },
  nature:  { sprint: 'Thornwind Runner', endurance: 'Rootwarden', consistent: 'Greenpath Keeper', rare: 'Ancient Bloom', balanced: 'Wildstrider' },
  arcane:  { sprint: 'Riftcaster', endurance: 'Eternal Scholar', consistent: 'Spellmark', rare: 'Runic Arcanist', balanced: 'Veilwalker' },
  shadow:  { sprint: 'Shadowblitz', endurance: 'Void Sovereign', consistent: 'Duskbound', rare: 'Umbral Spectre', balanced: 'Nightweaver' },
  frost:   { sprint: 'Blizzard Sprinter', endurance: 'Glacial Sentinel', consistent: 'Frostwalker', rare: 'Absolute Zero', balanced: 'Cryomancer' },
  earth:   { sprint: 'Rockslide Charger', endurance: 'Ironclad Warden', consistent: 'Terraclaimer', rare: 'Tectonic Breaker', balanced: 'Stoneguard' },
  harvest: { sprint: 'Grain Reaper', endurance: 'Field Sovereign', consistent: 'Harvest Keeper', rare: 'Bountiful Sage', balanced: 'Plenty Walker' },
  forge:   { sprint: 'Molten Racer', endurance: 'Ironworks Titan', consistent: 'Tempering Path', rare: 'Grand Artificer', balanced: 'Smithbound' },
  mending: { sprint: 'Swift Mender', endurance: 'Undying Healer', consistent: 'Restoration Path', rare: 'Sacred Restorer', balanced: 'Lifebinder' },
}

function generateTitle(element: string | null, pattern: RunPattern): string {
  if (!element) return 'Unnamed Runner'
  const titles = TITLE_MAP[element.toLowerCase()]
  if (!titles) return 'Unnamed Runner'
  return titles[pattern] ?? 'Unnamed Runner'
}

function classifyRunPattern(req: RunRequest): RunPattern {
  const paceSecondsPerKm = req.duration_seconds / req.distance_km
  if (paceSecondsPerKm < 300) return 'sprint'
  if (req.distance_km >= 10) return 'endurance'
  if (req.distance_km >= 15) return 'rare'
  return 'balanced'
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(supabaseUrl, serviceRoleKey)

  let body: RunRequest
  try {
    body = await req.json() as RunRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { player_id, mode, distance_km, duration_seconds, steps, avg_heart_rate, started_at, ended_at } = body

  if (!player_id || !distance_km || !duration_seconds || !steps || !started_at || !ended_at) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate the run
  const validation = validateRun(body)
  const rewards = validation.valid
    ? generateRewards(distance_km, player_id, started_at, validation.confidence)
    : []
  const statGains = validation.valid ? resolveStatGains(body) : {}

  // Fetch current player
  const { data: player, error: playerError } = await db
    .from('players')
    .select('stats, total_distance_km, primary_element, title, title_chronicle, rank')
    .eq('id', player_id)
    .single()

  if (playerError || !player) {
    return new Response(JSON.stringify({ error: 'Player not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Insert run session
  const { data: runSession, error: insertError } = await db
    .from('run_sessions')
    .insert({
      player_id,
      mode: mode ?? 'sync',
      distance_km,
      duration_seconds,
      steps,
      avg_heart_rate: avg_heart_rate ?? null,
      started_at,
      ended_at,
      rewards: rewards.length > 0 ? rewards : null,
      stat_gains: Object.keys(statGains).length > 0 ? statGains : null,
      validated: validation.valid,
      flag_reason: validation.flagReason ?? null,
    })
    .select('id')
    .single()

  if (insertError || !runSession) {
    return new Response(JSON.stringify({ error: 'Failed to store run session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Update player stats, total distance, rank, and title
  if (validation.valid) {
    const currentStats = player.stats as Stats
    const newStats: Stats = { ...currentStats }
    for (const [stat, gain] of Object.entries(statGains)) {
      const key = stat as keyof Stats
      newStats[key] = (newStats[key] ?? 0) + (gain as number)
    }

    const newTotalDistance = (player.total_distance_km as number) + distance_km
    const newRank = resolveRank(newTotalDistance)

    const pattern = classifyRunPattern(body)
    const newTitle = generateTitle(player.primary_element as string | null, pattern)
    const titleChanged = newTitle !== player.title && newTitle !== 'Unnamed Runner'
    const newChronicle = titleChanged
      ? [...(player.title_chronicle as string[]), player.title]
      : player.title_chronicle

    await db
      .from('players')
      .update({
        stats: newStats,
        total_distance_km: newTotalDistance,
        rank: newRank,
        title: titleChanged ? newTitle : player.title,
        title_chronicle: newChronicle,
      })
      .eq('id', player_id)
  }

  const response: RunResponse = {
    run_id: runSession.id as string,
    validated: validation.valid,
    rewards,
    stat_gains: statGains,
    ...(validation.flagReason ? { flag_reason: validation.flagReason } : {}),
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
