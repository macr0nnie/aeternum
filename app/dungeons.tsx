// =============================================================================
// Aeternum — Dungeons Screen
// =============================================================================
// Stat-gated dungeon map. No active combat — dungeons are cleared by meeting
// stat requirements. Clearing awards stat bonuses immediately.
// =============================================================================

import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer, selectClearedDungeonIds } from '@/store/useStore'
import {
  Heading, Label, Button, Spacer, Divider, DungeonRankBadge, SystemWindow,
  CornerPanel, SectionHeader, StatBar,
} from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, BORDER, RADIUS,
  elementAccent, SHADOWS,
} from '@/theme/tokens'
import { DUNGEON_ENTRIES, STAT_KEYS, STAT_LABELS, type DungeonEntry, type Element } from '@/types'

const DUNGEON_RANK_COLORS: Record<string, string> = {
  F: '#4a5068', E: '#3ddc84', D: '#4fa8f8',
  C: '#a78bfa', B: '#f97316', A: '#ffd54f', S: '#e11d48',
}

export default function DungeonsScreen() {
  const player = useStore(selectPlayer)
  const clearedIds = useStore(selectClearedDungeonIds)
  const { clearDungeon } = useStore()

  const [selectedDungeon, setSelectedDungeon] = useState<DungeonEntry | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)
  const rawStats = player?.stats ?? { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 0, PER: 0, CHA: 0 }
  const stats: Record<string, number> = rawStats as unknown as Record<string, number>
  const totalDistance = player?.total_distance_km ?? 0

  function meetsRequirements(dungeon: DungeonEntry): boolean {
    if (totalDistance < dungeon.minDistanceKm) return false
    for (const [key, minVal] of Object.entries(dungeon.statRequirements)) {
      const current = stats[key as keyof typeof stats] ?? 0
      if (current < (minVal as number)) return false
    }
    return true
  }

  function handleEnterDungeon(dungeon: DungeonEntry) {
    setSelectedDungeon(dungeon)
    setShowClearModal(true)
  }

  function handleClear() {
    if (!selectedDungeon) return
    clearDungeon(selectedDungeon.id, selectedDungeon.statRewards)
    setShowClearModal(false)
    setSelectedDungeon(null)
  }

  const grouped = ['F', 'E', 'D', 'C', 'B', 'A', 'S'].reduce<Record<string, DungeonEntry[]>>(
    (acc, rank) => {
      acc[rank] = DUNGEON_ENTRIES.filter((d) => d.rank === rank)
      return acc
    },
    {},
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Gate Map</Heading>
        <Spacer size="xs" />
        <Label variant="secondary">
          Meet the stat requirements to enter a gate. Cleared gates award permanent stat bonuses.
        </Label>

        <Spacer size="lg" />

        {/* Player stat summary */}
        <SystemWindow title="HUNTER STATUS">
          {STAT_KEYS.map((key) => {
            const color = palette.base
            return (
              <StatBar key={key} statKey={key} value={stats[key] ?? 0} color={color} />
            )
          })}
          <Spacer size="xs" />
          <View style={styles.distanceRow}>
            <Label variant="tertiary" size="xs">Total Distance</Label>
            <Text style={styles.distanceValue}>{totalDistance.toFixed(1)} km</Text>
          </View>
        </SystemWindow>

        <SectionHeader title="Available Gates" color={palette.base} />

        {['F', 'E', 'D', 'C', 'B', 'A', 'S'].map((rank) => {
          const dungeons = grouped[rank]
          if (!dungeons || dungeons.length === 0) return null
          const rankColor = DUNGEON_RANK_COLORS[rank]
          return (
            <View key={rank}>
              <View style={[styles.rankHeader, { borderLeftColor: rankColor }]}>
                <Text style={[styles.rankLabel, { color: rankColor }]}>
                  {`RANK ${rank} GATES`}
                </Text>
              </View>
              {dungeons.map((dungeon) => {
                const unlocked = meetsRequirements(dungeon)
                const cleared = clearedIds.includes(dungeon.id)
                return (
                  <DungeonCard
                    key={dungeon.id}
                    dungeon={dungeon}
                    unlocked={unlocked}
                    cleared={cleared}
                    stats={stats}
                    totalDistance={totalDistance}
                    onEnter={() => handleEnterDungeon(dungeon)}
                  />
                )
              })}
              <Spacer size="sm" />
            </View>
          )
        })}

        <Spacer size="xl" />
      </ScrollView>

      {/* Clear confirmation modal */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedDungeon && (
              <SystemWindow
                title="GATE ENTRY CONFIRMED"
                variant={selectedDungeon.rank === 'S' ? 'gold' : selectedDungeon.rank === 'A' || selectedDungeon.rank === 'B' ? 'alert' : 'info'}
              >
                <Text style={styles.modalDungeonName}>{selectedDungeon.name.toUpperCase()}</Text>
                <Spacer size="xs" />
                <Text style={styles.modalFlavor}>{`"${selectedDungeon.flavor}"`}</Text>
                <Divider />
                <Label variant="tertiary" size="xs">Stat Rewards</Label>
                <Spacer size="xs" />
                <View style={styles.rewardGrid}>
                  {Object.entries(selectedDungeon.statRewards).map(([k, v]) => (
                    <View key={k} style={styles.rewardChip}>
                      <Text style={styles.rewardKey}>{k}</Text>
                      <Text style={styles.rewardVal}>{`+${v}`}</Text>
                    </View>
                  ))}
                </View>
                <Spacer size="lg" />
                <View style={styles.modalActions}>
                  <Button
                    label="Clear Gate"
                    variant="system"
                    onPress={handleClear}
                    fullWidth
                  />
                  <Spacer size="sm" />
                  <Button
                    label="Retreat"
                    variant="ghost"
                    onPress={() => setShowClearModal(false)}
                    fullWidth
                  />
                </View>
              </SystemWindow>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// DungeonCard
// ---------------------------------------------------------------------------

function DungeonCard({
  dungeon,
  unlocked,
  cleared,
  stats,
  totalDistance,
  onEnter,
}: {
  dungeon: DungeonEntry
  unlocked: boolean
  cleared: boolean
  stats: Record<string, number>
  totalDistance: number
  onEnter: () => void
}) {
  const rankColor = DUNGEON_RANK_COLORS[dungeon.rank]
  const [expanded, setExpanded] = useState(false)

  const missingStats = Object.entries(dungeon.statRequirements).filter(
    ([k, v]) => (stats[k] ?? 0) < (v as number),
  )
  const distanceMet = totalDistance >= dungeon.minDistanceKm

  return (
    <TouchableOpacity
      activeOpacity={unlocked ? 0.8 : 0.95}
      onPress={() => unlocked && !cleared && setExpanded((p) => !p)}
      style={[
        cardStyles.card,
        {
          borderColor: cleared ? rankColor + '60' : unlocked ? rankColor + 'aa' : COLORS.borderLow,
          backgroundColor: cleared ? COLORS.surfaceHigh : unlocked ? COLORS.surface : COLORS.locked,
          opacity: cleared ? 0.6 : 1,
        },
        unlocked && !cleared && { ...(SHADOWS.md as object) },
      ]}
    >
      {/* Top row */}
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.rankStripe, { backgroundColor: rankColor }]} />
        <View style={cardStyles.info}>
          <View style={cardStyles.nameRow}>
            <DungeonRankBadge rank={dungeon.rank} size="sm" />
            <Text style={[
              cardStyles.name,
              { color: cleared ? COLORS.textTertiary : unlocked ? COLORS.textPrimary : COLORS.textTertiary },
            ]}>
              {cleared ? `[CLEARED] ${dungeon.name.toUpperCase()}` : dungeon.name.toUpperCase()}
            </Text>
          </View>
          <Text style={cardStyles.desc} numberOfLines={expanded ? undefined : 1}>
            {dungeon.description}
          </Text>
        </View>
        {/* Lock indicator */}
        {!unlocked && (
          <Text style={cardStyles.lockIcon}>⊘</Text>
        )}
        {cleared && (
          <Text style={[cardStyles.lockIcon, { color: rankColor }]}>✓</Text>
        )}
      </View>

      {/* Requirements (shown when locked) */}
      {!unlocked && !cleared && (
        <View style={cardStyles.reqRow}>
          {!distanceMet && (
            <View style={cardStyles.reqChip}>
              <Text style={cardStyles.reqKey}>DIST</Text>
              <Text style={cardStyles.reqVal}>{totalDistance.toFixed(0)}/{dungeon.minDistanceKm} km</Text>
            </View>
          )}
          {missingStats.slice(0, 4).map(([k, v]) => (
            <View key={k} style={cardStyles.reqChip}>
              <Text style={cardStyles.reqKey}>{k}</Text>
              <Text style={cardStyles.reqVal}>{stats[k] ?? 0}/{v}</Text>
            </View>
          ))}
          {missingStats.length > 4 && (
            <Text style={cardStyles.reqMore}>{`+${missingStats.length - 4} more`}</Text>
          )}
        </View>
      )}

      {/* Expanded: rewards + enter button */}
      {expanded && unlocked && !cleared && (
        <View style={cardStyles.expandedSection}>
          <Text style={[cardStyles.flavorText, { color: rankColor + 'cc' }]}>
            {`"${dungeon.flavor}"`}
          </Text>
          <Spacer size="sm" />
          <View style={cardStyles.rewardRow}>
            {Object.entries(dungeon.statRewards).map(([k, v]) => (
              <View key={k} style={[cardStyles.rewardChip, { borderColor: rankColor + '60' }]}>
                <Text style={[cardStyles.rewardKey, { color: rankColor }]}>{k}</Text>
                <Text style={cardStyles.rewardVal}>{`+${v}`}</Text>
              </View>
            ))}
          </View>
          <Spacer size="md" />
          <TouchableOpacity
            onPress={onEnter}
            style={[cardStyles.enterBtn, { borderColor: rankColor, backgroundColor: rankColor + '18' }]}
            activeOpacity={0.75}
          >
            <Text style={[cardStyles.enterBtnText, { color: rankColor }]}>
              {'◆ ENTER GATE ◆'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { padding: SPACING.md },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.xs,
  },
  distanceValue: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  },
  rankHeader: {
    borderLeftWidth: 3,
    paddingLeft: SPACING.sm,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  rankLabel: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.extraWide,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContainer: { width: '100%' },
  modalDungeonName: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: SPACING.xs,
  },
  modalFlavor: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: BORDER.thin,
    borderColor: COLORS.systemBorder,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: COLORS.systemDim,
  },
  rewardKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.system,
    letterSpacing: LETTER_SPACING.normal,
  },
  rewardVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
  },
  modalActions: {},
})

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.slight,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  rankStripe: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    minHeight: 40,
  },
  info: { flex: 1, gap: 4 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.normal,
    flex: 1,
  },
  desc: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    lineHeight: FONT_SIZES.xs * 1.6,
  },
  lockIcon: {
    fontSize: 18,
    color: COLORS.textTertiary,
    paddingRight: SPACING.sm,
  },
  reqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm + 6,
    paddingBottom: SPACING.sm,
  },
  reqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    backgroundColor: COLORS.surfaceHigh,
  },
  reqKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: LETTER_SPACING.tight,
  },
  reqVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
  reqMore: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    alignSelf: 'center',
  },
  expandedSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLow,
  },
  flavorText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    fontStyle: 'italic',
    lineHeight: FONT_SIZES.xs * 1.6,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    backgroundColor: COLORS.surfaceHigh,
  },
  rewardKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.tight,
  },
  rewardVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
  },
  enterBtn: {
    borderWidth: BORDER.mid,
    borderRadius: RADIUS.sharp,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  enterBtnText: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.extraWide,
  },
})
