// =============================================================================
// Aeternum — Command Hub (main screen)
// =============================================================================
// The player's home base. Shows rank, title, active elements, total distance,
// and quick-action buttons for sync and party.
//
// This is the first screen the player sees after opening the app post-run.
// =============================================================================

import React from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer } from '@/store/useStore'
import { Panel, Heading, Label, Button, RankBadge, Divider, Spacer } from '@/components/UI'
import { COLORS, SPACING, elementAccent } from '@/theme/tokens'
import { ELEMENT_LABELS, DISTANCE_TIERS } from '@/types'
import type { Element } from '@/types'

export default function CommandHub() {
  const player = useStore(selectPlayer)

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

  // Find next distance tier
  const currentTier = DISTANCE_TIERS.findIndex(
    (t) => player.total_distance_km >= t.minKm && player.total_distance_km < t.maxKm,
  )
  const nextTier = DISTANCE_TIERS[currentTier + 1]
  const tierProgress = nextTier
    ? (player.total_distance_km - (DISTANCE_TIERS[currentTier]?.minKm ?? 0)) /
      (nextTier.minKm - (DISTANCE_TIERS[currentTier]?.minKm ?? 0))
    : 1

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
              <Heading size="xl" element={element}>
                {`${player.total_distance_km.toFixed(1)} km`}
              </Heading>
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
              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(tierProgress * 100)}%`, backgroundColor: palette.base },
                  ]}
                />
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

        {/* Quick actions */}
        <Heading size="sm" dim>Quick Actions</Heading>
        <Spacer size="sm" />

        <Button
          label="Sync Run"
          element={element}
          onPress={() => router.push('/sync')}
          fullWidth
        />
        <Spacer size="sm" />
        <Button
          label="View Rewards"
          element={element}
          variant="ghost"
          onPress={() => router.push('/rewards')}
          fullWidth
        />
        <Spacer size="sm" />
        <Button
          label="Party Hub"
          element={element}
          variant="ghost"
          onPress={() => router.push('/party')}
          fullWidth
        />

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
  header: {
    alignItems: 'flex-start',
    paddingTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  flex1: {
    flex: 1,
  },
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
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
})
