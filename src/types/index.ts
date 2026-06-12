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

// ---------------------------------------------------------------------------
// Co-op gate
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

export const RESOURCE_ICONS: Record<ResourceType, string> = {
  iron: '⚙',
  crystal: '◈',
  mana: '✦',
  herbs: '❧',
  gold: '◆',
}

export interface Territory {
  id: string
  owner_id: string
  owner_username?: string
  lat: number
  lng: number
  name: string
  level: number
  created_at: string
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
}

export const PLAYER_SKILLS: PlayerSkill[] = [
  { id: 'sk_shadow_step',     name: 'Shadow Step',          kind: 'player', activation: 'active',  element: 'shadow',  description: 'Dash through shadows instantly.',           effect: '+15% SPD for next dungeon',         rarity: 'uncommon', flavor: 'Between blinks, I was gone.',              icon: '🌑' },
  { id: 'sk_iron_skin',       name: 'Iron Skin',            kind: 'player', activation: 'passive', element: 'forge',   description: 'Harden your body against physical hits.',   effect: '+10 DEF permanently',               rarity: 'common',   flavor: 'Hammered by miles, hardened by will.',     icon: '🛡' },
  { id: 'sk_flame_strike',    name: 'Flame Strike',         kind: 'player', activation: 'active',  element: 'fire',    description: 'Ignite your weapon with mana fire.',        effect: '+20% ATK vs frost/nature gates',    rarity: 'rare',     flavor: 'Everything burns if you run hot enough.',  icon: '🔥' },
  { id: 'sk_arcane_insight',  name: 'Arcane Insight',       kind: 'player', activation: 'passive', element: 'arcane',  description: 'Read the gate before entering.',           effect: '+5% win probability on all gates', rarity: 'uncommon', flavor: 'Knowledge is the sharpest weapon.',        icon: '🔮' },
  { id: 'sk_wind_dash',       name: 'Wind Dash',            kind: 'player', activation: 'active',  element: null,      description: 'Burst of pure speed.',                      effect: '+20% SPD this run',                 rarity: 'common',   flavor: 'The wind does not wait.',                  icon: '💨' },
  { id: 'sk_mending_aura',    name: 'Mending Aura',         kind: 'player', activation: 'passive', element: 'mending', description: 'Slowly recover stats after gate defeat.',   effect: 'Recover 50% stat loss after loss',  rarity: 'rare',     flavor: 'Wounds are lessons. Heal them quickly.',   icon: '✨' },
  { id: 'sk_void_sight',      name: 'Void Sight',           kind: 'player', activation: 'passive', element: 'shadow',  description: 'See through darkness and illusions.',       effect: '+10 PER permanently',               rarity: 'rare',     flavor: 'The void reveals all truths.',             icon: '👁' },
  { id: 'sk_battle_cry',      name: 'Battle Cry',           kind: 'player', activation: 'active',  element: null,      description: 'Rally the party before a gate.',           effect: '+15% all stats for co-op gates',   rarity: 'uncommon', flavor: 'One voice can move an army.',              icon: '⚔' },
]

export const BASE_SKILLS: PlayerSkill[] = [
  { id: 'bsk_iron_golem',     name: 'Iron Golem',           kind: 'base',   activation: 'passive', element: 'forge',   description: 'A construct that guards your territory.',   effect: '+20 DEF to fortress',               rarity: 'common',   flavor: 'Stone and steel do not sleep.',            icon: '🗿' },
  { id: 'bsk_life_seed',      name: 'Life Rejuvenation Seed', kind: 'base', activation: 'passive', element: 'mending', description: 'Slowly heals the base after attacks.',     effect: 'Restore 10 DEF/day passively',      rarity: 'uncommon', flavor: 'Where there is growth, there is survival.', icon: '🌱' },
  { id: 'bsk_shadow_ward',    name: 'Shadow Ward',          kind: 'base',   activation: 'passive', element: 'shadow',  description: 'Obscures your territory from detection.',  effect: '-25% chance to be targeted',        rarity: 'rare',     flavor: 'The best defence is invisibility.',        icon: '🌑' },
  { id: 'bsk_frost_barrier',  name: 'Frost Barrier',        kind: 'base',   activation: 'active',  element: 'frost',   description: 'Slows enemy attackers on contact.',        effect: '-20% attacker SPD in PvP',          rarity: 'uncommon', flavor: 'Cold stone is still stone.',               icon: '❄' },
  { id: 'bsk_arcane_shield',  name: 'Arcane Shield',        kind: 'base',   activation: 'passive', element: 'arcane',  description: 'Magical barrier that absorbs first hit.',  effect: 'Absorb 1 attack per 24h',           rarity: 'rare',     flavor: 'Magic endures where walls crumble.',       icon: '🔵' },
  { id: 'bsk_fire_trap',      name: 'Fire Trap',            kind: 'base',   activation: 'active',  element: 'fire',    description: 'Burns attackers who breach the perimeter.', effect: 'Deal 15% ATK back to attacker',    rarity: 'uncommon', flavor: 'Step on the flame. See what happens.',     icon: '🔥' },
]

export const ALL_SKILLS: PlayerSkill[] = [...PLAYER_SKILLS, ...BASE_SKILLS]

// ---------------------------------------------------------------------------
// Fortress crops (passive resource generation)
// ---------------------------------------------------------------------------

export type CropType = 'herb_garden' | 'iron_mine' | 'mana_pool' | 'crystal_vein' | 'gold_deposit'

export const CROP_CONFIG: Record<CropType, {
  label: string; icon: string; resource: ResourceType; yieldAmount: number; cooldownHours: number
}> = {
  herb_garden:   { label: 'Herb Garden',   icon: '🌿', resource: 'herbs',   yieldAmount: 5, cooldownHours: 4  },
  iron_mine:     { label: 'Iron Mine',     icon: '⛏',  resource: 'iron',    yieldAmount: 8, cooldownHours: 6  },
  mana_pool:     { label: 'Mana Pool',     icon: '✦',  resource: 'mana',    yieldAmount: 3, cooldownHours: 8  },
  crystal_vein:  { label: 'Crystal Vein',  icon: '◈',  resource: 'crystal', yieldAmount: 2, cooldownHours: 12 },
  gold_deposit:  { label: 'Gold Deposit',  icon: '◆',  resource: 'gold',    yieldAmount: 1, cooldownHours: 24 },
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
    icon: '⚔',
    maxLevel: 5,
    upgradeCost: (lvl) => ({ iron: lvl * 10 + 5, gold: lvl * 5 }),
  },
  {
    key: 'walls_level',
    name: 'Fortress Walls',
    description: 'Harden your defences, increase DEF.',
    statBonus: '+2 DEF per level',
    icon: '🛡',
    maxLevel: 5,
    upgradeCost: (lvl) => ({ iron: lvl * 15, crystal: lvl * 5 }),
  },
  {
    key: 'forge_level',
    name: 'Grand Forge',
    description: 'Unlock advanced crafting recipes.',
    statBonus: '+1 craft slot per level',
    icon: '⚒',
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
export const HARVEST_COOLDOWN_H = 6
// Harvest range in metres
export const HARVEST_RANGE_M = 200
// Attack range from any own territory (km)
export const ATTACK_RANGE_KM = 5
