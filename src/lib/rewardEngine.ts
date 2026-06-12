// =============================================================================
// Aeternum — Reward Engine
// =============================================================================
// Personalizes dungeon clear rewards based on the player's behavioral
// fingerprint (traits) and discovered archetype.
//
// Philosophy:
//   • Base dungeon rewards (stat/trait) are the floor — everyone gets them.
//   • The engine REDIRECTS emphasis, it does NOT inflate total rewards.
//   • Stat affinity bonus (+1) only applies to stats already in the base pool,
//     so every bonus feels earned rather than random.
//   • Trait momentum deepens what the player already is — top trait gets +1
//     extra only when the dungeon naturally rewards it.
//   • Skill unlocks are drawn from an archetype-weighted pool; element affinity
//     breaks ties when multiple candidates exist.
// =============================================================================

import { detectPrimaryArchetype } from '@/data/archetypes'
import { PLAYER_SKILLS } from '@/types'
import type { DungeonEntry, PlayerTraits, TraitKey, Stats } from '@/types'

// ---------------------------------------------------------------------------
// Archetype → stat affinities
// ---------------------------------------------------------------------------
// When the player has this archetype, any of these stats that appear in the
// dungeon's base statRewards get +1 extra.

const ARCHETYPE_STAT_AFFINITY: Record<string, (keyof Stats)[]> = {
  pathfinder:    ['END', 'SPD'],
  vanguard:      ['ATK', 'DEF'],
  quartermaster: ['DEF', 'END'],
  sentinel:      ['DEF', 'CHA'],
  cartographer:  ['INT', 'PER'],
}

// ---------------------------------------------------------------------------
// Archetype → preferred skill IDs (order = priority)
// ---------------------------------------------------------------------------

const ARCHETYPE_SKILL_POOL: Record<string, string[]> = {
  pathfinder:    ['sk_iron_skin', 'sk_frost_step', 'sk_arcane_insight'],
  vanguard:      ['sk_flame_strike', 'sk_battle_cry', 'sk_iron_skin'],
  quartermaster: ['sk_iron_skin', 'sk_arcane_insight', 'sk_battle_cry'],
  sentinel:      ['sk_iron_skin', 'sk_battle_cry', 'sk_arcane_insight'],
  cartographer:  ['sk_arcane_insight', 'sk_shadow_step', 'sk_flame_strike'],
}

// ---------------------------------------------------------------------------
// Rarity → skill unlock probability
// ---------------------------------------------------------------------------

const RARITY_SKILL_CHANCE: Record<string, number> = {
  common:    0,     // no skill on basic clears
  uncommon:  0.40,
  rare:      0.75,
  legendary: 1.00,
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PersonalizedRewards {
  statRewards: Partial<Stats>
  traitRewards: Partial<PlayerTraits>
  skillUnlock: string | null
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeRewards(
  dungeon: DungeonEntry,
  traits: PlayerTraits,
  unlockedSkillIds: string[],
  playerElement?: string | null,
): PersonalizedRewards {
  const archetype = detectPrimaryArchetype(traits)

  // ── Stat rewards ──────────────────────────────────────────────────────────
  const statRewards: Partial<Stats> = { ...dungeon.statRewards }

  if (archetype) {
    const affinityStats = ARCHETYPE_STAT_AFFINITY[archetype.id] ?? []
    for (const stat of affinityStats) {
      if (statRewards[stat] !== undefined) {
        // Only boost stats the dungeon already rewards — feels earned
        statRewards[stat] = (statRewards[stat] as number) + 1
      }
    }
  }

  // ── Trait rewards ─────────────────────────────────────────────────────────
  const traitRewards: Partial<PlayerTraits> = { ...dungeon.traitRewards }

  // Momentum: top trait gets +1 if the dungeon already rewards it
  const topTrait = (Object.entries(traits) as [TraitKey, number][])
    .sort(([, a], [, b]) => b - a)[0]?.[0]

  if (topTrait && (traitRewards[topTrait] ?? 0) > 0) {
    traitRewards[topTrait] = (traitRewards[topTrait] as number) + 1
  }

  // ── Skill unlock ──────────────────────────────────────────────────────────
  let skillUnlock: string | null = null
  const chance = RARITY_SKILL_CHANCE[dungeon.rewardRarity] ?? 0

  if (Math.random() < chance) {
    let pool: string[] = []

    if (archetype) {
      // Primary pool: archetype-aligned skills the player doesn't have yet
      pool = (ARCHETYPE_SKILL_POOL[archetype.id] ?? [])
        .filter(id => !unlockedSkillIds.includes(id))
    }

    if (pool.length === 0) {
      // Fallback: any unlockable player skill matching element, then any
      const byElement = PLAYER_SKILLS
        .filter(s => s.element === playerElement && !unlockedSkillIds.includes(s.id))
      const any = PLAYER_SKILLS
        .filter(s => !unlockedSkillIds.includes(s.id))
      pool = (byElement.length > 0 ? byElement : any).map(s => s.id)
    }

    if (pool.length > 0) {
      skillUnlock = pool[Math.floor(Math.random() * pool.length)] ?? null
    }
  }

  return { statRewards, traitRewards, skillUnlock }
}
