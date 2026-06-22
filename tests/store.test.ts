// =============================================================================
// Aeternum — Store (Zustand) regression tests
// =============================================================================
// The store is the heart of offline play and where progress lives. These tests
// lock in the behaviour of the economy actions (stamina, influence, resources),
// progression guards (no double-claim), gear equip/unequip, run application,
// and the deep-merge that prevents red-screen crashes on persisted upgrades.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, deepMerge } from '@/store/useStore'
import { maxStamina } from '@/types'
import type { Player, GearItem } from '@/types'

const s = () => useStore.getState()

// A minimal valid player for tests.
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'test-player',
    username: 'Tester',
    rank: 'E',
    total_distance_km: 0,
    primary_element: null,
    secondary_element: null,
    stats: { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 0, PER: 0, CHA: 0 },
    title: 'Novice',
    title_chronicle: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Player
}

beforeEach(() => {
  s().reset()
})

// ---------------------------------------------------------------------------
describe('stamina economy', () => {
  it('starts at base and is capped by the Stamina (END) stat', () => {
    s().setPlayer(makePlayer({ stats: { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 10, PER: 0, CHA: 0 } }))
    // restore a huge amount → clamps to max
    s().restoreStamina(9999)
    expect(s().getStamina()).toBe(maxStamina(10)) // 100
  })

  it('spendStamina deducts when affordable and refuses when not', () => {
    s().setPlayer(makePlayer())
    // base 50
    expect(s().spendStamina(20)).toBe(true)
    expect(s().getStamina()).toBe(30)
    expect(s().spendStamina(100)).toBe(false) // can't afford
    expect(s().getStamina()).toBe(30)         // unchanged
  })

  it('restoreStamina never exceeds max', () => {
    s().setPlayer(makePlayer())
    s().spendStamina(40) // 10 left
    s().restoreStamina(9999)
    expect(s().getStamina()).toBe(maxStamina(0)) // 50
  })
})

// ---------------------------------------------------------------------------
describe('influence & resources', () => {
  it('addInfluence and spendInfluence behave correctly', () => {
    s().addInfluence(100)
    expect(s().resources.influence).toBe(100)
    expect(s().spendInfluence(30)).toBe(true)
    expect(s().resources.influence).toBe(70)
    expect(s().spendInfluence(999)).toBe(false) // insufficient
    expect(s().resources.influence).toBe(70)
  })

  it('spendResources is atomic — fails without deducting if any cost unmet', () => {
    s().setResources({ influence: 0, iron: 10, crystal: 0, mana: 0, herbs: 0, gold: 5 })
    // needs more crystal than available → whole spend fails, nothing deducted
    expect(s().spendResources({ iron: 5, crystal: 50 })).toBe(false)
    expect(s().resources.iron).toBe(10)
    // affordable spend succeeds
    expect(s().spendResources({ iron: 5, gold: 5 })).toBe(true)
    expect(s().resources.iron).toBe(5)
    expect(s().resources.gold).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('progression guards', () => {
  it('completeQuest applies stat rewards once and ignores double-claims', () => {
    s().setPlayer(makePlayer())
    s().completeQuest('q1', { END: 2, CHA: 1 })
    expect(s().player?.stats.END).toBe(2)
    expect(s().completedQuestIds).toContain('q1')
    // claim again — no further gain
    s().completeQuest('q1', { END: 2, CHA: 1 })
    expect(s().player?.stats.END).toBe(2)
  })

  it('clearDungeon records the clear once', () => {
    s().setPlayer(makePlayer())
    s().clearDungeon('d1', { ATK: 1 })
    s().clearDungeon('d1', { ATK: 1 })
    expect(s().clearedDungeonIds.filter(id => id === 'd1')).toHaveLength(1)
    expect(s().player?.stats.ATK).toBe(1)
  })
})

// ---------------------------------------------------------------------------
describe('gear equip/unequip', () => {
  const sword: GearItem = {
    id: 'sword', instanceId: 'sword#1', name: 'Test Sword', slot: 'weapon',
    rarity: 'common', element: null, statBonuses: { ATK: 5 }, flavor: '',
  }

  it('equipping moves item from inventory to loadout; unequip returns it', () => {
    s().addGearToInventory(sword)
    const inInv = s().inventory.gear.find(g => g.id === 'sword')!
    s().equipGear(inInv)
    expect(s().equipped.weapon?.id).toBe('sword')
    expect(s().inventory.gear.find(g => g.instanceId === inInv.instanceId)).toBeUndefined()

    s().unequipGear('weapon')
    expect(s().equipped.weapon).toBeNull()
    expect(s().inventory.gear.some(g => g.id === 'sword')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('applyRunResult', () => {
  it('adds stat gains and refills stamina from distance', () => {
    s().setPlayer(makePlayer())
    s().spendStamina(40) // 10 left
    s().applyRunResult(
      { run_id: 'r1', validated: true, rewards: [], stat_gains: { END: 3 } },
      { distance_km: 1, duration_seconds: 600, steps: 1300, avg_heart_rate: 140, ended_at: '' },
    )
    expect(s().player?.stats.END).toBe(3)
    expect(s().syncState).toBe('done')
    // 1km → +20 stamina (10 + 20 = 30), capped at max for END=3 (65)
    expect(s().getStamina()).toBe(30)
  })

  it('no-ops safely when there is no player', () => {
    expect(() => s().applyRunResult(
      { run_id: 'r', validated: true, rewards: [], stat_gains: { ATK: 1 } },
    )).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
describe('deepMerge (persist upgrade guard — prevents red-screen crashes)', () => {
  it('fills NEW nested fields from defaults when persisted data lacks them', () => {
    // Simulates old storage missing a newly-added sub-field.
    const defaults = { fortress: { level: 1, walls_level: 0, defense_slots: [] } }
    const persisted = { fortress: { level: 3 } } // old shape, no walls_level/slots
    const merged = deepMerge(defaults, persisted as any)
    expect(merged.fortress.level).toBe(3)        // keeps persisted value
    expect(merged.fortress.walls_level).toBe(0)  // fills missing field (no undefined!)
    expect(merged.fortress.defense_slots).toEqual([])
  })

  it('persisted arrays replace defaults wholesale (not element-merged)', () => {
    const merged = deepMerge({ list: [1, 2, 3] }, { list: [9] } as any)
    expect(merged.list).toEqual([9])
  })

  it('ignores undefined source values, keeping defaults', () => {
    const merged = deepMerge({ a: 1, b: 2 }, { b: undefined } as any)
    expect(merged).toEqual({ a: 1, b: 2 })
  })
})

// ---------------------------------------------------------------------------
describe('reset', () => {
  it('clears player and progress back to defaults', () => {
    s().setPlayer(makePlayer())
    s().addInfluence(50)
    s().completeQuest('q9', { ATK: 1 })
    s().reset()
    expect(s().player).toBeNull()
    expect(s().resources.influence).toBe(0)
    expect(s().completedQuestIds).toHaveLength(0)
  })
})
