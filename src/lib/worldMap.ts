// Aeternum — World map helpers (pure, unit-tested)
// Region names and the Stillness fog. Real coordinates only pick which lore
// name or fog hole to draw; no real-world place name ever reaches the screen.

const PREFIXES = ['Ember', 'Ash', 'Kindle', 'Still', 'Cinder', 'Hearth', 'Dusk', 'Glimmer', 'Thorn', 'Wander']
const SUFFIXES = ['wood', 'mere', 'fields', 'reach', 'hollow', 'vale', 'moor', 'crossing']

// ~5.5 km squares: big enough that a region name doesn't pinpoint a street.
const REGION_CELL_DEG = 0.05

export function regionName(lat: number, lng: number): string {
  const x = Math.floor(lng / REGION_CELL_DEG)
  const y = Math.floor(lat / REGION_CELL_DEG)
  // Integer hash so neighbouring squares get unrelated names.
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  h = (h ^ (h >>> 15)) >>> 0
  return PREFIXES[h % PREFIXES.length]! + SUFFIXES[Math.floor(h / PREFIXES.length) % SUFFIXES.length]!
}

// Metres the Wayfarer can see through the Stillness around their last scan.
export const STILLNESS_CLEAR_M = 800

const WORLD: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]

function circle(lat: number, lng: number, radiusM: number, steps = 48): [number, number][] {
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (-i / steps) * Math.PI * 2 // clockwise: a hole in the world polygon
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat])
  }
  return ring
}

// Fog over the whole world with a soft-edged hole around `center` (three
// stacked rings of growing radius). No center yet → the whole map is still.
export function stillnessFog(center: { lat: number; lng: number } | null) {
  const features = center
    ? [1, 1.3, 1.6].map(k => ({
        type: 'Feature' as const,
        properties: { opacity: 0.4 },
        geometry: { type: 'Polygon' as const, coordinates: [WORLD, circle(center.lat, center.lng, STILLNESS_CLEAR_M * k)] },
      }))
    : [{ type: 'Feature' as const, properties: { opacity: 0.85 }, geometry: { type: 'Polygon' as const, coordinates: [WORLD] } }]
  return { type: 'FeatureCollection' as const, features }
}

// ~250 m claim cells: every territory sits at its cell's centre, so a pin never
// marks a real doorstep. Mirrors territory_cell() in
// supabase/migrations/011_territory_cells.sql. shortcut: kept in sync by hand.
const CELL_DEG = 0.00225

export function territoryCell(lat: number, lng: number): { key: string; lat: number; lng: number } {
  const r = Math.floor(lat / CELL_DEG)
  const cLat = (r + 0.5) * CELL_DEG
  const lngStep = CELL_DEG / Math.max(Math.cos((cLat * Math.PI) / 180), 0.01)
  const c = Math.floor(lng / lngStep)
  return { key: `${r}:${c}`, lat: cLat, lng: (c + 0.5) * lngStep }
}
