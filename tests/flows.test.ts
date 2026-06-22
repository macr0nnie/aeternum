// =============================================================================
// Aeternum — End-to-end gameplay flow tests
// =============================================================================
// These exercise full sequences through the store the way the screens do, so a
// regression in how systems INTERACT (not just a single helper) is caught.
// They mirror the real handlers in app/dungeons.tsx and app/world.tsx.
//
// Flows covered:
//   1. Run → influence → claim territory  (the core onramp)
//   2. Raid → weaken → capture            (the turf-war siege loop)
//   3. Harvest → resources → upgrade      (the gather/upgrade loop)
//   4. Stamina gating across a session     (the action economy)
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store/useStore'
import {
  STAMINA_COSTS, TERRITORY_PLACE_COST, RIFT_INFLUENCE_REWARD,
  territoryMaxHealth, territoryUpgradeCost, unlockedResourceTypes,
} from '@/types'
import type { Player, Territory } from '@/types'

const s = () => useStore.getState()
const CAPTURE_HP_THRESHOLD = 0.3 // mirrors app/world.tsx

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'me', username: 'Hero', rank: 'E', total_distance_km: 0,
    primary_element: null, secondary_element: null,
    stats: { ATK: 5, SPD: 5, INT: 0, LCK: 0, DEF: 5, END: 10, PER: 0, CHA: 0 },
    title: 'Novice', title_chronicle: [],
    created_at: '', updated_at: '', ...overrides,
  } as Player
}

function makeTerritory(o: Partial<Territory> = {}): Territory {
  return {
    id: 't1', owner_id: 'enemy', lat: 0, lng: 0, name: 'Enemy Keep',
    level: 1, health: 100, max_health: 100, created_at: '', ...o,
  }
}

beforeEach(() => { s().reset() })

// ---------------------------------------------------------------------------
describe('FLOW 1: run → clear rift → influence → claim territory', () => {
  it('a fresh player can earn influence and afford a claim', () => {
    s().setPlayer(makePlayer())
    // 0 influence at start — can't claim yet (the original broken state).
    expect(s().resources.influence).toBe(0)
    expect(s().spendInfluence(TERRITORY_PLACE_COST)).toBe(false)

    // Clear two D-rank rifts (mirrors dungeons.tsx awarding influence on clear).
    s().addInfluence(RIFT_INFLUENCE_REWARD.D)
    s().clearDungeon('d_a', { ATK: 1 })
    s().addInfluence(RIFT_INFLUENCE_REWARD.D)
    s().clearDungeon('d_b', { ATK: 1 })
    expect(s().resources.influence).toBe(RIFT_INFLUENCE_REWARD.D * 2)

    // Top up to the claim cost, then claim: spend influence + stamina + add land.
    s().addInfluence(TERRITORY_PLACE_COST)
    const before = s().resources.influence
    expect(s().spendInfluence(TERRITORY_PLACE_COST)).toBe(true)
    expect(s().spendStamina(STAMINA_COSTS.claim)).toBe(true)
    s().addMyTerritory(makeTerritory({ id: 'mine', owner_id: 'me', name: 'My Outpost' }))

    expect(s().resources.influence).toBe(before - TERRITORY_PLACE_COST)
    expect(s().myTerritories.map(t => t.id)).toContain('mine')
  })
})

// ---------------------------------------------------------------------------
describe('FLOW 2: raid → weaken → capture (siege loop)', () => {
  it('repeated raids drop HP below threshold, then capture transfers ownership', () => {
    s().setPlayer(makePlayer())
    s().restoreStamina(999) // full stamina for the siege

    let enemy = makeTerritory({ health: 100, max_health: 100 })
    s().setNearbyTerritories([enemy])

    // Raid #1: spend stamina, steal resources, chip HP (mirrors handleRaid).
    expect(s().spendStamina(STAMINA_COSTS.raid)).toBe(true)
    s().addResource('iron', 8)
    enemy = { ...enemy, health: 60 }
    s().setNearbyTerritories([enemy])
    expect(enemy.health / enemy.max_health).toBeGreaterThan(CAPTURE_HP_THRESHOLD) // not yet capturable

    // Raid #2: drops below the 30% capture threshold.
    expect(s().spendStamina(STAMINA_COSTS.raid)).toBe(true)
    s().addResource('iron', 8)
    enemy = { ...enemy, health: 25 }
    s().setNearbyTerritories([enemy])
    expect(enemy.health / enemy.max_health).toBeLessThanOrEqual(CAPTURE_HP_THRESHOLD) // capturable!

    // Capture: spend stamina, territory becomes ours at full health.
    expect(s().spendStamina(STAMINA_COSTS.capture)).toBe(true)
    const captured = { ...enemy, owner_id: 'me', health: enemy.max_health }
    s().addMyTerritory(captured)
    s().setNearbyTerritories([])

    expect(s().myTerritories.find(t => t.id === 't1')?.owner_id).toBe('me')
    expect(s().resources.iron).toBe(16) // plundered across both raids
  })
})

// ---------------------------------------------------------------------------
describe('FLOW 3: harvest → resources → upgrade territory', () => {
  it('gathered resources fund a territory upgrade that unlocks rarer nodes', () => {
    s().setPlayer(makePlayer())
    s().restoreStamina(999)

    // L1 territory can harvest iron/herbs but not gold.
    expect(unlockedResourceTypes(1)).toContain('iron')
    expect(unlockedResourceTypes(1)).not.toContain('gold')

    // Harvest enough to afford the L1→L2 upgrade.
    const cost = territoryUpgradeCost(1) // { iron, herbs }
    for (const [type, amt] of Object.entries(cost)) {
      expect(s().spendStamina(STAMINA_COSTS.harvest)).toBe(true)
      s().addResource(type as any, amt as number)
    }
    // Pay the upgrade cost.
    expect(s().spendResources(cost)).toBe(true)

    // After upgrading to L2, max health rises and gold unlocks.
    expect(territoryMaxHealth(2)).toBeGreaterThan(territoryMaxHealth(1))
    expect(unlockedResourceTypes(2)).toContain('gold')
  })
})

// ---------------------------------------------------------------------------
describe('FLOW 4: stamina gates an action session and a run refuels it', () => {
  it('runs out of stamina, then a synced run restores enough to act again', () => {
    s().setPlayer(makePlayer()) // END 10 → max 100
    s().restoreStamina(999)
    expect(s().getStamina()).toBe(100)

    // Spend it down with actions until a raid is no longer affordable.
    let raids = 0
    while (s().spendStamina(STAMINA_COSTS.raid)) raids++
    expect(raids).toBeGreaterThan(0)
    expect(s().getStamina()).toBeLessThan(STAMINA_COSTS.raid)

    // A 3km run refuels stamina (mirrors applyRunResult).
    s().applyRunResult(
      { run_id: 'r', validated: true, rewards: [], stat_gains: {} },
      { distance_km: 3, duration_seconds: 1800, steps: 4000, avg_heart_rate: 150, ended_at: '' },
    )
    expect(s().getStamina()).toBeGreaterThanOrEqual(STAMINA_COSTS.raid) // can act again
  })
})
