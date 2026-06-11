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
// Quest system
// ---------------------------------------------------------------------------

export type QuestCategory = 'training' | 'combat' | 'exploration' | 'special'

export interface QuestCondition {
  type: 'distance' | 'stat' | 'dungeon_clear' | 'dungeon_count' | 'auto'
  km?: number           // for 'distance'
  statKey?: StatKey     // for 'stat'
  statMin?: number      // for 'stat'
  dungeonId?: string    // for 'dungeon_clear'
  count?: number        // for 'dungeon_count'
}

export interface Quest {
  id: string
  title: string
  description: string
  category: QuestCategory
  condition: QuestCondition
  statRewards: Partial<Stats>
  flavor: string
}

export const QUESTS: Quest[] = [
  // Training
  {
    id: 'q_first_steps',
    title: 'First Steps',
    description: 'Begin your journey.',
    category: 'training',
    condition: { type: 'auto' },
    statRewards: { END: 1, CHA: 1 },
    flavor: 'Every sovereign began with a single step.',
  },
  {
    id: 'q_morning_run',
    title: 'Morning Run',
    description: 'Run a total of 2 km.',
    category: 'training',
    condition: { type: 'distance', km: 2 },
    statRewards: { END: 1, SPD: 1 },
    flavor: 'The body awakens when the sun rises.',
  },
  {
    id: 'q_long_haul',
    title: 'The Long Haul',
    description: 'Run a total of 10 km.',
    category: 'training',
    condition: { type: 'distance', km: 10 },
    statRewards: { END: 2, DEF: 1 },
    flavor: 'Endurance is forged on the long road.',
  },
  {
    id: 'q_marathon',
    title: 'Marathon Bearer',
    description: 'Run a total of 42 km.',
    category: 'training',
    condition: { type: 'distance', km: 42 },
    statRewards: { END: 3, DEF: 2, SPD: 1 },
    flavor: 'The body becomes iron after 42.',
  },
  {
    id: 'q_century',
    title: 'Century Runner',
    description: 'Run a total of 100 km.',
    category: 'training',
    condition: { type: 'distance', km: 100 },
    statRewards: { END: 5, DEF: 3, SPD: 2 },
    flavor: 'Three digits. Most never try.',
  },
  {
    id: 'q_speed_trial',
    title: 'Speed Trial',
    description: 'Reach a Speed of 5.',
    category: 'training',
    condition: { type: 'stat', statKey: 'SPD', statMin: 5 },
    statRewards: { SPD: 2, ATK: 1 },
    flavor: 'Strike before your enemy can react.',
  },
  {
    id: 'q_iron_body',
    title: 'Iron Body',
    description: 'Reach a Defence of 5.',
    category: 'training',
    condition: { type: 'stat', statKey: 'DEF', statMin: 5 },
    statRewards: { DEF: 2, END: 1 },
    flavor: 'An unbreakable body outlasts every foe.',
  },
  // Combat
  {
    id: 'q_first_dungeon',
    title: 'First Blood',
    description: 'Clear The Awakening Chamber.',
    category: 'combat',
    condition: { type: 'dungeon_clear', dungeonId: 'd_awakening' },
    statRewards: { ATK: 2, LCK: 1 },
    flavor: 'Your first kill changes everything.',
  },
  {
    id: 'q_monster_slayer',
    title: 'Monster Slayer',
    description: 'Clear 3 different dungeons.',
    category: 'combat',
    condition: { type: 'dungeon_count', count: 3 },
    statRewards: { ATK: 3, DEF: 1 },
    flavor: 'They will know your name.',
  },
  {
    id: 'q_rank_d_clear',
    title: 'Rank Up',
    description: 'Clear a Rank D dungeon.',
    category: 'combat',
    condition: { type: 'dungeon_clear', dungeonId: 'd_crystal' },
    statRewards: { ATK: 2, INT: 2 },
    flavor: 'Rank D hunters rarely survive. You did.',
  },
  {
    id: 'q_rank_c_clear',
    title: 'Elite Hunter',
    description: 'Clear a Rank C dungeon.',
    category: 'combat',
    condition: { type: 'dungeon_clear', dungeonId: 'd_shadow' },
    statRewards: { ATK: 3, INT: 2, SPD: 1 },
    flavor: 'The shadows bow to the strongest.',
  },
  // Special
  {
    id: 'q_name_path',
    title: 'Name Your Path',
    description: 'Set your commander name.',
    category: 'special',
    condition: { type: 'auto' },
    statRewards: { CHA: 2 },
    flavor: 'A name is a weapon.',
  },
  {
    id: 'q_find_element',
    title: 'The Awakening',
    description: 'Choose your element.',
    category: 'special',
    condition: { type: 'stat', statKey: 'INT', statMin: 1 },
    statRewards: { INT: 2, LCK: 2 },
    flavor: 'Your essence crystallises.',
  },
  {
    id: 'q_shadow_steps',
    title: 'Shadow Steps',
    description: 'Run a total of 50 km.',
    category: 'exploration',
    condition: { type: 'distance', km: 50 },
    statRewards: { SPD: 3, PER: 2 },
    flavor: 'You have walked further than most ever will.',
  },
]

