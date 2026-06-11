// =============================================================================
// Aeternum — Command Hub
// =============================================================================

import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer, selectSyncState, selectLatestRunResult } from '@/store/useStore'
import { Panel, Heading, Label, RankBadge, Divider, Spacer, SystemWindow } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, elementAccent, rarityColor } from '@/theme/tokens'
import { ELEMENT_LABELS, DISTANCE_TIERS } from '@/types'
import type { Element } from '@/types'

export default function CommandHub() {
  const player = useStore(selectPlayer)
  const syncState = useStore(selectSyncState)
  const latestResult = useStore(selectLatestRunResult)
  const syncError = useStore(s => s.syncError)

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Label>Loading commander data...</Label>
        </View>
      </SafeAreaView>
    )
  }

  const element = player.primary_element as Element | null
  const palette = elementAccent(element)

  const currentTierIdx = DISTANCE_TIERS.findIndex(
    t => player.total_distance_km >= t.minKm && player.total_distance_km < t.maxKm,
  )
  const nextTier = DISTANCE_TIERS[currentTierIdx + 1]
  const tierProgress = nextTier
    ? (player.total_distance_km - (DISTANCE_TIERS[currentTierIdx]?.minKm ?? 0)) /
      (nextTier.minKm - (DISTANCE_TIERS[currentTierIdx]?.minKm ?? 0))
    : 1

  const isActive = syncState === 'reading' || syncState === 'uploading'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <RankBadge rank={player.rank} size="sm" />
          <Spacer size="sm" />
          <Heading size="display" element={element}>{player.username}</Heading>
          <Label variant="secondary">{player.title}</Label>
        </View>

        <Spacer size="md" />

        {/* Element panel */}
        <Panel element={element} elevated>
          <Label variant="tertiary">Active Element</Label>
          <Spacer size="xs" />
          <View style={styles.row}>
            {element && (
              <View style={[styles.elementPill, { backgroundColor: palette.dim, borderColor: palette.base }]}>
                <Label variant="primary" size="md">{ELEMENT_LABELS[element]}</Label>
              </View>
            )}
            {player.secondary_element && (
              <View style={[
                styles.elementPill,
                {
                  backgroundColor: elementAccent(player.secondary_element as Element).dim,
                  borderColor: elementAccent(player.secondary_element as Element).base,
                },
              ]}>
                <Label variant="primary" size="md">
                  {ELEMENT_LABELS[player.secondary_element as Element]}
                </Label>
              </View>
            )}
            {!element && <Label variant="tertiary">No element equipped</Label>}
          </View>
        </Panel>

        <Spacer size="md" />

        {/* Distance panel */}
        <Panel variant="surfaceHigh">
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Label variant="tertiary">Total Distance</Label>
              <Spacer size="xs" />
              <Heading size="xl" element={element}>{`${player.total_distance_km.toFixed(1)} km`}</Heading>
            </View>
            <View style={styles.flex1}>
              <Label variant="tertiary">Next Threshold</Label>
              <Spacer size="xs" />
              {nextTier ? (
                <>
                  <Label variant="primary">{nextTier.encounterLabel}</Label>
                  <Label variant="mono">{`${nextTier.minKm} km`}</Label>
                </>
              ) : (
                <Label variant="primary">Sovereign</Label>
              )}
            </View>
          </View>
          {nextTier && (
            <>
              <Spacer size="sm" />
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(tierProgress * 100)}%`, backgroundColor: palette.base }]} />
              </View>
              <Spacer size="xs" />
              <Label variant="tertiary" size="xs">
                {`${(nextTier.minKm - player.total_distance_km).toFixed(1)} km remaining`}
              </Label>
            </>
          )}
        </Panel>

        <Spacer size="md" />
        <Divider element={element} />
        <Spacer size="md" />

        {/* Run sync status */}
        {isActive && (
          <SystemWindow title={syncState === 'reading' ? 'READING HEALTH DATA' : 'RESOLVING RUN'} variant="info">
            <Text style={styles.syncLine}>
              {syncState === 'reading'
                ? '> Fetching your last workout...'
                : '> Server validating distance and pace...'}
            </Text>
            <View style={styles.dots}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.dot, { backgroundColor: COLORS.system }]} />
              ))}
            </View>
          </SystemWindow>
        )}

        {syncState === 'done' && latestResult && (
          <SystemWindow title="◆ RUN RESOLVED ◆" variant="gold">
            {Object.keys(latestResult.stat_gains).length > 0 && (
              <>
                <Text style={styles.syncSubtitle}>STAT GAINS</Text>
                <View style={styles.gainRow}>
                  {Object.entries(latestResult.stat_gains).map(([k, v]) => (
                    <View key={k} style={styles.gainChip}>
                      <Text style={styles.gainKey}>{k}</Text>
                      <Text style={styles.gainVal}>{`+${v}`}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {latestResult.rewards.length > 0 && (
              <>
                <Spacer size="sm" />
                <Text style={styles.syncSubtitle}>REWARDS</Text>
                {latestResult.rewards.map(r => (
                  <Text key={r.id} style={[styles.rewardLine, { color: rarityColor(r.rarity) }]}>
                    {'◆ '}{r.name.toUpperCase()}
                  </Text>
                ))}
              </>
            )}
            {latestResult.flag_reason && (
              <Text style={styles.flagText}>{`⚠ ${latestResult.flag_reason}`}</Text>
            )}
          </SystemWindow>
        )}

        {syncState === 'error' && (
          <SystemWindow title="SYNC UNAVAILABLE" variant="alert">
            <Text style={styles.syncLine}>
              {syncError?.includes('No completed run') || syncError?.includes('48 hours')
                ? '> No recent run found. Complete a workout and reopen the app.'
                : syncError?.includes('Health') || syncError?.includes('permission')
                  ? '> Health permissions needed. Check your device settings.'
                  : '> Could not reach server. Check your connection.'}
            </Text>
          </SystemWindow>
        )}

        <Spacer size="xl" />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { padding: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'flex-start', paddingTop: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  flex1: { flex: 1 },
  elementPill: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.borderLow,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 1 },

  // Sync result
  syncLine: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  syncSubtitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: SPACING.xs,
  },
  dots: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  dot: { width: 6, height: 6, borderRadius: 1, opacity: 0.7 },
  gainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  gainChip: {
    flexDirection: 'row',
    gap: 3,
    borderWidth: 1,
    borderColor: COLORS.systemGold + '50',
    borderRadius: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: COLORS.systemGoldDim,
  },
  gainKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.systemGold,
    letterSpacing: LETTER_SPACING.tight,
  },
  gainVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '700',
  },
  rewardLine: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.normal,
    marginBottom: 2,
  },
  flagText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    marginTop: SPACING.xs,
  },
})
