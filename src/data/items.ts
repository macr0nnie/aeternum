// =============================================================================
// Aeternum — Master Item Registry
// =============================================================================
import type {
  GearItem, MaterialItem, ConsumableItem, CraftRecipe, HiddenTalent, Relic,
} from '@/types'

// ---------------------------------------------------------------------------
// WEAPONS
// ---------------------------------------------------------------------------
export const WEAPONS: GearItem[] = [
  {
    id: 'w_iron_blade',
    name: 'Iron Blade',
    slot: 'weapon',
    rarity: 'common',
    element: null,
    statBonuses: { ATK: 2 },
    flavor: 'Standard issue. Gets the job done.',
  },
  {
    id: 'w_swift_dagger',
    name: "Runner's Dagger",
    slot: 'weapon',
    rarity: 'common',
    element: null,
    statBonuses: { ATK: 1, SPD: 2 },
    flavor: 'Light enough to swing mid-sprint.',
  },
  {
    id: 'w_storm_lance',
    name: 'Storm Lance',
    slot: 'weapon',
    rarity: 'uncommon',
    element: 'arcane',
    statBonuses: { ATK: 4, SPD: 1 },
    setTag: 'Stormborn',
    requiredRank: 'D',
    flavor: 'Hums when rain approaches.',
  },
  {
    id: 'w_ember_sword',
    name: 'Ember Sword',
    slot: 'weapon',
    rarity: 'uncommon',
    element: 'fire',
    statBonuses: { ATK: 5, INT: 1 },
    setTag: 'Ember',
    requiredRank: 'D',
    flavor: 'Forged in the heart of a dying volcano.',
  },
  {
    id: 'w_void_edge',
    name: 'Void Edge',
    slot: 'weapon',
    rarity: 'rare',
    element: 'shadow',
    statBonuses: { ATK: 7, LCK: 2 },
    setTag: 'Shadowwalker',
    requiredRank: 'C',
    flavor: 'Cuts through darkness — and everything else.',
  },
  {
    id: 'w_starforged_blade',
    name: 'Starforged Blade',
    slot: 'weapon',
    rarity: 'legendary',
    element: 'arcane',
    statBonuses: { ATK: 12, INT: 4, SPD: 3 },
    requiredRank: 'A',
    flavor: 'Tempered in the corona of a dying star.',
  },
]

// ---------------------------------------------------------------------------
// ARMOR
// ---------------------------------------------------------------------------
export const ARMORS: GearItem[] = [
  {
    id: 'a_leather_vest',
    name: 'Leather Vest',
    slot: 'armor',
    rarity: 'common',
    element: null,
    statBonuses: { DEF: 2 },
    flavor: 'Better than nothing.',
  },
  {
    id: 'a_chain_mail',
    name: 'Chain Mail',
    slot: 'armor',
    rarity: 'uncommon',
    element: null,
    statBonuses: { DEF: 4, END: 1 },
    requiredRank: 'E',
    flavor: 'Heavy but reliable.',
  },
  {
    id: 'a_ember_plate',
    name: 'Ember Plate',
    slot: 'armor',
    rarity: 'uncommon',
    element: 'fire',
    statBonuses: { DEF: 4, ATK: 1 },
    setTag: 'Ember',
    requiredRank: 'D',
    flavor: 'The surface glows faintly even at rest.',
  },
  {
    id: 'a_shadow_mantle',
    name: 'Shadow Mantle',
    slot: 'armor',
    rarity: 'rare',
    element: 'shadow',
    statBonuses: { DEF: 5, SPD: 3 },
    setTag: 'Shadowwalker',
    requiredRank: 'C',
    flavor: 'Seems to absorb light.',
  },
  {
    id: 'a_void_carapace',
    name: 'Void Carapace',
    slot: 'armor',
    rarity: 'legendary',
    element: 'shadow',
    statBonuses: { DEF: 10, END: 4, SPD: 2 },
    requiredRank: 'S',
    flavor: 'Nothing from the void can harm what the void has claimed.',
  },
]

