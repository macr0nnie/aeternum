// Aeternum — World map style
// Hand-inked game-world look over real geography. Vector tiles from OpenFreeMap
// (free, no API key, OpenMapTiles schema) so we draw only terrain: land, water,
// forests, and roads as unnamed trails. Deliberately no symbol layers, buildings,
// POIs, house numbers or place names — the map shows where you can run, not
// which street or shop you're next to (also keeps screenshots from doxxing homes).

const PARCHMENT = '#e9dcc3'
const SETTLED   = '#e2d2b4'   // towns read as slightly worn paper, no detail
const MEADOW    = '#d6d9ad'
const FOREST    = '#a8b685'
const WATER     = '#7fa3a1'
const WATER_INK = '#4f7472'
const ROAD_INK  = '#8a6a43'
const TRAIL_INK = '#a48a66'

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
    { id: 'paper', type: 'background', paint: { 'background-color': PARCHMENT } },
    {
      id: 'settled', type: 'fill', source: 'world', 'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
      paint: { 'fill-color': SETTLED },
    },
    {
      id: 'meadow', type: 'fill', source: 'world', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
      paint: { 'fill-color': MEADOW, 'fill-opacity': 0.7 },
    },
    { id: 'park', type: 'fill', source: 'world', 'source-layer': 'park', paint: { 'fill-color': MEADOW } },
    {
      id: 'forest', type: 'fill', source: 'world', 'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': FOREST },
    },
    {
      id: 'water', type: 'fill', source: 'world', 'source-layer': 'water',
      filter: ['!=', ['get', 'class'], 'swimming_pool'],
      paint: { 'fill-color': WATER, 'fill-outline-color': WATER_INK },
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
      // Streets: thin ink roads, wider for highways. No names, no casing.
      id: 'roads', type: 'line', source: 'world', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROAD_INK,
        'line-opacity': 0.55,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          12, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 1.6, 0.4],
          18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 7, ['minor', 'service'], 2.5, 4.5],
        ],
      },
    },
  ],
} as const
