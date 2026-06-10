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
  ground: '#0a0c12',        // deepest background — root screens
  surface: '#0f1118',       // panel surface
  surfaceHigh: '#141720',   // elevated surface — modals, overlays
  surfaceMid: '#111419',    // midpoint — card backgrounds

  // Text (all contrast checked at 15:1 min on ground)
  textPrimary: '#eef0f5',
  textSecondary: '#8a90a8',
  textTertiary: '#4a5068',  // disabled / placeholder

  // Borders
  borderLow: 'rgba(255,255,255,0.05)',
  borderMid: 'rgba(255,255,255,0.10)',
  borderHigh: 'rgba(255,255,255,0.18)',

  // Rarity
  common: '#8a90a8',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  legendary: '#f59e0b',

  // Semantic
  error: '#f87171',
  success: '#4ade80',
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
} as const

// ---------------------------------------------------------------------------
// Animation durations (ms)
// ---------------------------------------------------------------------------

export const DURATION = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const