// ---------------------------------------------------------------------------
// RINGS
// ---------------------------------------------------------------------------
export const RINGS: GearItem[] = [
  {
    id: 'r_copper_ring',
    name: 'Copper Ring',
    slot: 'ring',
    rarity: 'common',
    element: null,
    statBonuses: { LCK: 1 },
    flavor: "It's just a ring.",
  },
  {
    id: 'r_scholars_band',
    name: "Scholar's Band",
    slot: 'ring',
    rarity: 'uncommon',
    element: null,
    statBonuses: { INT: 3, PER: 1 },
    requiredRank: 'E',
    flavor: 'Engraved with theorems no one can translate.',
  },
  {
    id: 'r_fortune_seal',
    name: 'Fortune Seal',
    slot: 'ring',
    rarity: 'rare',
    element: null,
    statBonuses: { LCK: 5, CHA: 2 },
    requiredRank: 'D',
    flavor: 'Some say it was worn by a legendary gambler.',
  },
  {
    id: 'r_storm_signet',
    name: 'Storm Signet',
    slot: 'ring',
    rarity: 'rare',
    element: 'arcane',
    statBonuses: { SPD: 4, INT: 2 },
    setTag: 'Stormborn',
    requiredRank: 'C',
    flavor: 'Crackles with static discharge.',
  },
  {
    id: 'r_sovereign_ring',
    name: "Sovereign's Ring",
    slot: 'ring',
    rarity: 'legendary',
    element: 'arcane',
    statBonuses: { CHA: 6, INT: 4, LCK: 3 },
    requiredRank: 'A',
    flavor: 'Worn by commanders who never lost.',
  },
]

// ---------------------------------------------------------------------------
// RELICS
// ---------------------------------------------------------------------------
export const RELICS: Relic[] = [
  {
    id: 'rel_runners_token',
    name: "Runner's Token",
    rarity: 'common',
    passiveEffect: '+5% distance XP gain',
    statBonus: { END: 1 },
    dropSource: 'Any F–E gate',
    flavor: 'A coin worn smooth by a thousand miles.',
  },
  {
    id: 'rel_shadow_shard',
    name: 'Shadow Shard',
    rarity: 'uncommon',
    passiveEffect: 'SPD stat counts double for win-probability calculation in shadow gates',
    triggerCondition: 'gate_type:shadow',
    dropSource: 'D-rank Shadow Gate',
    flavor: 'Cold to the touch. Always.',
  },
  {
    id: 'rel_storm_core',
    name: 'Storm Core Fragment',
    rarity: 'uncommon',
    passiveEffect: '+10% drop chance in lightning-element gates',
    triggerCondition: 'gate_element:Lightning',
    statBonus: { SPD: 2 },
    dropSource: 'C-rank gates',
    flavor: 'Hums at a frequency only the sky understands.',
  },
  {
    id: 'rel_void_lens',
    name: 'Void Lens',
    rarity: 'rare',
    passiveEffect: 'Reveals actual reward rarity before gate commit',
    dropSource: 'B-rank Void Gate',
    flavor: 'Looking through it shows you things you cannot unsee.',
  },
  {
    id: 'rel_commanders_crest',
    name: "Commander's Crest",
    rarity: 'legendary',
    passiveEffect: 'All stats +3 while inside a gate. Removed on defeat.',
    statBonus: { ATK: 3, DEF: 3, SPD: 3, INT: 3, END: 3, LCK: 3, PER: 3, CHA: 3 },
    dropSource: 'S-rank final boss',
    flavor: 'Authority forged in blood and distance.',
  },
]

// ---------------------------------------------------------------------------
// MONSTER CORES (materials)
// ---------------------------------------------------------------------------
export const MATERIALS: MaterialItem[] = [
  { id: 'mat_wolf_fang',      name: 'Wolf Fang',        rarity: 'common',   dropSource: 'F-rank Gate (Forest)',   flavor: 'Still sharp.' },
  { id: 'mat_stone_chip',     name: 'Stone Chip',       rarity: 'common',   dropSource: 'F-rank Gate (Ruins)',    flavor: 'Fragment of something ancient.' },
  { id: 'mat_mana_shard',     name: 'Mana Shard',       rarity: 'uncommon', dropSource: 'E-rank gates',           flavor: 'Crystallised ambient mana.' },
  { id: 'mat_ember_core',     name: 'Ember Core',       rarity: 'uncommon', dropSource: 'D-rank Fire Gate',       flavor: 'Retains heat for weeks.' },
  { id: 'mat_storm_essence',  name: 'Storm Essence',    rarity: 'uncommon', dropSource: 'D-rank Lightning Gate',  flavor: 'Sealed in a vial lest it discharge.' },
  { id: 'mat_void_fragment',  name: 'Void Fragment',    rarity: 'rare',     dropSource: 'C-rank Shadow Gate',     flavor: 'Has no reflection.' },
  { id: 'mat_shadow_silk',    name: 'Shadow Silk',      rarity: 'rare',     dropSource: 'B-rank gates',           flavor: 'Lighter than air, darker than night.' },
  { id: 'mat_sovereign_dust', name: 'Sovereign Dust',   rarity: 'legendary',dropSource: 'A/S-rank final bosses',  flavor: 'Remnant of a defeated sovereign.' },
  { id: 'mat_star_alloy',     name: 'Star Alloy',       rarity: 'legendary',dropSource: 'S-rank Cosmic Gate',     flavor: 'Forged at stellar temperatures.' },
]

