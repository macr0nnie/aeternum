import { describe, it, expect } from 'vitest'
import { regionName, stillnessFog, STILLNESS_CLEAR_M } from '@/lib/worldMap'

describe('regionName', () => {
  it('gives the same lore name anywhere inside one region square', () => {
    expect(regionName(37.7749, -122.4194)).toBe(regionName(37.7701, -122.4101))
    expect(regionName(37.7749, -122.4194)).toMatch(/^[A-Z][a-z]+$/)
  })

  it('handles southern and eastern coordinates', () => {
    expect(regionName(-33.8688, 151.2093)).toMatch(/^[A-Z][a-z]+$/)
  })

  it('names neighbouring regions differently somewhere along a line', () => {
    const names = new Set(Array.from({ length: 10 }, (_, i) => regionName(51.5, -0.1 + i * 0.05)))
    expect(names.size).toBeGreaterThan(3)
  })
})

describe('stillnessFog', () => {
  it('covers the whole world before the first scan', () => {
    const fog = stillnessFog(null)
    expect(fog.features).toHaveLength(1)
    expect(fog.features[0]!.geometry.coordinates).toHaveLength(1)
  })

  it('clears a hole of STILLNESS_CLEAR_M around the Wayfarer', () => {
    const fog = stillnessFog({ lat: 40, lng: -74 })
    const hole = fog.features[0]!.geometry.coordinates[1]!
    for (const [lng, lat] of hole) {
      const dy = (lat - 40) * 111_320
      const dx = (lng + 74) * 111_320 * Math.cos((40 * Math.PI) / 180)
      expect(Math.hypot(dx, dy)).toBeCloseTo(STILLNESS_CLEAR_M, 0)
    }
  })
})
