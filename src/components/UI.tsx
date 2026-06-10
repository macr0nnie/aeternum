// =============================================================================
// Aeternum — Shared UI Primitives
// =============================================================================
// All primitive components live here: Panel, Label, Heading, Button,
// StatChip, RankBadge. These enforce the design language (angular panels,
// uppercase labels, element accents) so screens compose consistently.
//
// No component here accepts a `style` prop from the outside — the design
// language is enforced, not suggested.
// =============================================================================

import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  LETTER_SPACING,
  SPACING,
  RADIUS,
  BORDER,
  elementAccent,
  rarityColor,
} from '@/theme/tokens'
import type { Element, Rank, Rarity, StatKey } from '@/types'

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface PanelProps {
  children: React.ReactNode
  element?: Element | null
  variant?: 'surface' | 'surfaceHigh' | 'transparent'
  padding?: keyof typeof SPACING
  elevated?: boolean
}

export const Panel: React.FC<PanelProps> = ({
  children,
  element = null,
  variant = 'surface',
  padding = 'md',
  elevated = false,
}) => {
  const palette = elementAccent(element)
  const background =
    variant === 'transparent'
      ? 'transparent'
      : variant === 'surfaceHigh'
        ? COLORS.surfaceHigh
        : COLORS.surface

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: background,
          padding: SPACING[padding],
          borderColor: elevated ? palette.border : COLORS.borderMid,
          borderWidth: elevated ? BORDER.mid : BORDER.thin,
        },
      ]}
    >
      {children}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

interface HeadingProps {
  children: string | number
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'display'
  element?: Element | null
  dim?: boolean
}

