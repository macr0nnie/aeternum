// =============================================================================
// Aeternum — Types
// =============================================================================
// Single source of truth for all TypeScript types across the project.
// Client types mirror the Supabase schema exactly so that database rows
// can be cast directly without transformation.
// =============================================================================

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type StatKey = 'ATK' | 'SPD' | 'INT' | 'LCK' | 'DEF' | 'END' | 'PER' | 'CHA'

export interface Stats {
  ATK: number
  SPD: number
  INT: number
  LCK: number
  DEF: number
  END: number
  PER: number
  CHA: number
}

export const STAT_KEYS: StatKey[] = ['ATK', 'SPD', 'INT', 'LCK', 'DEF', 'END', 'PER', 'CHA']

export const STAT_LABELS: Record<StatKey, string> = {
  ATK: 'Attack',
  SPD: 'Speed',
  INT: 'Intellect',
  LCK: 'Luck',
  DEF: 'Defence',
  END: 'Endurance',
  PER: 'Perception',
  CHA: 'Charisma',
}

export const STAT_SOURCES: Record<StatKey, string> = {
  ATK: 'Boss kills',
  SPD: 'Sprint sessions',
  INT: 'Arcane quests',
  LCK: 'Harvest quests',
  DEF: 'Party runs',
  END: 'Long runs',
  PER: 'Exploration (Phase 2)',
  CHA: 'Party leadership',
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

export type Element =
  | 'fire'
  | 'water'
  | 'nature'
  | 'arcane'
  | 'shadow'
  | 'frost'
  | 'earth'
  | 'harvest'
  | 'forge'
  | 'mending'

export const ELEMENTS: Element[] = [
  'fire', 'water', 'nature', 'arcane', 'shadow',
  'frost', 'earth', 'harvest', 'forge', 'mending',
]

export const ELEMENT_LABELS: Record<Element, string> = {
  fire: 'Fire',
  water: 'Water',
  nature: 'Nature',
  arcane: 'Arcane',
  shadow: 'Shadow',
  frost: 'Frost',
  earth: 'Earth',
  harvest: 'Harvest',
  forge: 'Forge',
  mending: 'Mending',
}

// ---------------------------------------------------------------------------
// Rank
// ---------------------------------------------------------------------------

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'Sovereign'

export const RANKS: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S', 'Sovereign']

export const RANK_DISTANCE_THRESHOLDS: Record<Rank, number> = {
  E: 0,
  D: 50,
  C: 150,
  B: 350,
  A: 750,
  S: 1500,
  Sovereign: 3000,
}

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export type RewardType = 'gear' | 'scroll' | 'consumable' | 'material'

export interface Reward {
  id: string
  name: string
  rarity: Rarity
  type: RewardType
}

// ---------------------------------------------------------------------------
// Run session
// ---------------------------------------------------------------------------

export type RunMode = 'sync' | 'exploration'

export interface RunSession {
  id: string
  player_id: string
  mode: RunMode
  distance_km: number
  duration_seconds: number
  steps: number
  avg_heart_rate: number | null
  started_at: string
  ended_at: string
  rewards: Reward[] | null
  stat_gains: Partial<Stats> | null
  validated: boolean
  flag_reason: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface Player {
  id: string
  username: string
  rank: Rank
  total_distance_km: number
  primary_element: Element | null
  secondary_element: Element | null
  stats: Stats
  title: string
  title_chronicle: string[]
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Health Connect raw data
// ---------------------------------------------------------------------------

export interface HealthConnectSession {
  startTime: string
  endTime: string
  distanceMeters: number
  steps: number
  avgHeartRateBpm: number | null
}

// ---------------------------------------------------------------------------
// Sync pipeline
// ---------------------------------------------------------------------------

export interface SyncRunRequest {
  player_id: string
  mode: RunMode
  distance_km: number
  duration_seconds: number
  steps: number
  avg_heart_rate?: number
  started_at: string
  ended_at: string
}

export interface SyncRunResponse {
  run_id: string
  validated: boolean
  rewards: Reward[]
  stat_gains: Partial<Stats>
  flag_reason?: string
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------

export type PartyRole = 'leader' | 'member'

export interface PartyMember {
  player_id: string
  username: string
  rank: Rank
  primary_element: Element | null
  role: PartyRole
  run_completed: boolean
}

export interface Party {
  id: string
  name: string
  members: PartyMember[]
  required_distance_km: number
  target_rank: 'B' | 'A' | 'S'
  created_at: string
}

// ---------------------------------------------------------------------------
// Dungeon tiers
// ---------------------------------------------------------------------------

export interface DungeonTier {
  rank: 'B' | 'A' | 'S'
  label: string
  minDistanceKm: number
  minPlayers: number
  maxPlayers: number
  rewardRarity: Rarity
}

export const DUNGEON_TIERS: DungeonTier[] = [
  { rank: 'B', label: 'Rank B Dungeon', minDistanceKm: 5, minPlayers: 1, maxPlayers: 4, rewardRarity: 'rare' },
  { rank: 'A', label: 'Rank A Dungeon', minDistanceKm: 8.5, minPlayers: 2, maxPlayers: 4, rewardRarity: 'rare' },
  { rank: 'S', label: 'Rank S Raid', minDistanceKm: 15, minPlayers: 5, maxPlayers: 8, rewardRarity: 'legendary' },
]

// ---------------------------------------------------------------------------
// Type matchup (10×10 PvP chart — resolved server-side)
// ---------------------------------------------------------------------------
// Values: 2 = super effective, 1 = normal, 0.5 = not very effective, 0 = immune
// Row = attacker element, column = defender element.
// This is stored client-side only for display purposes; actual PvP resolution
// always happens in an Edge Function.

export const TYPE_MATCHUP_CHART: Record<Element, Record<Element, number>> = {
  fire:    { fire: 0.5, water: 0.5, nature: 2, arcane: 1, shadow: 1, frost: 2, earth: 1, harvest: 2, forge: 2, mending: 1 },
  water:   { fire: 2, water: 0.5, nature: 0.5, arcane: 1, shadow: 1, frost: 0.5, earth: 2, harvest: 1, forge: 2, mending: 1 },
  nature:  { fire: 0.5, water: 2, nature: 0.5, arcane: 1, shadow: 0, frost: 1, earth: 2, harvest: 1, forge: 0.5, mending: 2 },
  arcane:  { fire: 1, water: 1, nature: 1, arcane: 1, shadow: 2, frost: 1, earth: 0.5, harvest: 0.5, forge: 1, mending: 2 },
  shadow:  { fire: 1, water: 1, nature: 2, arcane: 0.5, shadow: 0, frost: 1, earth: 1, harvest: 2, forge: 0.5, mending: 0.5 },
  frost:   { fire: 0.5, water: 0.5, nature: 2, arcane: 1, shadow: 1, frost: 0.5, earth: 1, harvest: 2, forge: 0.5, mending: 1 },
  earth:   { fire: 1, water: 0.5, nature: 0.5, arcane: 2, shadow: 1, frost: 2, earth: 1, harvest: 1, forge: 2, mending: 0.5 },
  harvest: { fire: 0.5, water: 1, nature: 1, arcane: 0.5, shadow: 0.5, frost: 1, earth: 1, harvest: 0.5, forge: 0.5, mending: 2 },
  forge:   { fire: 0.5, water: 0.5, nature: 2, arcane: 1, shadow: 1, frost: 2, earth: 0.5, harvest: 2, forge: 0.5, mending: 1 },
  mending: { fire: 1, water: 1, nature: 0.5, arcane: 0.5, shadow: 2, frost: 1, earth: 2, harvest: 0.5, forge: 1, mending: 0.5 },
}

// ---------------------------------------------------------------------------
// Distance tiers (for UI display)
// ---------------------------------------------------------------------------

export interface DistanceTier {
  minKm: number
  maxKm: number
  label: string
  rarity: Rarity
  encounterLabel: string
}

export const DISTANCE_TIERS: DistanceTier[] = [
  { minKm: 0, maxKm: 2, label: 'Threshold I', rarity: 'common', encounterLabel: 'Minor Encounter' },
  { minKm: 2, maxKm: 5, label: 'Threshold II', rarity: 'uncommon', encounterLabel: 'Elite Encounter' },
  { minKm: 5, maxKm: 8.5, label: 'Threshold III', rarity: 'rare', encounterLabel: 'Rank B Dungeon' },
  { minKm: 8.5, maxKm: 15, label: 'Threshold IV', rarity: 'rare', encounterLabel: 'Rank A Dungeon' },
  { minKm: 15, maxKm: Infinity, label: 'Threshold V', rarity: 'legendary', encounterLabel: 'Rank S Raid' },
]
