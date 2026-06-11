// =============================================================================
// Aeternum — Design Tokens
// =============================================================================
// All visual constants live here. Components import from this file only —
// no hardcoded colours, sizes, or font names anywhere in the codebase.
//
// Element accent system: each element has five colour variants. Changing the
// active element shifts the entire app colour personality. Components read
// from `elementAccent(element)` rather than hardcoding a colour.
// =============================================================================

import type { Element } from '@/types'

// ---------------------------------------------------------------------------
// Background layers
// ---------------------------------------------------------------------------

export const COLORS = {
  // Backgrounds
  ground: '#080b13',        // deepest background — root screens
  surface: '#0d1120',       // panel surface
  surfaceHigh: '#121828',   // elevated surface — modals, overlays
  surfaceMid: '#0f1420',    // midpoint — card backgrounds
  locked: '#0a0d16',        // locked dungeon background

  // Text (all contrast checked at 15:1 min on ground)
  textPrimary: '#e8ecf8',
  textSecondary: '#7a84a8',
  textTertiary: '#3d4560',  // disabled / placeholder

  // Borders
  borderLow: 'rgba(255,255,255,0.05)',
  borderMid: 'rgba(255,255,255,0.10)',
  borderHigh: 'rgba(255,255,255,0.20)',

  // Rarity
  common: '#7a84a8',
  uncommon: '#3ddc84',
  rare: '#4fa8f8',
  legendary: '#f0a030',

  // System (Korean RPG UI accent)
  system: '#4fc3f7',        // system notification blue
  systemDim: 'rgba(79,195,247,0.12)',
  systemBorder: 'rgba(79,195,247,0.35)',
  systemGold: '#ffd54f',    // achievement / legendary gold
  systemGoldDim: 'rgba(255,213,79,0.12)',
  systemAlert: '#e53935',   // danger / boss alert
  systemAlertDim: 'rgba(229,57,53,0.12)',

  // Semantic
  error: '#f06060',
  success: '#3ddc84',
  warning: '#fbbf24',
} as const

// ---------------------------------------------------------------------------
// Element accent palettes
// ---------------------------------------------------------------------------
// Each element has 5 variants: base, bright, dim, mid, border.
// base   — primary accent colour (buttons, active indicators)
// bright — lighter variant (highlights, focus rings)
// dim    — darker variant (backgrounds tinted by element)
// mid    — midpoint between base and dim (subtle fills)
// border — border colour at element accent (panels, dividers)

export interface ElementPalette {
  base: string
  bright: string
  dim: string
  mid: string
  border: string
}

export const ELEMENT_PALETTES: Record<Element, ElementPalette> = {
  fire: {
    base: '#f97316',
    bright: '#fb923c',
    dim: '#431407',
    mid: '#7c2d12',
    border: 'rgba(249,115,22,0.25)',
  },
  water: {
    base: '#38bdf8',
    bright: '#7dd3fc',
    dim: '#082f49',
    mid: '#0c4a6e',
    border: 'rgba(56,189,248,0.25)',
  },
  nature: {
    base: '#4ade80',
    bright: '#86efac',
    dim: '#052e16',
    mid: '#14532d',
    border: 'rgba(74,222,128,0.25)',
  },
  arcane: {
    base: '#a78bfa',
    bright: '#c4b5fd',
    dim: '#2e1065',
    mid: '#4c1d95',
    border: 'rgba(167,139,250,0.25)',
  },
  shadow: {
    base: '#818cf8',
    bright: '#a5b4fc',
    dim: '#1e1b4b',
    mid: '#312e81',
    border: 'rgba(129,140,248,0.25)',
  },
  frost: {
    base: '#67e8f9',
    bright: '#a5f3fc',
    dim: '#083344',
    mid: '#164e63',
    border: 'rgba(103,232,249,0.25)',
  },
  earth: {
    base: '#d97706',
    bright: '#f59e0b',
    dim: '#451a03',
    mid: '#78350f',
    border: 'rgba(217,119,6,0.25)',
  },
  harvest: {
    base: '#a3e635',
    bright: '#d9f99d',
    dim: '#1a2e05',
    mid: '#365314',
    border: 'rgba(163,230,53,0.25)',
  },
  forge: {
    base: '#fb7185',
    bright: '#fda4af',
    dim: '#4c0519',
    mid: '#881337',
    border: 'rgba(251,113,133,0.25)',
  },
  mending: {
    base: '#34d399',
    bright: '#6ee7b7',
    dim: '#022c22',
    mid: '#064e3b',
    border: 'rgba(52,211,153,0.25)',
  },
}

// Returns the palette for the given element, or a neutral fallback.
export function elementAccent(element: Element | null | undefined): ElementPalette {
  if (!element) {
    return {
      base: '#8a90a8',
      bright: '#b0b6cc',
      dim: '#1a1d28',
      mid: '#23273a',
      border: 'rgba(138,144,168,0.25)',
    }
  }
  return ELEMENT_PALETTES[element]
}

// ---------------------------------------------------------------------------
// Rarity colours (convenience accessor)
// ---------------------------------------------------------------------------

export function rarityColor(rarity: string): string {
  switch (rarity) {
    case 'uncommon': return COLORS.uncommon
    case 'rare': return COLORS.rare
    case 'legendary': return COLORS.legendary
    default: return COLORS.common
  }
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FONTS = {
  display: 'Rajdhani_700Bold',    // headings, labels, buttons
  mono: 'ShareTechMono_400Regular', // data, numbers, distances
} as const

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  display: 36,
} as const

export const LETTER_SPACING = {
  tight: 0.5,
  normal: 1.5,    // default for uppercase labels
  wide: 3,
  extraWide: 5,
} as const

export const LINE_HEIGHT = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.7,
} as const

// ---------------------------------------------------------------------------
// Spacing (8pt grid)
// ---------------------------------------------------------------------------

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

// ---------------------------------------------------------------------------
// Border radius — angular language, never pill
// ---------------------------------------------------------------------------

export const RADIUS = {
  sharp: 2,
  slight: 4,    // maximum used in this design language
} as const

// ---------------------------------------------------------------------------
// Border widths
// ---------------------------------------------------------------------------

export const BORDER = {
  thin: 1,
  mid: 1.5,
  thick: 2,
} as const

// ---------------------------------------------------------------------------
// Shadows (subtle — dark UI)
// ---------------------------------------------------------------------------

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  // Glow shadows for Korean RPG accent panels
  glowBlue: {
    shadowColor: '#4fc3f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  glowGold: {
    shadowColor: '#ffd54f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  glowRed: {
    shadowColor: '#e53935',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
} as const

// ---------------------------------------------------------------------------
// Rank glow colours
// ---------------------------------------------------------------------------

export const RANK_GLOW: Record<string, string> = {
  E: '#4a5068',
  D: '#3ddc84',
  C: '#4fa8f8',
  B: '#a78bfa',
  A: '#f97316',
  S: '#ffd54f',
  Sovereign: '#e11d48',
}

// ---------------------------------------------------------------------------
// Animation durations (ms)
// ---------------------------------------------------------------------------

export const DURATION = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const
