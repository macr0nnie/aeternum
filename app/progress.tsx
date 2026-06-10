// =============================================================================
// Aeternum — Skill + Progression Screen
// =============================================================================
// Shows distance tier progress toward next rank, stat growth history, element
// unlock status, and the type matchup chart (for PvP planning).
//
// All data is read from the Zustand store — no network calls on this screen.
// The matchup chart renders the full 10×10 grid so players can plan PvP loadouts.
// =============================================================================

import React, { useState } from 'react'
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer } from '@/store/useStore'
import { Panel, Heading, Label, Spacer, Divider } from '@/components/UI'
import {
  COLORS, SPACING, elementAccent, rarityColor,
} from '@/theme/tokens'
import {
  ELEMENTS, ELEMENT_LABELS, DISTANCE_TIERS, TYPE_MATCHUP_CHART,
  STAT_KEYS, STAT_LABELS, STAT_SOURCES, RANK_DISTANCE_THRESHOLDS, RANKS,
  type Element, type Rank,
} from '@/types'

export default function ProgressScreen() {
  const player = useStore(selectPlayer)
  const [matchupFocusElement, setMatchupFocusElement] = useState<Element | null>(null)

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Label>Loading progress...</Label>
        </View>
      </SafeAreaView>
    )
  }

  const element = player.primary_element as Element | null
  const palette = elementAccent(element)

  // Rank progress
  const currentRankIdx = RANKS.indexOf(player.rank as Rank)
  const nextRank = RANKS[currentRankIdx + 1] as Rank | undefined
  const currentThreshold = RANK_DISTANCE_THRESHOLDS[player.rank as Rank]
  const nextThreshold = nextRank ? RANK_DISTANCE_THRESHOLDS[nextRank] : null
  const rankProgress = nextThreshold
    ? (player.total_distance_km - currentThreshold) / (nextThreshold - currentThreshold)
    : 1

  // Focus element for matchup (default to player's primary)
  const focusEl = matchupFocusElement ?? element ?? ELEMENTS[0] ?? 'fire'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Progress</Heading>

        <Spacer size="lg" />

        {/* Rank progress */}
        <Panel element={element} elevated>
          <View style={styles.row}>
            <Label variant="tertiary">Current Rank</Label>
            <Label variant="primary" size="md">{player.rank}</Label>
          </View>
          {nextRank && (
            <>
              <Spacer size="sm" />
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, Math.round(rankProgress * 100))}%`, backgroundColor: palette.base },
                  ]}
                />
              </View>
              <Spacer size="xs" />
              <View style={styles.row}>
                <Label variant="tertiary" size="xs">{`${player.total_distance_km.toFixed(1)} km`}</Label>
                <Label variant="tertiary" size="xs">
                  {`${nextThreshold ?? ''} km → Rank ${nextRank ?? ''}`}
                </Label>
              </View>
            </>
          )}
          {!nextRank && (
            <Label variant="secondary">Maximum rank achieved.</Label>
          )}
        </Panel>

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Distance tiers */}
        <Label variant="tertiary">Distance Tiers</Label>
        <Spacer size="sm" />
        {DISTANCE_TIERS.map((tier, i) => {
          const reached = player.total_distance_km >= tier.minKm
          const isCurrent = player.total_distance_km >= tier.minKm &&
            (i === DISTANCE_TIERS.length - 1 || player.total_distance_km < (DISTANCE_TIERS[i + 1]?.minKm ?? Infinity))

          return (
            <View
              key={tier.label}
              style={[
                styles.tierRow,
                isCurrent && { borderColor: palette.base },
              ]}
            >
              <View style={styles.tierLeft}>
                <Label
                  variant={reached ? 'primary' : 'tertiary'}
                  size="md"
                >
                  {`${tier.minKm === 0 ? '0' : tier.minKm}${tier.maxKm !== Infinity ? `–${tier.maxKm}` : '+'} km`}
                </Label>
                <Label variant="secondary" size="xs">{tier.encounterLabel}</Label>
              </View>
              <Label variant="rarity" rarity={tier.rarity} size="xs">{tier.rarity}</Label>
            </View>
          )
        })}

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Stat growth guide */}
        <Label variant="tertiary">Stat Growth</Label>
        <Spacer size="sm" />
        {STAT_KEYS.map((key) => (
          <View key={key} style={styles.statGuideRow}>
            <View style={styles.statGuideLeft}>
              <Label variant="primary" size="sm">{key}</Label>
              <Label variant="secondary" size="xs">{STAT_LABELS[key]}</Label>
            </View>
            <Label variant="tertiary" size="xs">{STAT_SOURCES[key]}</Label>
            <Label variant="mono" size="md">{player.stats[key]}</Label>
          </View>
        ))}

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Element unlock status */}
        <Label variant="tertiary">Elements</Label>
        <Spacer size="sm" />
        <Panel variant="surfaceHigh">
          <View style={styles.elementGrid}>
            {ELEMENTS.map((el) => {
              const unlocked =
                el === player.primary_element || el === player.secondary_element
              const elPalette = elementAccent(el)
              return (
                <View
                  key={el}
                  style={[
                    styles.elementCell,
                    {
                      borderColor: unlocked ? elPalette.base : COLORS.borderLow,
                      backgroundColor: unlocked ? elPalette.dim : COLORS.surfaceHigh,
                      opacity: unlocked ? 1 : 0.4,
                    },
                  ]}
                >
                  <Label
                    variant={unlocked ? 'primary' : 'tertiary'}
                    size="xs"
                  >
                    {ELEMENT_LABELS[el]}
                  </Label>
                </View>
              )
            })}
          </View>
          <Spacer size="xs" />
          <Label variant="tertiary" size="xs">
            Unlock by defeating elemental bosses + hitting distance milestones.
          </Label>
        </Panel>

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Type matchup chart */}
        <Label variant="tertiary">Type Matchup (PvP)</Label>
        <Spacer size="xs" />
        <Label variant="secondary" size="xs">
          Select attacker element to view effectiveness against all defenders.
        </Label>
        <Spacer size="sm" />

        {/* Element selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.selectorRow}>
            {ELEMENTS.map((el) => {
              const elPalette = elementAccent(el)
              const active = focusEl === el
              return (
                <TouchableOpacity
                  key={el}
                  onPress={() => setMatchupFocusElement(el)}
                  style={[
                    styles.selectorChip,
                    {
                      borderColor: active ? elPalette.base : COLORS.borderLow,
                      backgroundColor: active ? elPalette.dim : 'transparent',
                    },
                  ]}
                >
                  <Label variant={active ? 'primary' : 'tertiary'} size="xs">
                    {ELEMENT_LABELS[el]}
                  </Label>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        <Spacer size="sm" />

        {/* Matchup rows */}
        {ELEMENTS.map((defEl) => {
          const multiplier = TYPE_MATCHUP_CHART[focusEl as Element]?.[defEl] ?? 1
          const effectivenessColor =
            multiplier === 2 ? COLORS.success :
            multiplier === 0.5 ? COLORS.error :
            multiplier === 0 ? COLORS.textTertiary :
            COLORS.textSecondary
          const label =
            multiplier === 2 ? 'Super Effective' :
            multiplier === 0.5 ? 'Not Very Effective' :
            multiplier === 0 ? 'Immune' :
            'Normal'

          return (
            <View key={defEl} style={styles.matchupRow}>
              <Label variant="secondary" size="sm">{ELEMENT_LABELS[defEl]}</Label>
              <View style={styles.matchupRight}>
                <Label variant="primary" size="md">{`${multiplier}x`}</Label>
                <Label size="xs" variant="secondary">{label}</Label>
              </View>
            </View>
          )
        })}

        <Spacer size="xl" />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ground,
  },
  scroll: {
    padding: SPACING.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.borderLow,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLow,
    borderRadius: 2,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  tierLeft: {
    gap: 2,
  },
  statGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLow,
    gap: SPACING.sm,
  },
  statGuideLeft: {
    width: 60,
  },
  elementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  elementCell: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    minWidth: 80,
    alignItems: 'center',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  selectorChip: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  matchupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLow,
  },
  matchupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
})
