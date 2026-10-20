// Aeternum — World map style
// Painted RPG-overworld look over real geography. Vector tiles from OpenFreeMap
// (free, no API key, OpenMapTiles schema) so we draw only terrain: land, water,
// forests, and roads as unnamed trails. Deliberately no symbol layers, buildings,
// POIs, house numbers or place names — the map shows where you can run, not
// which street or shop you're next to (also keeps screenshots from doxxing homes).
// Texture names (paper, meadow, forest, water) are registered by <Images> in
// app/world.tsx from assets/map/.

const PARCHMENT = '#e9dcc3'
const SETTLED   = '#e2d2b4'   // towns read as slightly worn paper, no detail
const WATER     = '#7fa3a1'
const ROAD_INK  = '#8a6a43'
const ROAD_DIRT = '#d2b88b'
const TRAIL_INK = '#7a5a36'
const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']
// Zoom must be the outermost expression, so the edge gets its own wider copy.
const roadWidth = (extra: number) => [
  'interpolate', ['linear'], ['zoom'],
  12, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 2 + extra, 0.6 + extra],
  18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 9 + extra, ['minor', 'service'], 3.5 + extra, 6 + extra],
]

export const MAP_STYLE = {
  version: 8,
  sources: {
    world: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenMapTiles © OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'paper', type: 'background', paint: { 'background-color': PARCHMENT, 'background-pattern': 'paper' } },
    {
      id: 'settled', type: 'fill', source: 'world', 'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
      paint: { 'fill-color': SETTLED },
    },
    {
      id: 'meadow', type: 'fill', source: 'world', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
      paint: { 'fill-pattern': 'meadow', 'fill-opacity': 0.85 },
    },
    { id: 'park', type: 'fill', source: 'world', 'source-layer': 'park', paint: { 'fill-pattern': 'meadow' } },
    {
      id: 'forest', type: 'fill', source: 'world', 'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-pattern': 'forest' },
    },
    {
      id: 'water', type: 'fill', source: 'world', 'source-layer': 'water',
      filter: ['!=', ['get', 'class'], 'swimming_pool'],
      paint: { 'fill-pattern': 'water' },
    },
    {
      id: 'rivers', type: 'line', source: 'world', 'source-layer': 'waterway',
      paint: { 'line-color': WATER, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 4] },
    },
    {
      // Footpaths and tracks: dashed trails.
      id: 'trails', type: 'line', source: 'world', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      paint: {
        'line-color': TRAIL_INK,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 18, 2],
        'line-dasharray': [2, 2],
      },
    },
    {
      // Streets drawn as dirt roads: dark edge under a sandy track. No names.
      id: 'roads-edge', type: 'line', source: 'world', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD_INK, 'line-opacity': 0.6, 'line-width': roadWidth(2) },
    },
    {
      id: 'roads', type: 'line', source: 'world', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD_DIRT, 'line-width': roadWidth(0) },
    },
  ],
} as const
