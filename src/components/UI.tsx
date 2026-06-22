// =============================================================================
// Aeternum — Shared UI Primitives
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
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  LETTER_SPACING,
  SPACING,
  RADIUS,
  BORDER,
  SHADOWS,
  elementAccent,
  rarityColor,
} from '@/theme/tokens'
import type { Element, Rank, Rarity, StatKey } from '@/types'

// ---------------------------------------------------------------------------
// Icon — single source of truth for vector glyphs (MaterialCommunityIcons)
//
// The Korean-RPG UI uses MaterialCommunityIcons (ships with @expo/vector-icons,
// zero extra deps). Data-layer `icon:` fields now store MCI glyph names. As a
// safety net for legacy/persisted data that still carries emoji or geometric
// glyph strings, `GLYPH_TO_ICON` maps those forward to MCI names so nothing
// renders as raw text.
// ---------------------------------------------------------------------------

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name']

// Legacy emoji / geometric-glyph → MCI name. Keeps old persisted data rendering.
const GLYPH_TO_ICON: Record<string, IconName> = {
  // skills
  '🌑': 'weather-night', '🛡️': 'shield', '🛡': 'shield', '🔥': 'fire',
  '🔮': 'crystal-ball', '🌪️': 'weather-tornado', '✨': 'shimmer', '👁️': 'eye',
  '⚔️': 'sword-cross', '⚔': 'sword-cross', '🗿': 'image-filter-hdr',
  '❄️': 'snowflake', '🔵': 'circle', '🌿': 'leaf', '🏔': 'image-filter-hdr',
  '📦': 'package-variant-closed', '🗺️': 'map', '🏴': 'flag', '⛏️': 'pickaxe',
  '⛏': 'pickaxe', '🏃': 'run', '⭐': 'star', '⚒': 'hammer',
  // resources / elements (geometric glyphs)
  '⚙': 'cog', '◈': 'rhombus', '✦': 'star-four-points', '❧': 'leaf',
  '◆': 'rhombus-medium', '▲': 'triangle', '▽': 'triangle-down-outline',
  '✣': 'flower', '❅': 'snowflake', '⬢': 'hexagon', '≋': 'weather-windy',
  '⚡': 'flash',
}

// Resolve any stored icon value (MCI name OR legacy glyph) to a valid MCI name.
export function resolveIconName(value: string): IconName {
  return GLYPH_TO_ICON[value] ?? (value as IconName)
}

interface IconProps {
  name: string
  size?: number
  color?: string | undefined
  style?: TextStyle
}

export const Icon: React.FC<IconProps> = ({ name, size = 18, color = COLORS.textPrimary, style }) => (
  <MaterialCommunityIcons name={resolveIconName(name)} size={size} color={color} style={style} />
)

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
// CornerPanel — Korean RPG corner-bracket panel
// ---------------------------------------------------------------------------

interface CornerPanelProps {
  children: React.ReactNode
  color?: string
  backgroundColor?: string
  padding?: number
  cornerSize?: number
}

export const CornerPanel: React.FC<CornerPanelProps> = ({
  children,
  color = COLORS.system,
  backgroundColor = COLORS.surface,
  padding = SPACING.md,
  cornerSize = 14,
}) => {
  const cw = BORDER.thick
  return (
    <View style={[cornerStyles.wrapper, { backgroundColor, padding }]}>
      {/* Corners */}
      <View style={[cornerStyles.corner, cornerStyles.tl, { borderColor: color, width: cornerSize, height: cornerSize, borderTopWidth: cw, borderLeftWidth: cw }]} />
      <View style={[cornerStyles.corner, cornerStyles.tr, { borderColor: color, width: cornerSize, height: cornerSize, borderTopWidth: cw, borderRightWidth: cw }]} />
      <View style={[cornerStyles.corner, cornerStyles.bl, { borderColor: color, width: cornerSize, height: cornerSize, borderBottomWidth: cw, borderLeftWidth: cw }]} />
      <View style={[cornerStyles.corner, cornerStyles.br, { borderColor: color, width: cornerSize, height: cornerSize, borderBottomWidth: cw, borderRightWidth: cw }]} />
      {children}
    </View>
  )
}

const cornerStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    borderRadius: RADIUS.sharp,
  } as ViewStyle,
  corner: {
    position: 'absolute',
  } as ViewStyle,
  tl: { top: 0, left: 0 } as ViewStyle,
  tr: { top: 0, right: 0 } as ViewStyle,
  bl: { bottom: 0, left: 0 } as ViewStyle,
  br: { bottom: 0, right: 0 } as ViewStyle,
})

// ---------------------------------------------------------------------------
// SystemWindow — Korean RPG "[ SYSTEM ]" notification panel
// ---------------------------------------------------------------------------

interface SystemWindowProps {
  children: React.ReactNode
  title?: string
  variant?: 'info' | 'gold' | 'alert'
  icon?: string   // optional MCI glyph rendered before the title
}

export const SystemWindow: React.FC<SystemWindowProps> = ({
  children,
  title = 'SYSTEM',
  variant = 'info',
  icon,
}) => {
  const borderColor =
    variant === 'gold' ? COLORS.systemGold :
    variant === 'alert' ? COLORS.systemAlert :
    COLORS.system

  const headerBg =
    variant === 'gold' ? COLORS.systemGoldDim :
    variant === 'alert' ? COLORS.systemAlertDim :
    COLORS.systemDim

  const glow =
    variant === 'gold' ? SHADOWS.glowGold :
    variant === 'alert' ? SHADOWS.glowRed :
    SHADOWS.glowBlue

  return (
    <View style={[sysStyles.container, { borderColor }, glow]}>
      <View style={[sysStyles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <Text style={[sysStyles.headerText, { color: borderColor }]}>
          {icon ? <><Icon name={icon} size={12} color={borderColor} />{'  '}</> : '◆ '}{title}{' ◆'}
        </Text>
      </View>
      <View style={sysStyles.body}>{children}</View>
    </View>
  )
}

const sysStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.sharp,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  } as ViewStyle,
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderBottomWidth: 1,
  } as ViewStyle,
  headerText: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.extraWide,
  } as TextStyle,
  body: {
    padding: SPACING.md,
  } as ViewStyle,
})