export const Heading: React.FC<HeadingProps> = ({
  children,
  size = 'lg',
  element = null,
  dim = false,
}) => {
  const palette = elementAccent(element)
  const color = dim ? COLORS.textSecondary : element ? palette.bright : COLORS.textPrimary
  const fontSize =
    size === 'display' ? FONT_SIZES.display :
    size === 'xl' ? FONT_SIZES.xxl :
    size === 'lg' ? FONT_SIZES.xl :
    size === 'md' ? FONT_SIZES.lg :
    FONT_SIZES.md

  return (
    <Text
      style={[
        styles.heading,
        {
          color,
          fontSize,
          letterSpacing: size === 'display' ? LETTER_SPACING.wide : LETTER_SPACING.normal,
        },
      ]}
    >
      {String(children).toUpperCase()}
    </Text>
  )
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

interface LabelProps {
  children: string | number
  variant?: 'primary' | 'secondary' | 'tertiary' | 'mono' | 'rarity'
  rarity?: Rarity
  size?: 'xs' | 'sm' | 'md' | 'lg'
  uppercase?: boolean
}

export const Label: React.FC<LabelProps> = ({
  children,
  variant = 'secondary',
  rarity,
  size = 'sm',
  uppercase = true,
}) => {
  const color =
    variant === 'rarity' && rarity ? rarityColor(rarity) :
    variant === 'primary' ? COLORS.textPrimary :
    variant === 'tertiary' ? COLORS.textTertiary :
    COLORS.textSecondary

  const fontFamily = variant === 'mono' ? FONTS.mono : FONTS.display
  const fontSize =
    size === 'xs' ? FONT_SIZES.xs :
    size === 'sm' ? FONT_SIZES.sm :
    size === 'lg' ? FONT_SIZES.lg :
    FONT_SIZES.md
  const text = uppercase && typeof children === 'string' ? children.toUpperCase() : String(children)

  return (
    <Text
      style={[
        styles.label,
        {
          color,
          fontFamily,
          fontSize,
          letterSpacing: LETTER_SPACING.normal,
        },
      ]}
    >
      {text}
    </Text>
  )
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

interface ButtonProps {
  label: string
  onPress: () => void
  element?: Element | null
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  element = null,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
}) => {
  const palette = elementAccent(element)

  const backgroundColor =
    variant === 'ghost' ? 'transparent' :
    variant === 'danger' ? COLORS.error + '22' :
    palette.mid

  const borderColor =
    variant === 'ghost' ? palette.border :
    variant === 'danger' ? COLORS.error :
    palette.base

  const textColor =
    variant === 'ghost' ? palette.base :
    variant === 'danger' ? COLORS.error :
    palette.bright

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.4 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            { color: textColor },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// StatChip
// ---------------------------------------------------------------------------

interface StatChipProps {
  statKey: StatKey
  value: number
  gain?: number
  element?: Element | null
}

export const StatChip: React.FC<StatChipProps> = ({ statKey, value, gain, element }) => {
  const palette = elementAccent(element)

  return (
    <View style={[styles.statChip, { borderColor: palette.border }]}>
      <Text style={[styles.statChipKey, { color: palette.base, fontFamily: FONTS.display }]}>
        {statKey}
      </Text>
      <Text style={[styles.statChipValue, { fontFamily: FONTS.mono }]}>
        {value}
      </Text>
      {gain !== undefined && gain > 0 && (
        <Text style={[styles.statChipGain, { color: COLORS.success }]}>
          +{gain}
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// RankBadge
// ---------------------------------------------------------------------------

const RANK_COLORS: Record<Rank, string> = {
  E: '#8a90a8',
  D: '#4ade80',
  C: '#60a5fa',
  B: '#a78bfa',
  A: '#f97316',
  S: '#f59e0b',
  Sovereign: '#e11d48',
}

interface RankBadgeProps {
  rank: Rank
  size?: 'sm' | 'md' | 'lg'
}

export const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = 'md' }) => {
  const color = RANK_COLORS[rank]
  const fontSize = size === 'sm' ? FONT_SIZES.xs : size === 'lg' ? FONT_SIZES.xl : FONT_SIZES.md
  const padding = size === 'sm' ? 4 : size === 'lg' ? 10 : 6

  return (
    <View
      style={[
        styles.rankBadge,
        {
          borderColor: color,
          paddingHorizontal: padding + 4,
          paddingVertical: padding,
        },
      ]}
    >
      <Text
        style={[
          styles.rankBadgeText,
          { color, fontSize },
        ]}
      >
        {rank === 'Sovereign' ? 'SOVEREIGN' : `RANK ${rank}`}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

export const Divider: React.FC<{ element?: Element | null }> = ({ element }) => {
  const palette = elementAccent(element)
  return (
    <View
      style={{
        height: 1,
        backgroundColor: element ? palette.border : COLORS.borderLow,
        marginVertical: SPACING.md,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Spacer
// ---------------------------------------------------------------------------

export const Spacer: React.FC<{ size?: keyof typeof SPACING }> = ({ size = 'md' }) => (
  <View style={{ height: SPACING[size] }} />
)

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  panel: {
    borderRadius: RADIUS.slight,
    borderWidth: BORDER.thin,
  } as ViewStyle,

  heading: {
    fontFamily: FONTS.display,
  } as TextStyle,

  label: {
    // fontFamily set inline from variant
  } as TextStyle,

  button: {
    borderWidth: BORDER.mid,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  buttonLabel: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.md,
    letterSpacing: LETTER_SPACING.wide,
  } as TextStyle,

  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surfaceHigh,
  } as ViewStyle,

  statChipKey: {
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.normal,
  } as TextStyle,

  statChipValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  } as TextStyle,

  statChipGain: {
    fontSize: FONT_SIZES.xs,
    fontFamily: FONTS.mono,
  } as TextStyle,

  rankBadge: {
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.sharp,
    alignSelf: 'flex-start',
  } as ViewStyle,

  rankBadgeText: {
    fontFamily: FONTS.display,
    letterSpacing: LETTER_SPACING.wide,
  } as TextStyle,
})