// ---------------------------------------------------------------------------
// Dungeon entries (stat-gated, no active combat — stat-check based)
// ---------------------------------------------------------------------------

export interface DungeonEntry {
  id: string
  name: string
  rank: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
  description: string
  statRequirements: Partial<Stats>
  rewardRarity: Rarity
  statRewards: Partial<Stats>
  flavor: string
  minDistanceKm: number
}

export const DUNGEON_ENTRIES: DungeonEntry[] = [
  {
    id: 'd_awakening',
    name: 'The Awakening Chamber',
    rank: 'F',
    description: 'A crumbling ruin pulsing with residual mana. Entry-level gate.',
    statRequirements: {},
    rewardRarity: 'common',
    statRewards: { ATK: 1, END: 1 },
    flavor: 'Every hunter remembers their first gate.',
    minDistanceKm: 0,
  },
  {
    id: 'd_goblin',
    name: "Goblin's Warren",
    rank: 'E',
    description: 'Tunnels overrun by low-rank monsters.',
    statRequirements: { ATK: 3 },
    rewardRarity: 'common',
    statRewards: { ATK: 2, SPD: 1 },
    flavor: 'Weak alone. Dangerous in swarms.',
    minDistanceKm: 2,
  },
  {
    id: 'd_catacombs',
    name: 'Crumbling Catacombs',
    rank: 'E',
    description: 'Ancient burial ground. The dead do not rest here.',
    statRequirements: { END: 5 },
    rewardRarity: 'common',
    statRewards: { END: 2, DEF: 1 },
    flavor: 'Survival, not strength, is the key.',
    minDistanceKm: 2,
  },
  {
    id: 'd_crystal',
    name: 'Crystal Caverns',
    rank: 'D',
    description: 'Labyrinthine caves where mana crystallises into monsters.',
    statRequirements: { ATK: 8, DEF: 5 },
    rewardRarity: 'uncommon',
    statRewards: { ATK: 3, INT: 2 },
    flavor: 'Light bends strangely underground.',
    minDistanceKm: 5,
  },
  {
    id: 'd_storm',
    name: 'Storm Gauntlet',
    rank: 'D',
    description: 'A sky gate. Constant lightning. Speed is the only defence.',
    statRequirements: { SPD: 8, END: 8 },
    rewardRarity: 'uncommon',
    statRewards: { SPD: 3, END: 2 },
    flavor: 'The storm does not care about your rank.',
    minDistanceKm: 5,
  },
  {
    id: 'd_shadow',
    name: 'Shadow Sanctum',
    rank: 'C',
    description: 'A void gate where light itself has been consumed.',
    statRequirements: { ATK: 15, INT: 10 },
    rewardRarity: 'rare',
    statRewards: { ATK: 4, INT: 3 },
    flavor: 'You cannot fight what you cannot see.',
    minDistanceKm: 10,
  },
  {
    id: 'd_fortress',
    name: 'Iron Fortress',
    rank: 'C',
    description: 'A military installation overrun by armored constructs.',
    statRequirements: { DEF: 15, END: 12 },
    rewardRarity: 'rare',
    statRewards: { DEF: 4, END: 3 },
    flavor: 'The walls do not bleed. You might.',
    minDistanceKm: 10,
  },
  {
    id: 'd_abyss',
    name: 'Abyssal Rift',
    rank: 'B',
    description: 'A tear in reality. The strongest monsters live here.',
    statRequirements: { ATK: 20, SPD: 15, INT: 15 },
    rewardRarity: 'rare',
    statRewards: { ATK: 5, SPD: 3, INT: 3 },
    flavor: 'Beyond the rift, the rules change.',
    minDistanceKm: 20,
  },
  {
    id: 'd_dragon',
    name: "Dragon's Throne",
    rank: 'A',
    description: 'An ancient dragon\'s domain. Pure power. No shortcuts.',
    statRequirements: { ATK: 25, DEF: 20, END: 20, SPD: 15, INT: 15 },
    rewardRarity: 'rare',
    statRewards: { ATK: 5, DEF: 4, END: 4, SPD: 3, INT: 3 },
    flavor: 'Dragons do not negotiate.',
    minDistanceKm: 50,
  },
  {
    id: 'd_sovereign',
    name: "Sovereign's Gate",
    rank: 'S',
    description: 'The apex dungeon. Only the sovereign-ranked survive.',
    statRequirements: { ATK: 40, DEF: 35, END: 35, SPD: 30, INT: 30, LCK: 20, CHA: 20, PER: 20 },
    rewardRarity: 'legendary',
    statRewards: { ATK: 10, DEF: 8, END: 8, SPD: 6, INT: 6, LCK: 4, CHA: 4, PER: 4 },
    flavor: 'Here. The end of all things. The beginning of another.',
    minDistanceKm: 100,
  },
]

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
