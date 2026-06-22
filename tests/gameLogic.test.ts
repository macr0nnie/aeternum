// =============================================================================
// Aeternum — Core game-logic tests
// =============================================================================
// Pure-function coverage for the systems most likely to regress: stamina,
// territory upgrades/health/defense, siege thresholds, rift rewards, and the
// gear stat accessor (which previously caused a runtime crash). Run: npm test
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  maxStamina, STAMINA_COSTS, STAMINA_PER_KM,
  unlockedResourceTypes, canHarvestType, levelRequiredFor, territoryUpgradeCost,
  territoryMaxHealth, territoryDefense, territoryRepairCost, TERRITORY_MAX_LEVEL,
  RIFT_INFLUENCE_REWARD, gearStatBonuses,
} from '@/types'

describe('stamina', () => {
  it('max scales with the Stamina (END) stat', () => {
    expect(maxStamina(0)).toBe(50)            // base
    expect(maxStamina(10)).toBe(100)          // 50 + 10*5
    expect(maxStamina(50)).toBe(300)
  })

  it('action costs are ordered cheap→expensive and positive', () => {
    expect(STAMINA_COSTS.harvest).toBeGreaterThan(0)
    expect(STAMINA_COSTS.harvest).toBeLessThan(STAMINA_COSTS.raid)
    expect(STAMINA_COSTS.raid).toBeLessThan(STAMINA_COSTS.claim)
    expect(STAMINA_COSTS.claim).toBeLessThan(STAMINA_COSTS.capture)
  })

  it('a 2km run refills a meaningful chunk of stamina', () => {
    expect(2 * STAMINA_PER_KM).toBe(40)
  })
})

describe('territory upgrades — resource-type gating', () => {
  it('L1 unlocks the basic resources, mana is the rarest', () => {
    expect(unlockedResourceTypes(1)).toContain('iron')
    expect(unlockedResourceTypes(1)).toContain('herbs')
    expect(unlockedResourceTypes(1)).not.toContain('mana')
    expect(unlockedResourceTypes(TERRITORY_MAX_LEVEL)).toContain('mana')
  })

  it('unlocks are cumulative as level rises', () => {
    const l1 = unlockedResourceTypes(1)
    const l5 = unlockedResourceTypes(5)
    for (const t of l1) expect(l5).toContain(t)
    expect(l5.length).toBeGreaterThanOrEqual(l1.length)
  })

  it('canHarvestType matches the unlock table', () => {
    expect(canHarvestType(1, 'iron')).toBe(true)
    expect(canHarvestType(1, 'mana')).toBe(false)
    expect(canHarvestType(5, 'mana')).toBe(true)
  })

  it('levelRequiredFor returns the gating level for a type', () => {
    expect(levelRequiredFor('iron')).toBe(1)
    expect(levelRequiredFor('mana')).toBe(TERRITORY_MAX_LEVEL)
  })

  it('upgrade cost is empty at max level', () => {
    expect(Object.keys(territoryUpgradeCost(TERRITORY_MAX_LEVEL))).toHaveLength(0)
    expect(Object.keys(territoryUpgradeCost(1)).length).toBeGreaterThan(0)
  })
})

describe('territory health & defense', () => {
  it('max health scales up with level', () => {
    expect(territoryMaxHealth(1)).toBe(100)
    expect(territoryMaxHealth(5)).toBe(300)
    expect(territoryMaxHealth(2)).toBeGreaterThan(territoryMaxHealth(1))
  })

  it('defense increases with DEF/END stats, level, and walls', () => {
    const base = territoryDefense({ DEF: 0, END: 0 }, 1, 0)
    const stronger = territoryDefense({ DEF: 10, END: 10 }, 3, 2)
    expect(stronger).toBeGreaterThan(base)
  })

  it('repair cost is zero at full health, positive when damaged', () => {
    expect(territoryRepairCost({ health: 100, max_health: 100 })).toEqual({})
    const cost = territoryRepairCost({ health: 20, max_health: 100 })
    expect(Object.values(cost).some(v => (v as number) > 0)).toBe(true)
  })
})

describe('rift influence rewards', () => {
  it('higher rank rifts grant more influence', () => {
    expect(RIFT_INFLUENCE_REWARD.F).toBeLessThan(RIFT_INFLUENCE_REWARD.S)
    expect(RIFT_INFLUENCE_REWARD.E).toBeLessThan(RIFT_INFLUENCE_REWARD.A)
    expect(RIFT_INFLUENCE_REWARD.F).toBeGreaterThan(0)
  })
})

describe('gearStatBonuses (regression: previously crashed on undefined)', () => {
  it('returns empty object for null / undefined / missing field', () => {
    expect(gearStatBonuses(null)).toEqual({})
    expect(gearStatBonuses(undefined)).toEqual({})
    expect(gearStatBonuses({} as any)).toEqual({})
  })

  it('returns the bonuses when present', () => {
    expect(gearStatBonuses({ statBonuses: { ATK: 5 } })).toEqual({ ATK: 5 })
  })
})
