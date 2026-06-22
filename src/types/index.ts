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
  END: 'Stamina',
  PER: 'Perception',
  CHA: 'Charisma',
}

// Max map-action stamina derived from the Stamina (END) stat.
export const STAMINA_BASE = 50
export const STAMINA_PER_POINT = 5
export function maxStamina(staminaStat: number): number {
  return STAMINA_BASE + staminaStat * STAMINA_PER_POINT
}

// Stamina cost per map action.
export const STAMINA_COSTS = {
  harvest: 5,
  raid: 15,
  claim: 25,
  capture: 30,
} as const

// Stamina restored per km run (applied on sync).
export const STAMINA_PER_KM = 20

export const STAT_SOURCES: Record<StatKey, string> = {
  ATK: 'Boss kills',
  SPD: 'Sprint sessions',
  INT: 'Arcane quests',
  LCK: 'Harvest quests',
  DEF: 'Party runs',
  END: 'Long runs · powers map Stamina',
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
  | 'wind'
  | 'lightning'
  | 'holy'

export const ELEMENTS: Element[] = [
  'fire', 'water', 'nature', 'arcane', 'shadow',
  'frost', 'earth', 'wind', 'lightning', 'holy',
]

export const ELEMENT_LABELS: Record<Element, string> = {
  fire:      'Fire',
  water:     'Water',
  nature:    'Nature',
  arcane:    'Arcane',
  shadow:    'Shadow',
  frost:     'Frost',
  earth:     'Earth',
  wind:      'Wind',
  lightning: 'Lightning',
  holy:      'Holy',
}

// Element icons now live in ELEMENT_ICONS (MaterialCommunityIcons names) further
// down this file, rendered via <Icon name={...}> from src/components/UI.

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

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic'

// ---------------------------------------------------------------------------
// Rewards (run drop — lightweight reference)
// ---------------------------------------------------------------------------

export type RewardType = 'gear' | 'scroll' | 'consumable' | 'material' | 'core'

export interface Reward {
  id: string
  name: string
  rarity: Rarity
  type: RewardType
}

// ---------------------------------------------------------------------------
// Gear system (4 equip slots)
// ---------------------------------------------------------------------------

export type GearSlot = 'weapon' | 'armor' | 'ring' | 'relic'

export interface GearItem {
  id: string
  name: string
  slot: GearSlot
  rarity: Rarity
  element: Element | null
  statBonuses: Partial<Stats>
  setTag?: string          // e.g. "Shadowwalker" — 2/4-piece bonus
  requiredRank?: Rank
  flavor: string
  instanceId?: string      // unique per-drop instance so duplicates stack separately
}

/**
 * Safely read a gear item's stat bonuses. Persisted/older or partially-built
 * gear can lack `statBonuses` at runtime despite the type, which makes
 * `Object.entries(item.statBonuses)` throw. Always read through this.
 */
export function gearStatBonuses(item: { statBonuses?: Partial<Stats> } | null | undefined): Partial<Stats> {
  return item?.statBonuses ?? {}
}

export interface Relic {
  id: string
  name: string
  rarity: Rarity
  passiveEffect: string    // human-readable description
  statBonus?: Partial<Stats>
  triggerCondition?: string
  dropSource: string
  flavor: string
}

export interface GearLoadout {
  weapon: GearItem | null
  armor:  GearItem | null
  ring:   GearItem | null
  relic:  Relic | null
}

// ---------------------------------------------------------------------------
// Materials + consumables (inventory items)
// ---------------------------------------------------------------------------

export interface MaterialItem {
  id: string
  name: string
  rarity: Rarity
  dropSource: string       // which dungeon / monster drops this
  flavor: string
}

export type ConsumableEffect =
  | { type: 'stat_multiplier'; statKey: StatKey; multiplier: number }
  | { type: 'drop_bonus'; extraRolls: number }
  | { type: 'defeat_shield' }        // negate stat loss on defeat once
  | { type: 'stat_flat'; statKey: StatKey; amount: number }

export interface ConsumableItem {
  id: string
  name: string
  rarity: Rarity
  effect: ConsumableEffect
  description: string
  flavor: string
}

// ---------------------------------------------------------------------------
// Crafting recipes
// ---------------------------------------------------------------------------

export type RecipeCategory = 'forge' | 'brew'

export interface RecipeIngredient {
  itemId: string           // MaterialItem or ConsumableItem id
  quantity: number
}

export interface CraftRecipe {
  id: string
  category: RecipeCategory
  name: string             // display name (output item name)
  outputId: string         // GearItem.id or ConsumableItem.id
  outputType: 'gear' | 'consumable'
  outputQuantity: number
  ingredients: RecipeIngredient[]
  requiredRank?: Rank
  flavor: string
}

// ---------------------------------------------------------------------------
// Player inventory (stored as JSONB on players table)
// ---------------------------------------------------------------------------

export interface PlayerInventory {
  gear:        GearItem[]
  materials:   Record<string, number>   // materialId → quantity
  consumables: Record<string, number>   // consumableId → quantity
  relics:      Relic[]
}

export const EMPTY_INVENTORY: PlayerInventory = {
  gear: [],
  materials: {},
  consumables: {},
  relics: [],
}

export const EMPTY_LOADOUT: GearLoadout = {
  weapon: null,
  armor: null,
  ring: null,
  relic: null,
}

// ---------------------------------------------------------------------------
// Hidden talents — passive abilities unlocked by meeting secret conditions
// ---------------------------------------------------------------------------

export interface HiddenTalent {
  id: string
  name: string
  description: string
  unlockCondition: HiddenTalentCondition
  passiveEffect: string
  statBonus?: Partial<Stats>
  flavor: string
}

export type HiddenTalentCondition =
  | { type: 'stats'; requirements: Partial<Stats> }
  | { type: 'distance'; km: number }
  | { type: 'dungeon_combo'; dungeonIds: string[] }
  | { type: 'element_mastery'; element: Element; minStat: number }

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

// A summary of the most recently synced run — the raw activity metrics read
// from HealthKit/Health Connect, kept on the client for display (the server
// response only returns resolved rewards/stats, not these source numbers).
export interface RunSummary {
  distance_km: number
  duration_seconds: number
  steps: number
  avg_heart_rate: number | null
  ended_at: string
}

// ---------------------------------------------------------------------------
// Co-op rift
// ---------------------------------------------------------------------------

export interface CoOpPlayerOutcome {
  player_id: string
  stat_gains: Partial<Stats>
  won: boolean
}

export interface CoOpGateResponse {
  session_id: string
  gate_id: string
  won: boolean
  win_probability: number
  pooled_stats: Stats
  participant_count: number
  outcomes: CoOpPlayerOutcome[]
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
  //            fire  water nature arcane shadow frost earth  wind  light  holy
  fire:      { fire:0.5, water:0.5, nature:2,   arcane:1,   shadow:1,   frost:2,   earth:1,   wind:1,   lightning:0.5, holy:1   },
  water:     { fire:2,   water:0.5, nature:0.5, arcane:1,   shadow:1,   frost:0.5, earth:2,   wind:0.5, lightning:2,   holy:1   },
  nature:    { fire:0.5, water:2,   nature:0.5, arcane:1,   shadow:0,   frost:1,   earth:2,   wind:1,   lightning:0.5, holy:2   },
  arcane:    { fire:1,   water:1,   nature:1,   arcane:1,   shadow:2,   frost:1,   earth:0.5, wind:1,   lightning:1,   holy:0.5 },
  shadow:    { fire:1,   water:1,   nature:2,   arcane:0.5, shadow:0,   frost:1,   earth:1,   wind:1,   lightning:0.5, holy:0   },
  frost:     { fire:0.5, water:0.5, nature:2,   arcane:1,   shadow:1,   frost:0.5, earth:1,   wind:2,   lightning:0.5, holy:1   },
  earth:     { fire:1,   water:0.5, nature:0.5, arcane:2,   shadow:1,   frost:2,   earth:1,   wind:0.5, lightning:2,   holy:0.5 },
  wind:      { fire:1,   water:1,   nature:1,   arcane:0.5, shadow:1,   frost:0.5, earth:2,   wind:0.5, lightning:0.5, holy:1   },
  lightning: { fire:2,   water:2,   nature:1,   arcane:1,   shadow:1,   frost:2,   earth:0.5, wind:2,   lightning:0.5, holy:1   },
  holy:      { fire:1,   water:1,   nature:0.5, arcane:0.5, shadow:2,   frost:1,   earth:1,   wind:1,   lightning:1,   holy:0.5 },
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
    description: 'Clear The Ascension Chamber.',
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
    flavor: 'Rank D adventurers rarely survive. You did.',
  },
  {
    id: 'q_rank_c_clear',
    title: 'Elite Adventurer',
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
    title: 'The Ascension',
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
// Dungeon type — determines which traits are rewarded on clear
// ---------------------------------------------------------------------------

export type DungeonType = 'explorer' | 'conquest' | 'gathering' | 'endurance' | 'general'

export const DUNGEON_TYPE_LABELS: Record<DungeonType, string> = {
  explorer:  'Explorer',
  conquest:  'Conquest',
  gathering: 'Gathering',
  endurance: 'Endurance',
  general:   'General',
}

// MaterialCommunityIcons glyph names — rendered via <Icon name={...}> in UI.tsx.
export const DUNGEON_TYPE_ICONS: Record<DungeonType, string> = {
  explorer:  'map',
  conquest:  'flag',
  gathering: 'pickaxe',
  endurance: 'run',
  general:   'sword-cross',
}

// ---------------------------------------------------------------------------
// Trait system — behavioral fingerprint; separate from combat stats
// ---------------------------------------------------------------------------

export type TraitKey = 'endurance' | 'strength' | 'exploration' | 'conquest' | 'gathering' | 'consistency' | 'mastery'

export const TRAIT_KEYS: TraitKey[] = ['endurance', 'strength', 'exploration', 'conquest', 'gathering', 'consistency', 'mastery']

export interface PlayerTraits {
  endurance:   number
  strength:    number
  exploration: number
  conquest:    number
  gathering:   number
  consistency: number
  mastery:     number
}

export const EMPTY_TRAITS: PlayerTraits = {
  endurance: 0, strength: 0, exploration: 0,
  conquest: 0, gathering: 0, consistency: 0, mastery: 0,
}

export const TRAIT_LABELS: Record<TraitKey, string> = {
  endurance:   'Endurance',
  strength:    'Strength',
  exploration: 'Exploration',
  conquest:    'Conquest',
  gathering:   'Gathering',
  consistency: 'Consistency',
  mastery:     'Mastery',
}

// MaterialCommunityIcons glyph names — rendered via <Icon name={...}> in UI.tsx.
export const TRAIT_ICONS: Record<TraitKey, string> = {
  endurance:   'run',
  strength:    'sword-cross',
  exploration: 'map',
  conquest:    'flag',
  gathering:   'pickaxe',
  consistency: 'fire',
  mastery:     'star',
}

export const TRAIT_SOURCES: Record<TraitKey, string> = {
  endurance:   'Long runs · Endurance dungeons',
  strength:    'High-rank dungeons · Conquest dungeons',
  exploration: 'Scanning map · Claiming territories',
  conquest:    'Claiming territories · Conquest dungeons',
  gathering:   'Harvesting resources · Gathering dungeons',
  consistency: 'Daily runs · Streaks',
  mastery:     'Repeat dungeon clears · Specialisation',
}

// ---------------------------------------------------------------------------
// Archetype system — discovered through behavior, not selected
// ---------------------------------------------------------------------------

export type ArchetypeId = 'pathfinder' | 'vanguard' | 'quartermaster' | 'sentinel' | 'cartographer'

export interface ArchetypeTierDef {
  rank: number
  name: string
  traitThresholds: Partial<PlayerTraits>
}

export interface ArchetypeDefinition {
  id: ArchetypeId
  primaryTraits: [TraitKey, TraitKey]
  description: string
  tiers: ArchetypeTierDef[]
}

export interface ActiveArchetype {
  id: ArchetypeId
  rank: number
}

// ---------------------------------------------------------------------------
// Dungeon entries (stat-gated, no active combat — stat-check based)
// ---------------------------------------------------------------------------

export interface DungeonEntry {
  id: string
  name: string
  rank: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
  dungeonType: DungeonType
  description: string
  statRequirements: Partial<Stats>
  rewardRarity: Rarity
  statRewards: Partial<Stats>
  traitRewards: Partial<PlayerTraits>
  flavor: string
  minDistanceKm: number
}

export const DUNGEON_ENTRIES: DungeonEntry[] = [
  {
    id: 'd_awakening',
    name: 'The Ascension Chamber',
    rank: 'F',
    dungeonType: 'general',
    description: 'A crumbling ruin pulsing with residual mana. Entry-level rift.',
    statRequirements: {},
    rewardRarity: 'common',
    statRewards: { ATK: 1, END: 1 },
    traitRewards: { strength: 1 },
    flavor: 'Every adventurer remembers their first rift.',
    minDistanceKm: 0,
  },
  {
    id: 'd_goblin',
    name: "Goblin's Warren",
    rank: 'E',
    dungeonType: 'conquest',
    description: 'Tunnels overrun by low-rank monsters.',
    statRequirements: { ATK: 3 },
    rewardRarity: 'common',
    statRewards: { ATK: 2, SPD: 1 },
    traitRewards: { conquest: 3, strength: 2 },
    flavor: 'Weak alone. Dangerous in swarms.',
    minDistanceKm: 2,
  },
  {
    id: 'd_catacombs',
    name: 'Crumbling Catacombs',
    rank: 'E',
    dungeonType: 'endurance',
    description: 'Ancient burial ground. The dead do not rest here.',
    statRequirements: { END: 5 },
    rewardRarity: 'common',
    statRewards: { END: 2, DEF: 1 },
    traitRewards: { endurance: 4, consistency: 1 },
    flavor: 'Survival, not strength, is the key.',
    minDistanceKm: 2,
  },
  {
    id: 'd_crystal',
    name: 'Crystal Caverns',
    rank: 'D',
    dungeonType: 'gathering',
    description: 'Labyrinthine caves where mana crystallises into monsters.',
    statRequirements: { ATK: 8, DEF: 5 },
    rewardRarity: 'uncommon',
    statRewards: { ATK: 3, INT: 2 },
    traitRewards: { gathering: 4, mastery: 2 },
    flavor: 'Light bends strangely underground.',
    minDistanceKm: 5,
  },
  {
    id: 'd_storm',
    name: 'Storm Gauntlet',
    rank: 'D',
    dungeonType: 'endurance',
    description: 'A sky rift. Constant lightning. Speed is the only defence.',
    statRequirements: { SPD: 8, END: 8 },
    rewardRarity: 'uncommon',
    statRewards: { SPD: 3, END: 2 },
    traitRewards: { endurance: 5, strength: 2 },
    flavor: 'The storm does not care about your rank.',
    minDistanceKm: 5,
  },
  {
    id: 'd_shadow',
    name: 'Shadow Sanctum',
    rank: 'C',
    dungeonType: 'explorer',
    description: 'A void rift where light itself has been consumed.',
    statRequirements: { ATK: 15, INT: 10 },
    rewardRarity: 'rare',
    statRewards: { ATK: 4, INT: 3 },
    traitRewards: { exploration: 4, mastery: 3 },
    flavor: 'You cannot fight what you cannot see.',
    minDistanceKm: 10,
  },
  {
    id: 'd_fortress',
    name: 'Iron Fortress',
    rank: 'C',
    dungeonType: 'conquest',
    description: 'A military installation overrun by armored constructs.',
    statRequirements: { DEF: 15, END: 12 },
    rewardRarity: 'rare',
    statRewards: { DEF: 4, END: 3 },
    traitRewards: { conquest: 5, strength: 3 },
    flavor: 'The walls do not bleed. You might.',
    minDistanceKm: 10,
  },
  {
    id: 'd_abyss',
    name: 'Abyssal Rift',
    rank: 'B',
    dungeonType: 'conquest',
    description: 'A tear in reality. The strongest monsters live here.',
    statRequirements: { ATK: 20, SPD: 15, INT: 15 },
    rewardRarity: 'rare',
    statRewards: { ATK: 5, SPD: 3, INT: 3 },
    traitRewards: { conquest: 7, strength: 5, mastery: 2 },
    flavor: 'Beyond the rift, the rules change.',
    minDistanceKm: 20,
  },
  {
    id: 'd_dragon',
    name: "Dragon's Throne",
    rank: 'A',
    dungeonType: 'conquest',
    description: "An ancient dragon's domain. Pure power. No shortcuts.",
    statRequirements: { ATK: 25, DEF: 20, END: 20, SPD: 15, INT: 15 },
    rewardRarity: 'rare',
    statRewards: { ATK: 5, DEF: 4, END: 4, SPD: 3, INT: 3 },
    traitRewards: { strength: 8, conquest: 5, mastery: 3, endurance: 2 },
    flavor: 'Dragons do not negotiate.',
    minDistanceKm: 50,
  },
  {
    id: 'd_sovereign',
    name: "Grandmaster's Rift",
    rank: 'S',
    dungeonType: 'general',
    description: 'The apex dungeon. Only the sovereign-ranked survive.',
    statRequirements: { ATK: 40, DEF: 35, END: 35, SPD: 30, INT: 30, LCK: 20, CHA: 20, PER: 20 },
    rewardRarity: 'legendary',
    statRewards: { ATK: 10, DEF: 8, END: 8, SPD: 6, INT: 6, LCK: 4, CHA: 4, PER: 4 },
    traitRewards: { mastery: 10, strength: 7, conquest: 5, endurance: 5 },
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

// ---------------------------------------------------------------------------
// Territory system
// ---------------------------------------------------------------------------

export type ResourceType = 'iron' | 'crystal' | 'mana' | 'herbs' | 'gold'

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  iron: 'Iron Ore',
  crystal: 'Crystal Shard',
  mana: 'Mana Essence',
  herbs: 'Spirit Herb',
  gold: 'Gold Dust',
}

// MaterialCommunityIcons glyph names — rendered via <Icon name={...}> in UI.tsx.
export const RESOURCE_ICONS: Record<ResourceType, string> = {
  iron: 'cog',
  crystal: 'rhombus',
  mana: 'star-four-points',
  herbs: 'leaf',
  gold: 'rhombus-medium',
}

// ---------------------------------------------------------------------------
// Territory upgrades — level rifts which node resource types can be harvested.
// Upgrade a territory (spending harvested resources) to unlock rarer nodes.
// ---------------------------------------------------------------------------

export const TERRITORY_MAX_LEVEL = 5

// Resource types unlocked AT each territory level (cumulative with lower levels).
const TERRITORY_LEVEL_UNLOCKS: Record<number, ResourceType[]> = {
  1: ['iron', 'herbs'],
  2: ['gold'],
  3: ['crystal'],
  4: [],          // L4 is a power level (richness/yield headroom) — no new type
  5: ['mana'],    // rarest
}

// All resource types a territory of the given level can harvest.
export function unlockedResourceTypes(territoryLevel: number): ResourceType[] {
  const out: ResourceType[] = []
  for (let lvl = 1; lvl <= territoryLevel; lvl++) {
    out.push(...(TERRITORY_LEVEL_UNLOCKS[lvl] ?? []))
  }
  return out
}

// Can a territory of `territoryLevel` harvest a node of `type`?
export function canHarvestType(territoryLevel: number, type: ResourceType): boolean {
  return unlockedResourceTypes(territoryLevel).includes(type)
}

// The minimum territory level required to harvest a given resource type.
export function levelRequiredFor(type: ResourceType): number {
  for (let lvl = 1; lvl <= TERRITORY_MAX_LEVEL; lvl++) {
    if ((TERRITORY_LEVEL_UNLOCKS[lvl] ?? []).includes(type)) return lvl
  }
  return TERRITORY_MAX_LEVEL
}

// Cost to upgrade a territory FROM `currentLevel` to currentLevel+1.
// Paid in harvested resources — creates a gather → upgrade → gather-rarer loop.
export function territoryUpgradeCost(currentLevel: number): Partial<PlayerResources> {
  switch (currentLevel) {
    case 1: return { iron: 20, herbs: 10 }
    case 2: return { iron: 40, gold: 15 }
    case 3: return { gold: 30, crystal: 20 }
    case 4: return { crystal: 40, gold: 50 }
    default: return {}   // L5 = max
  }
}

export interface Territory {
  id: string
  owner_id: string
  owner_username?: string
  lat: number
  lng: number
  name: string
  level: number
  health: number
  max_health: number
  created_at: string
}

// Max HP scales with territory level.
export function territoryMaxHealth(level: number): number {
  return 100 + (level - 1) * 50   // L1=100, L2=150 … L5=300
}

// Defense rating shown to the player — owner DEF/END + level + walls bonus.
export function territoryDefense(
  ownerStats: Partial<Stats> | undefined,
  level: number,
  wallsLevel = 0,
): number {
  const def = ownerStats?.DEF ?? 0
  const end = ownerStats?.END ?? 0
  return Math.round(def * 1.5 + end + level * 20 + wallsLevel * 15)
}

// Cost to repair a territory back to full, scaled by missing HP. Paid in resources.
export function territoryRepairCost(territory: Pick<Territory, 'health' | 'max_health'>): Partial<PlayerResources> {
  const missing = Math.max(0, territory.max_health - territory.health)
  if (missing === 0) return {}
  // 1 iron per 5 HP, 1 gold per 20 HP missing (rounded up).
  return {
    iron: Math.ceil(missing / 5),
    gold: Math.ceil(missing / 20),
  }
}

export interface ResourceNode {
  id: string
  territory_id: string | null
  lat: number
  lng: number
  resource_type: ResourceType
  richness: number
  last_harvested_at: string | null
  last_harvested_by: string | null
}

export interface TerritoryAttack {
  id: string
  attacker_id: string
  defender_id: string
  territory_id: string
  outcome: 'win' | 'loss'
  atk_power: number
  def_power: number
  created_at: string
}

export interface PlayerResources {
  influence: number
  iron: number
  crystal: number
  mana: number
  herbs: number
  gold: number
}

export const EMPTY_RESOURCES: PlayerResources = {
  influence: 0, iron: 0, crystal: 0, mana: 0, herbs: 0, gold: 0,
}

// ---------------------------------------------------------------------------
// Player Skills — active/passive abilities unlocked via gameplay
// ---------------------------------------------------------------------------

export type SkillKind = 'player' | 'base'
export type SkillActivation = 'active' | 'passive'

// Shared element icon map — single source of truth used across all screens.
// MaterialCommunityIcons glyph names — rendered via <Icon name={...}> in UI.tsx.
export const ELEMENT_ICONS: Record<Element, string> = {
  fire:      'fire',
  water:     'water',
  nature:    'sprout',
  arcane:    'auto-fix',
  shadow:    'weather-night',
  frost:     'snowflake',
  earth:     'terrain',
  wind:      'weather-windy',
  lightning: 'flash',
  holy:      'white-balance-sunny',
}

export interface PlayerSkill {
  id: string
  name: string
  kind: SkillKind
  activation: SkillActivation
  element: Element | null
  description: string
  effect: string
  rarity: Rarity
  flavor: string
  icon: string
  manaCost?: number    // active skills only — deducted from mana resource on use
  staminaCost?: number // optional stamina cost (future)
}

// Player skills — unlocked through runs, dungeons, rewards
export const PLAYER_SKILLS: PlayerSkill[] = [
  { id: 'sk_shadow_step',    name: 'Shadow Step',     kind: 'player', activation: 'active',  element: 'shadow',    manaCost: 30, description: 'Dash through shadows instantly.',         effect: '+15% SPD for next rift',            rarity: 'uncommon', flavor: 'Between blinks, I was gone.',              icon: 'weather-night' },
  { id: 'sk_iron_skin',      name: 'Iron Skin',       kind: 'player', activation: 'passive', element: 'earth',                  description: 'Harden your body against physical hits.', effect: '+10 DEF permanently',               rarity: 'common',   flavor: 'Hammered by miles, hardened by will.',     icon: 'shield' },
  { id: 'sk_flame_strike',   name: 'Flame Strike',    kind: 'player', activation: 'active',  element: 'fire',      manaCost: 45, description: 'Ignite your weapon with mana fire.',      effect: '+20% ATK vs frost/nature rifts',    rarity: 'rare',     flavor: 'Everything burns if you run hot enough.',  icon: 'fire' },
  { id: 'sk_arcane_insight', name: 'Arcane Insight',  kind: 'player', activation: 'passive', element: 'arcane',                 description: 'Read the rift before entering.',          effect: '+5% win probability on all rifts',  rarity: 'uncommon', flavor: 'Knowledge is the sharpest weapon.',        icon: 'crystal-ball' },
  { id: 'sk_wind_dash',      name: 'Wind Dash',       kind: 'player', activation: 'active',  element: 'wind',      manaCost: 20, description: 'Burst of pure speed.',                    effect: '+20% SPD this run',                 rarity: 'common',   flavor: 'The wind does not wait.',                  icon: 'weather-tornado' },
  { id: 'sk_holy_mend',      name: 'Holy Mending',    kind: 'player', activation: 'passive', element: 'holy',                   description: 'Recover stats after rift defeat.',        effect: 'Recover 50% stat loss after loss',  rarity: 'rare',     flavor: 'Light heals what darkness breaks.',        icon: 'shimmer' },
  { id: 'sk_void_sight',     name: 'Void Sight',      kind: 'player', activation: 'passive', element: 'shadow',                 description: 'See through darkness and illusions.',     effect: '+10 PER permanently',               rarity: 'rare',     flavor: 'The void reveals all truths.',             icon: 'eye' },
  { id: 'sk_battle_cry',     name: 'Battle Cry',      kind: 'player', activation: 'active',  element: null,        manaCost: 35, description: 'Rally the party before a rift.',          effect: '+15% all stats for co-op rifts',    rarity: 'uncommon', flavor: 'One voice can move an army.',              icon: 'sword-cross' },
]

// Base skills — equipped to fortress defense slots
export const BASE_SKILLS: PlayerSkill[] = [
  { id: 'bsk_iron_golem',    name: 'Iron Golem',      kind: 'base', activation: 'passive', element: 'earth',     description: 'A construct that guards your territory.',    effect: '+20 DEF to fortress',               rarity: 'common',   flavor: 'Stone and steel do not sleep.',             icon: 'robot' },
  { id: 'bsk_holy_ward',     name: 'Holy Ward',       kind: 'base', activation: 'passive', element: 'holy',      description: 'Sacred barrier that heals the base.',        effect: 'Restore 10 DEF/day passively',      rarity: 'uncommon', flavor: 'Where light falls, darkness cannot hold.',  icon: 'shimmer' },
  { id: 'bsk_shadow_ward',   name: 'Shadow Ward',     kind: 'base', activation: 'passive', element: 'shadow',    description: 'Obscures your territory from detection.',   effect: '-25% chance to be targeted',        rarity: 'rare',     flavor: 'The best defence is invisibility.',         icon: 'weather-night' },
  { id: 'bsk_frost_barrier', name: 'Frost Barrier',   kind: 'base', activation: 'active',  element: 'frost',     manaCost: 25, description: 'Slows enemy attackers on contact.',   effect: '-20% attacker SPD in PvP',          rarity: 'uncommon', flavor: 'Cold stone is still stone.',                icon: 'snowflake' },
  { id: 'bsk_arcane_shield', name: 'Arcane Shield',   kind: 'base', activation: 'passive', element: 'arcane',    description: 'Magical barrier that absorbs first hit.',   effect: 'Absorb 1 attack per 24h',           rarity: 'rare',     flavor: 'Magic endures where walls crumble.',        icon: 'shield-sun' },
  { id: 'bsk_fire_trap',     name: 'Fire Trap',       kind: 'base', activation: 'active',  element: 'fire',      manaCost: 30, description: 'Burns attackers who breach the perimeter.', effect: 'Deal 15% ATK back to attacker', rarity: 'uncommon', flavor: 'Step on the flame. See what happens.',      icon: 'fire' },
]

export const ALL_SKILLS: PlayerSkill[] = [...PLAYER_SKILLS, ...BASE_SKILLS]

// ---------------------------------------------------------------------------
// Fortress crops (passive resource generation)
// ---------------------------------------------------------------------------

export type CropType = 'herb_garden' | 'iron_mine' | 'mana_pool' | 'crystal_vein' | 'gold_deposit'

export const CROP_CONFIG: Record<CropType, {
  label: string; icon: string; resource: ResourceType; yieldAmount: number; cooldownHours: number
}> = {
  herb_garden:   { label: 'Herb Garden',   icon: 'leaf',             resource: 'herbs',   yieldAmount: 5, cooldownHours: 4  },
  iron_mine:     { label: 'Iron Mine',     icon: 'pickaxe',          resource: 'iron',    yieldAmount: 8, cooldownHours: 6  },
  mana_pool:     { label: 'Mana Pool',     icon: 'star-four-points', resource: 'mana',    yieldAmount: 3, cooldownHours: 8  },
  crystal_vein:  { label: 'Crystal Vein',  icon: 'rhombus',          resource: 'crystal', yieldAmount: 2, cooldownHours: 12 },
  gold_deposit:  { label: 'Gold Deposit',  icon: 'rhombus-medium',   resource: 'gold',    yieldAmount: 1, cooldownHours: 24 },
}

export interface FortressCrop {
  id: string
  player_id: string
  slot_index: number
  crop_type: CropType
  planted_at: string
  last_harvested_at: string | null
}

// ---------------------------------------------------------------------------
// Fortress (extended)
// ---------------------------------------------------------------------------

export type FortressBuildingKey = 'barracks_level' | 'walls_level' | 'forge_level'

export interface DefenseSlot {
  slot_index: number       // 0–4
  skill_id: string | null  // references ALL_SKILLS[].id
}

export interface Fortress {
  level: number
  barracks_level: number
  walls_level: number
  forge_level: number
  element: Element | null        // null = inherits player primary_element
  defense_slots: DefenseSlot[]   // up to 5 active base skills
}

export const EMPTY_FORTRESS: Fortress = {
  level: 1, barracks_level: 0, walls_level: 0, forge_level: 0,
  element: null, defense_slots: [],
}

export interface FortressBuilding {
  key: FortressBuildingKey
  name: string
  description: string
  statBonus: string
  icon: string
  maxLevel: number
  upgradeCost: (level: number) => Partial<PlayerResources>
}

export const FORTRESS_BUILDINGS: FortressBuilding[] = [
  {
    key: 'barracks_level',
    name: 'Barracks',
    description: 'Train soldiers, increase ATK.',
    statBonus: '+2 ATK per level',
    icon: 'sword-cross',
    maxLevel: 5,
    upgradeCost: (lvl) => ({ iron: lvl * 10 + 5, gold: lvl * 5 }),
  },
  {
    key: 'walls_level',
    name: 'Fortress Walls',
    description: 'Harden your defences, increase DEF.',
    statBonus: '+2 DEF per level',
    icon: 'shield',
    maxLevel: 5,
    upgradeCost: (lvl) => ({ iron: lvl * 15, crystal: lvl * 5 }),
  },
  {
    key: 'forge_level',
    name: 'Grand Forge',
    description: 'Unlock advanced crafting recipes.',
    statBonus: '+1 craft slot per level',
    icon: 'hammer',
    maxLevel: 5,
    upgradeCost: (lvl) => ({ iron: lvl * 8, mana: lvl * 8 }),
  },
]

// ---------------------------------------------------------------------------
// Dropped rewards (for the dismissible rewards popup)
// ---------------------------------------------------------------------------

export type DropKind =
  | 'gear'
  | 'relic'
  | 'consumable'
  | 'material'
  | 'resource'
  | 'stat_gain'
  | 'skill'
  | 'base_skill'

export interface DroppedReward {
  id: string          // unique per-popup-instance (use nanoid / Date.now())
  kind: DropKind
  rarity: Rarity
  name: string
  description: string
  icon: string
  quantity?: number
  // Extra payload — present only for matching kind:
  statGains?: Partial<Stats>            // stat_gain
  skillId?: string                      // skill / base_skill
  resourceType?: ResourceType           // resource
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#6b7280',
  uncommon:  '#3ddc84',
  rare:      '#4fa8f8',
  legendary: '#ffd54f',
  mythic:    '#e11d48',
}

export const RARITY_LABELS: Record<Rarity, string> = {
  common:    'COMMON',
  uncommon:  'UNCOMMON',
  rare:      'RARE',
  legendary: 'LEGENDARY',
  mythic:    'MYTHIC',
}

// Influence cost to place a new territory
export const TERRITORY_PLACE_COST = 50
// Harvest cooldown in hours
// Influence awarded for clearing a rift, by rank. Influence is the currency
// used to claim territory — earning it through rift clears closes the loop
// (run → stats → clear rifts → influence → claim/expand territory → resources).
export const RIFT_INFLUENCE_REWARD: Record<'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S', number> = {
  F: 5, E: 8, D: 12, C: 18, B: 26, A: 35, S: 50,
}

export const HARVEST_COOLDOWN_H = 6
// Harvest range in metres
export const HARVEST_RANGE_M = 200
// Attack range from any own territory (km)
export const ATTACK_RANGE_KM = 5