// ---------------------------------------------------------------------------
// StatBar — horizontal stat progress bar
// ---------------------------------------------------------------------------

interface StatBarProps {
  statKey: StatKey
  value: number
  maxValue?: number
  color?: string
  showLabel?: boolean
}

export const StatBar: React.FC<StatBarProps> = ({
  statKey,
  value,
  maxValue = 50,
  color = COLORS.system,
  showLabel = true,
}) => {
  const pct = Math.min(value / maxValue, 1)

  return (
    <View style={statBarStyles.row}>
      {showLabel && (
        <Text style={[statBarStyles.key, { color }]}>{statKey}</Text>
      )}
      <View style={statBarStyles.track}>
        <View style={[statBarStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        {/* Segment marks */}
        {[0.25, 0.5, 0.75].map((p) => (
          <View
            key={p}
            style={[statBarStyles.mark, { left: `${p * 100}%` }]}
          />
        ))}
      </View>
      <Text style={statBarStyles.value}>{value}</Text>
    </View>
  )
}

const statBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs + 2,
  } as ViewStyle,
  key: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.wide,
    width: 32,
  } as TextStyle,
  track: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 1,
    overflow: 'hidden',
    position: 'relative',
  } as ViewStyle,
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 1,
    opacity: 0.85,
  } as ViewStyle,
  mark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.ground,
  } as ViewStyle,
  value: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    width: 28,
    textAlign: 'right',
  } as TextStyle,
})

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

interface HeadingProps {
  children: string | number
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'display'
  element?: Element | null
  dim?: boolean
  system?: boolean
}

export const Heading: React.FC<HeadingProps> = ({
  children,
  size = 'lg',
  element = null,
  dim = false,
  system = false,
}) => {
  const palette = elementAccent(element)
  const color =
    system ? COLORS.system :
    dim ? COLORS.textSecondary :
    element ? palette.bright :
    COLORS.textPrimary

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
  variant?: 'primary' | 'secondary' | 'tertiary' | 'mono' | 'rarity' | 'system' | 'gold'
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
    variant === 'system' ? COLORS.system :
    variant === 'gold' ? COLORS.systemGold :
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
  variant?: 'primary' | 'ghost' | 'danger' | 'system'
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
    variant === 'system' ? COLORS.systemDim :
    palette.mid

  const borderColor =
    variant === 'ghost' ? palette.border :
    variant === 'danger' ? COLORS.error :
    variant === 'system' ? COLORS.system :
    palette.base

  const textColor =
    variant === 'ghost' ? palette.base :
    variant === 'danger' ? COLORS.error :
    variant === 'system' ? COLORS.system :
    palette.bright

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.35 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.buttonLabel, { color: textColor }]}>
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

export const RANK_COLORS: Record<Rank, string> = {
  E: '#4a5068',
  D: '#3ddc84',
  C: '#4fa8f8',
  B: '#a78bfa',
  A: '#f97316',
  S: '#ffd54f',
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
          backgroundColor: color + '18',
          paddingHorizontal: padding + 4,
          paddingVertical: padding,
        },
      ]}
    >
      <Text style={[styles.rankBadgeText, { color, fontSize }]}>
        {rank === 'Sovereign' ? 'GRANDMASTER' : `RANK ${rank}`}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// DungeonRankBadge — for F/E/D/C/B/A/S dungeon ranks
// ---------------------------------------------------------------------------

const DUNGEON_RANK_COLORS: Record<string, string> = {
  F: '#4a5068',
  E: '#3ddc84',
  D: '#4fa8f8',
  C: '#a78bfa',
  B: '#f97316',
  A: '#ffd54f',
  S: '#e11d48',
}

interface DungeonRankBadgeProps {
  rank: string
  size?: 'sm' | 'md'
}

export const DungeonRankBadge: React.FC<DungeonRankBadgeProps> = ({ rank, size = 'md' }) => {
  const color = DUNGEON_RANK_COLORS[rank] ?? COLORS.textSecondary
  const fontSize = size === 'sm' ? FONT_SIZES.xs : FONT_SIZES.sm

  return (
    <View style={[styles.rankBadge, { borderColor: color, backgroundColor: color + '18', paddingHorizontal: 8, paddingVertical: 4 }]}>
      <Text style={[styles.rankBadgeText, { color, fontSize }]}>
        {`RANK ${rank}`}
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
// SectionHeader — Korean RPG section divider with ◆ decorator
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string
  color?: string
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  color = COLORS.system,
}) => (
  <View style={secStyles.row}>
    <View style={[secStyles.line, { backgroundColor: color + '40' }]} />
    <Text style={[secStyles.text, { color }]}>{'◆ '}{title.toUpperCase()}{' ◆'}</Text>
    <View style={[secStyles.line, { backgroundColor: color + '40' }]} />
  </View>
)

const secStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  } as ViewStyle,
  line: {
    flex: 1,
    height: 1,
  } as ViewStyle,
  text: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.extraWide,
  } as TextStyle,
})

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

  label: {} as TextStyle,

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