// ---------------------------------------------------------------------------
// CONSUMABLES
// ---------------------------------------------------------------------------
export const CONSUMABLES: ConsumableItem[] = [
  {
    id: 'con_minor_elixir',
    name: 'Minor Elixir',
    rarity: 'common',
    effect: { type: 'stat_multiplier', statKey: 'ATK', multiplier: 1.1 },
    description: 'ATK ×1.1 for next gate attempt',
    flavor: 'Tastes like copper and ambition.',
  },
  {
    id: 'con_swiftness_draft',
    name: 'Swiftness Draft',
    rarity: 'common',
    effect: { type: 'stat_multiplier', statKey: 'SPD', multiplier: 1.15 },
    description: 'SPD ×1.15 for next gate attempt',
    flavor: 'You feel lighter just holding it.',
  },
  {
    id: 'con_drop_amplifier',
    name: 'Drop Amplifier',
    rarity: 'uncommon',
    effect: { type: 'drop_bonus', extraRolls: 1 },
    description: 'Roll one additional loot drop from next gate',
    flavor: 'Fortune favours the prepared.',
  },
  {
    id: 'con_iron_resolve',
    name: 'Iron Resolve',
    rarity: 'uncommon',
    effect: { type: 'defeat_shield' },
    description: 'Prevents stat loss on next failed gate (consumed on use)',
    flavor: 'Sometimes the only victory is walking away whole.',
  },
  {
    id: 'con_sovereigns_draught',
    name: "Sovereign's Draught",
    rarity: 'rare',
    effect: { type: 'stat_multiplier', statKey: 'ATK', multiplier: 1.3 },
    description: 'ATK ×1.3 for next gate attempt',
    flavor: 'Reserved for battles that cannot be lost.',
  },
  {
    id: 'con_perception_brew',
    name: 'Perception Brew',
    rarity: 'uncommon',
    effect: { type: 'stat_flat', statKey: 'PER', amount: 3 },
    description: 'PER +3 for next gate attempt',
    flavor: 'The world sharpens around you.',
  },
]

// ---------------------------------------------------------------------------
// ALL GEAR (flat list for easy lookup)
// ---------------------------------------------------------------------------
export const ALL_GEAR: GearItem[] = [...WEAPONS, ...ARMORS, ...RINGS]

export function findGearById(id: string): GearItem | undefined {
  return ALL_GEAR.find(g => g.id === id)
}

export function findRelicById(id: string): Relic | undefined {
  return RELICS.find(r => r.id === id)
}

export function findMaterialById(id: string): MaterialItem | undefined {
  return MATERIALS.find(m => m.id === id)
}

export function findConsumableById(id: string): ConsumableItem | undefined {
  return CONSUMABLES.find(c => c.id === id)
}

