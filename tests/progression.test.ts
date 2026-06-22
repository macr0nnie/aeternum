// =============================================================================
// Aeternum — Progression tests: archetypes (earned pathways) + reward engine
// =============================================================================
// Archetypes are the player's earned identity (discovered, never chosen), and
// computeRewards resolves dungeon loot personalised to that identity. Both are
// pure logic, so we lock their behaviour against regressions.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  detectAllArchetypes, detectPrimaryArchetype, getArchetypeDef,
  getNextTier, getArchetypeTierName,
} from '@/data/archetypes'
import { computeRewards } from '@/lib/rewardEngine'
import { EMPTY_TRAITS, DUNGEON_ENTRIES, type PlayerTraits } from '@/types'

const traits = (o: Partial<PlayerTraits> = {}): PlayerTraits => ({ ...EMPTY_TRAITS, ...o })

describe('archetype detection (earned identity)', () => {
  it('a new player with no traits has no archetype', () => {
    expect(detectAllArchetypes(traits())).toHaveLength(0)
    expect(detectPrimaryArchetype(traits())).toBeNull()
  })

  it('enough endurance+exploration discovers the Pathfinder line', () => {
    const found = detectAllArchetypes(traits({ endurance: 20, exploration: 15 }))
    expect(found.some(a => a.id === 'pathfinder')).toBe(true)
  })

  it('higher traits yield a higher tier rank', () => {
    const low = detectPrimaryArchetype(traits({ endurance: 20, exploration: 15 }))
    const high = detectPrimaryArchetype(traits({ endurance: 210, exploration: 150 }))
    expect(high && low && high.rank).toBeGreaterThan(low!.rank)
  })

  it('getNextTier returns a tier below max and null at max', () => {
    const def = getArchetypeDef('pathfinder')!
    const maxRank = def.tiers[def.tiers.length - 1]!.rank
    expect(getNextTier('pathfinder', 1)).not.toBeNull()
    expect(getNextTier('pathfinder', maxRank)).toBeNull()
  })

  it('getArchetypeTierName returns the named tier', () => {
    const name = getArchetypeTierName('pathfinder', 1)
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThan(0)
  })
})

describe('computeRewards (personalised loot)', () => {
  const dungeon = DUNGEON_ENTRIES[0]!

  it('returns the dungeon base stat rewards at minimum', () => {
    const r = computeRewards(dungeon, EMPTY_TRAITS, [])
    for (const k of Object.keys(dungeon.statRewards)) {
      expect((r.statRewards as Record<string, number>)[k] ?? 0).toBeGreaterThanOrEqual(
        (dungeon.statRewards as Record<string, number>)[k] ?? 0,
      )
    }
  })

  it('never throws on edge inputs (empty traits, no skills)', () => {
    expect(() => computeRewards(dungeon, EMPTY_TRAITS, [])).not.toThrow()
    expect(() => computeRewards(dungeon, EMPTY_TRAITS, [], null)).not.toThrow()
  })

  it('produces a well-formed reward shape', () => {
    const r = computeRewards(dungeon, traits({ endurance: 50 }), [])
    expect(r).toHaveProperty('statRewards')
    expect(r).toHaveProperty('traitRewards')
    expect(r).toHaveProperty('skillUnlock')
  })
})
