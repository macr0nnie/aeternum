// =============================================================================
// Aeternum — resolve-gate Edge Function
// =============================================================================
// Server-authoritative co-op gate resolution.
// Client sends gate_id + list of participating player IDs.
// Server fetches all players' live stats, pools them, resolves win/loss,
// and awards stat bonuses + marks gate cleared for every participant.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GateRequest {
  gate_id: string
  participant_ids: string[]  // all player IDs including the host
}

interface Stats {
  ATK: number; SPD: number; INT: number; LCK: number
  DEF: number; END: number; PER: number; CHA: number
}

type StatKey = keyof Stats

interface GateDefinition {
  statRequirements: Partial<Stats>
  statRewards: Partial<Stats>
  rank: string
  minDistanceKm: number
}

interface PlayerOutcome {
  player_id: string
  stat_gains: Partial<Stats>
  won: boolean
}

interface GateResponse {
  session_id: string
  gate_id: string
  won: boolean
  win_probability: number
  pooled_stats: Stats
  participant_count: number
  outcomes: PlayerOutcome[]
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// ---------------------------------------------------------------------------
// Gate definitions (must mirror src/types/index.ts DUNGEON_ENTRIES)
// ---------------------------------------------------------------------------

const GATE_DEFINITIONS: Record<string, GateDefinition> = {
  gate_f1: {
    rank: 'F', minDistanceKm: 0,
    statRequirements: {},
    statRewards: { ATK: 1, SPD: 1 },
  },
  gate_f2: {
    rank: 'F', minDistanceKm: 1,
    statRequirements: { ATK: 2 },
    statRewards: { DEF: 1, END: 1 },
  },
  gate_e1: {
    rank: 'E', minDistanceKm: 5,
    statRequirements: { ATK: 5, DEF: 3 },
    statRewards: { ATK: 2, SPD: 1, LCK: 1 },
  },
  gate_e2: {
    rank: 'E', minDistanceKm: 10,
    statRequirements: { SPD: 5, END: 3 },
    statRewards: { SPD: 2, INT: 1 },
  },
  gate_d1: {
    rank: 'D', minDistanceKm: 20,
    statRequirements: { ATK: 10, DEF: 8, END: 5 },
    statRewards: { ATK: 3, DEF: 2, SPD: 1 },
  },
  gate_d2: {
    rank: 'D', minDistanceKm: 30,
    statRequirements: { INT: 10, PER: 5 },
    statRewards: { INT: 3, PER: 2, LCK: 1 },
  },
  gate_c1: {
    rank: 'C', minDistanceKm: 50,
    statRequirements: { ATK: 18, SPD: 12, DEF: 15 },
    statRewards: { ATK: 4, SPD: 3, DEF: 2 },
  },
  gate_c2: {
    rank: 'C', minDistanceKm: 75,
    statRequirements: { INT: 20, PER: 15, CHA: 10 },
    statRewards: { INT: 5, PER: 3, CHA: 2 },
  },
  gate_b1: {
    rank: 'B', minDistanceKm: 150,
    statRequirements: { ATK: 30, SPD: 25, DEF: 25, END: 20 },
    statRewards: { ATK: 6, SPD: 4, DEF: 4, END: 3 },
  },
  gate_s1: {
    rank: 'S', minDistanceKm: 500,
    statRequirements: { ATK: 50, SPD: 45, DEF: 45, INT: 40, END: 40, PER: 35, LCK: 30, CHA: 30 },
    statRewards: { ATK: 10, SPD: 8, DEF: 8, INT: 7, END: 7, PER: 6, LCK: 5, CHA: 5 },
  },
}

// ---------------------------------------------------------------------------
// Stat pooling: average all members' stats + co-op bonus per extra member
// ---------------------------------------------------------------------------

const COOP_BONUS_PER_EXTRA_MEMBER = 0.15  // +15% per member beyond the first

function poolStats(allStats: Stats[]): Stats {
  const count = allStats.length
  if (count === 0) return { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 0, PER: 0, CHA: 0 }

  const keys: StatKey[] = ['ATK', 'SPD', 'INT', 'LCK', 'DEF', 'END', 'PER', 'CHA']
  const avg = {} as Stats
  for (const k of keys) {
    avg[k] = Math.round(allStats.reduce((sum, s) => sum + (s[k] ?? 0), 0) / count)
  }

  // Co-op bonus stacks per extra member
  const bonus = 1 + (count - 1) * COOP_BONUS_PER_EXTRA_MEMBER
  for (const k of keys) {
    avg[k] = Math.round(avg[k] * bonus)
  }

  return avg
}

// ---------------------------------------------------------------------------
// Win probability (mirrors client-side formula in dungeons.tsx)
// ---------------------------------------------------------------------------

const WIN_PROB_FLOOR = 0.05
const WIN_PROB_CEIL  = 0.97

function calcWinProb(gate: GateDefinition, pooled: Stats): number {
  const reqs = gate.statRequirements
  const entries = Object.entries(reqs)
  if (entries.length === 0) return WIN_PROB_CEIL

  let totalExcess = 0
  for (const [key, required] of entries) {
    const have = pooled[key as StatKey] ?? 0
    totalExcess += required > 0 ? (have - required) / required : 1
  }
  const avg = totalExcess / entries.length
  return Math.min(WIN_PROB_CEIL, Math.max(WIN_PROB_FLOOR, 0.5 + avg * 0.5))
}

// ---------------------------------------------------------------------------
// Resolve outcome deterministically (seeded by session timestamp)
// ---------------------------------------------------------------------------

function resolveOutcome(winProb: number, seed: number): boolean {
  // Deterministic pseudo-random from seed — prevents client-side re-roll attacks
  const pseudoRand = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296
  return pseudoRand < winProb
}

// ---------------------------------------------------------------------------
// Stat gains on win (base rewards scaled by party bonus)
// ---------------------------------------------------------------------------

function calcStatGains(gate: GateDefinition, partySize: number): Partial<Stats> {
  const gains: Partial<Stats> = {}
  const bonus = 1 + (partySize - 1) * 0.05  // 5% bonus per extra member, smaller than pooling
  for (const [k, v] of Object.entries(gate.statRewards)) {
    gains[k as StatKey] = Math.round((v as number) * bonus)
  }
  return gains
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  // Auth: verify caller's JWT
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'Missing authorization header' }, 401)

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const db = createClient(supabaseUrl, serviceRoleKey)

  let body: GateRequest
  try {
    body = await req.json() as GateRequest
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { gate_id, participant_ids } = body

  if (!gate_id || !participant_ids?.length) {
    return json({ error: 'gate_id and participant_ids are required' }, 400)
  }

  // Host must be one of the participants
  if (!participant_ids.includes(user.id)) {
    return json({ error: 'Host must be a participant' }, 403)
  }

  // Validate gate exists
  const gate = GATE_DEFINITIONS[gate_id]
  if (!gate) return json({ error: `Unknown gate: ${gate_id}` }, 400)

  // Limit party size
  if (participant_ids.length > 4) {
    return json({ error: 'Maximum party size is 4' }, 400)
  }

  // Verify all participants are in the same party (accepted invites)
  // For multi-player: each non-host must have an accepted invite with the host
  const nonHostIds = participant_ids.filter(id => id !== user.id)
  if (nonHostIds.length > 0) {
    const { data: connections } = await db
      .from('party_invites')
      .select('from_player_id, to_player_id')
      .eq('status', 'accepted')
      .or(
        nonHostIds.map(id =>
          `and(from_player_id.eq.${user.id},to_player_id.eq.${id}),and(from_player_id.eq.${id},to_player_id.eq.${user.id})`
        ).join(',')
      )

    const connectedIds = new Set(
      (connections ?? []).flatMap(c => [c.from_player_id, c.to_player_id])
    )
    const unconnected = nonHostIds.filter(id => !connectedIds.has(id))
    if (unconnected.length > 0) {
      return json({ error: 'All participants must be party members' }, 403)
    }
  }

  // Fetch all participants' live stats + distance from DB
  const { data: players, error: playersError } = await db
    .from('players')
    .select('id, stats, total_distance_km, cleared_dungeon_ids')
    .in('id', participant_ids)

  if (playersError || !players || players.length !== participant_ids.length) {
    return json({ error: 'Could not fetch all participant data' }, 500)
  }

  // Validate: host meets min distance requirement (other members don't have to)
  const host = players.find(p => p.id === user.id)
  if (!host || (host.total_distance_km as number) < gate.minDistanceKm) {
    return json({
      error: `Host needs ${gate.minDistanceKm}km total distance to open this gate`,
    }, 403)
  }

  // Pool stats from all participants
  const allStats = players.map(p => p.stats as Stats)
  const pooled = poolStats(allStats)

  // Resolve outcome
  const seed = Date.now()
  const winProb = calcWinProb(gate, pooled)
  const won = resolveOutcome(winProb, seed)

  // Build per-player outcomes
  const statGains = won ? calcStatGains(gate, players.length) : {}
  const outcomes: PlayerOutcome[] = players.map(p => ({
    player_id: p.id as string,
    stat_gains: statGains,
    won,
  }))

  // Apply rewards to all participants if won
  if (won) {
    for (const player of players) {
      const currentStats = player.stats as Stats
      const newStats: Stats = { ...currentStats }
      for (const [k, v] of Object.entries(statGains)) {
        const key = k as StatKey
        newStats[key] = (newStats[key] ?? 0) + (v as number)
      }
      const clearedIds = (player.cleared_dungeon_ids as string[]) ?? []
      const newCleared = clearedIds.includes(gate_id)
        ? clearedIds
        : [...clearedIds, gate_id]

      await db
        .from('players')
        .update({ stats: newStats, cleared_dungeon_ids: newCleared })
        .eq('id', player.id)
    }
  }

  // Record the session
  const sessionPayload = {
    gate_id,
    host_id: user.id,
    participant_ids,
    status: won ? 'resolved' : 'failed',
    pooled_stats: pooled,
    win_probability: winProb,
    outcome: { won, stat_gains: statGains, outcomes },
  }

  const { data: session } = await db
    .from('co_op_sessions')
    .insert(sessionPayload)
    .select('id')
    .single()

  const response: GateResponse = {
    session_id: session?.id ?? '',
    gate_id,
    won,
    win_probability: winProb,
    pooled_stats: pooled,
    participant_count: players.length,
    outcomes,
  }

  return json(response)
})