// ---------------------------------------------------------------------------
// CRAFTING RECIPES
// ---------------------------------------------------------------------------
export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'rec_storm_lance',
    category: 'forge',
    name: 'Storm Lance',
    outputId: 'w_storm_lance',
    outputType: 'gear',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_storm_essence', quantity: 3 },
      { itemId: 'mat_mana_shard',    quantity: 2 },
    ],
    requiredRank: 'D',
    flavor: 'Lightning calls to lightning.',
  },
  {
    id: 'rec_ember_sword',
    category: 'forge',
    name: 'Ember Sword',
    outputId: 'w_ember_sword',
    outputType: 'gear',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_ember_core',  quantity: 3 },
      { itemId: 'mat_stone_chip',  quantity: 5 },
    ],
    requiredRank: 'D',
    flavor: 'Heat it until it sings.',
  },
  {
    id: 'rec_void_edge',
    category: 'forge',
    name: 'Void Edge',
    outputId: 'w_void_edge',
    outputType: 'gear',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_void_fragment', quantity: 3 },
      { itemId: 'mat_shadow_silk',   quantity: 2 },
    ],
    requiredRank: 'C',
    flavor: 'The forge barely holds it together.',
  },
  {
    id: 'rec_shadow_mantle',
    category: 'forge',
    name: 'Shadow Mantle',
    outputId: 'a_shadow_mantle',
    outputType: 'gear',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_shadow_silk',   quantity: 4 },
      { itemId: 'mat_void_fragment', quantity: 1 },
    ],
    requiredRank: 'C',
    flavor: 'Weave in darkness.',
  },
  {
    id: 'rec_minor_elixir',
    category: 'brew',
    name: 'Minor Elixir',
    outputId: 'con_minor_elixir',
    outputType: 'consumable',
    outputQuantity: 3,
    ingredients: [
      { itemId: 'mat_mana_shard', quantity: 1 },
      { itemId: 'mat_wolf_fang',  quantity: 1 },
    ],
    flavor: 'Simple enough to brew in the field.',
  },
  {
    id: 'rec_swiftness_draft',
    category: 'brew',
    name: 'Swiftness Draft',
    outputId: 'con_swiftness_draft',
    outputType: 'consumable',
    outputQuantity: 2,
    ingredients: [
      { itemId: 'mat_storm_essence', quantity: 1 },
      { itemId: 'mat_mana_shard',    quantity: 1 },
    ],
    flavor: 'Bottle the wind.',
  },
  {
    id: 'rec_drop_amplifier',
    category: 'brew',
    name: 'Drop Amplifier',
    outputId: 'con_drop_amplifier',
    outputType: 'consumable',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_ember_core',  quantity: 1 },
      { itemId: 'mat_mana_shard',  quantity: 2 },
    ],
    requiredRank: 'D',
    flavor: 'Alchemical greed, bottled.',
  },
  {
    id: 'rec_iron_resolve',
    category: 'brew',
    name: 'Iron Resolve',
    outputId: 'con_iron_resolve',
    outputType: 'consumable',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_stone_chip',   quantity: 3 },
      { itemId: 'mat_mana_shard',   quantity: 1 },
    ],
    flavor: 'Distilled stubbornness.',
  },
  {
    id: 'rec_sovereigns_draught',
    category: 'brew',
    name: "Sovereign's Draught",
    outputId: 'con_sovereigns_draught',
    outputType: 'consumable',
    outputQuantity: 1,
    ingredients: [
      { itemId: 'mat_sovereign_dust', quantity: 1 },
      { itemId: 'mat_ember_core',     quantity: 2 },
    ],
    requiredRank: 'B',
    flavor: 'Power borrowed from the fallen.',
  },
]

// ---------------------------------------------------------------------------
// HIDDEN TALENTS
// ---------------------------------------------------------------------------
export const HIDDEN_TALENTS: HiddenTalent[] = [
  {
    id: 'ht_iron_body',
    name: 'Iron Body',
    description: 'Your endurance has reached a threshold where your body naturally resists damage.',
    unlockCondition: { type: 'stats', requirements: { END: 20 } },
    passiveEffect: 'DEF +5 permanently',
    statBonus: { DEF: 5 },
    flavor: 'The body remembers every kilometre.',
  },
  {
    id: 'ht_shadow_step',
    name: 'Shadow Step',
    description: 'Speed trained beyond normal limits grants a phantom-like grace in combat.',
    unlockCondition: { type: 'stats', requirements: { SPD: 20 } },
    passiveEffect: 'Dodge chance +10% in gate combat',
    statBonus: { SPD: 2 },
    flavor: 'Between heartbeats, you were already elsewhere.',
  },
  {
    id: 'ht_warlord',
    name: 'Warlord',
    description: 'Clearing five or more gates has sharpened your tactical mind.',
    unlockCondition: { type: 'dungeon_combo', dungeonIds: ['gate_f1', 'gate_f2', 'gate_e1', 'gate_e2', 'gate_d1'] },
    passiveEffect: 'Win probability floor raised to 20% regardless of stat gap',
    flavor: 'Five gates. Five lessons. You survived them all.',
  },
  {
    id: 'ht_chosen_path',
    name: 'Chosen Path',
    description: 'Your elemental affinity has deepened past the point of training.',
    unlockCondition: { type: 'element_mastery', element: 'shadow', minStat: 25 },
    passiveEffect: 'Shadow-element gate drops include one guaranteed rare+',
    flavor: 'The shadow does not follow you anymore. You follow each other.',
  },
  {
    id: 'ht_thousand_miles',
    name: 'Thousand Miles',
    description: 'A legendary threshold of distance covered on foot.',
    unlockCondition: { type: 'distance', km: 1000 },
    passiveEffect: 'All stat gains from runs +15%',
    flavor: 'The gate does not see a hunter. It sees a force of nature.',
  },
]
