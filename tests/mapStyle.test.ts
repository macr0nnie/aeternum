import { describe, it, expect } from 'vitest'
import { MAP_STYLE } from '@/theme/mapStyle'

// The world map must never show real-world labels or building detail.
describe('world map style', () => {
  it('draws no labels, buildings or POIs', () => {
    for (const layer of MAP_STYLE.layers) {
      expect(layer.type).not.toBe('symbol')
      const src = (layer as { 'source-layer'?: string })['source-layer']
      expect(['building', 'poi', 'housenumber', 'place', 'transportation_name', 'water_name']).not.toContain(src)
    }
  })

  it('uses no raster basemap (raster tiles bake in street names)', () => {
    for (const s of Object.values(MAP_STYLE.sources)) expect(s.type).not.toBe('raster')
  })
})
