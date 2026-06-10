// =============================================================================
// Aeternum — Player Identity Screen
// =============================================================================
// Shows the player's full profile: rank badge, title + chronicle, element pair,
// stats octagram, and total distance. Read-only — no editing here.
//
// The element pair determines the octagram accent colour and tab bar tint
// across the whole app (via the store-driven palette in _layout.tsx).
// =============================================================================

import React from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer } from '@/store/useStore'
import { Octagram } from '@/components/Octagram'
import { Panel, Heading, Label, RankBadge, Divider, Spacer } from '@/components/UI'
import { COLORS, SPACING, elementAccent } from '@/theme/tokens'
import { ELEMENT_LABELS, STAT_KEYS, STAT_LABELS, type Element } from '@/types'

export default function IdentityScreen() {
  const player = useStore(selectPlayer)

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Label>Loading identity...</Label>
        </View>
      </SafeAreaView>
    )
  }

  const element = player.primary_element as Element | null
  const secondaryElement = player.secondary_element as Element | null
  const palette = elementAccent(element)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Rank + name */}
        <View style={styles.header}>
          <RankBadge rank={player.rank} size="lg" />
          <Spacer size="md" />
          <Heading size="display" element={element}>{player.username}</Heading>
          <Spacer size="xs" />
          <Label variant="secondary" size="md">{player.title}</Label>
        </View>

        <Spacer size="lg" />

        {/* Octagram */}
        <View style={styles.octagramContainer}>
          <Octagram stats={player.stats} element={element} size={280} showLabels />
        </View>

        <Spacer size="lg" />

        {/* Stats breakdown */}
        <Panel element={element} elevated>
          <Label variant="tertiary">Stats</Label>
          <Spacer size="sm" />
          {STAT_KEYS.map((key) => (
            <View key={key} style={styles.statRow}>
              <Label variant="secondary" size="sm">{STAT_LABELS[key]}</Label>
              <Label variant="mono" size="md">{player.stats[key]}</Label>
            </View>
          ))}
        </Panel>

        <Spacer size="md" />

        {/* Elements */}
        <Panel variant="surfaceHigh">
          <Label variant="tertiary">Active Elements</Label>
          <Spacer size="sm" />
          <View style={styles.elementRow}>
            {element ? (
              <View style={[styles.elementBadge, { borderColor: palette.base, backgroundColor: palette.dim }]}>
                <Label variant="primary" size="md">Primary</Label>
                <Label variant="primary" size="lg">{ELEMENT_LABELS[element]}</Label>
              </View>
            ) : (
              <Label variant="tertiary">No primary element</Label>
            )}
            {secondaryElement && (
              <View style={[
                styles.elementBadge,
                {
                  borderColor: elementAccent(secondaryElement).base,
                  backgroundColor: elementAccent(secondaryElement).dim,
                },
              ]}>
                <Label variant="secondary" size="md">Secondary</Label>
                <Label variant="primary" size="lg">{ELEMENT_LABELS[secondaryElement]}</Label>
              </View>
            )}
          </View>
          <Spacer size="sm" />
          <Label variant="tertiary" size="xs">
            Unlock elements by defeating specific bosses and hitting fitness milestones.
          </Label>
        </Panel>

        <Spacer size="md" />

        {/* Distance + Chronicle */}
        <Panel variant="surface">
          <Label variant="tertiary">Commander Record</Label>
          <Spacer size="sm" />
          <View style={styles.statRow}>
            <Label variant="secondary">Total Distance</Label>
            <Label variant="mono" size="md">{`${player.total_distance_km.toFixed(2)} km`}</Label>
          </View>
          <View style={styles.statRow}>
            <Label variant="secondary">Titles Earned</Label>
            <Label variant="mono" size="md">{(player.title_chronicle).length + 1}</Label>
          </View>
        </Panel>

        {player.title_chronicle.length > 0 && (
          <>
            <Spacer size="md" />
            <Divider element={element} />
            <Label variant="tertiary">Title Chronicle</Label>
            <Spacer size="sm" />
            {[...player.title_chronicle].reverse().map((title, i) => (
              <View key={i} style={styles.chronicleRow}>
                <Label variant="tertiary" size="xs">{player.title_chronicle.length - i}</Label>
                <Label variant="secondary">{title}</Label>
              </View>
            ))}
          </>
        )}

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
    paddingTop: SPACING.sm,
  },
  octagramContainer: {
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLow,
  },
  elementRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  elementBadge: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 2,
    padding: SPACING.sm,
    gap: 4,
  },
  chronicleRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
    paddingVertical: 6,
  },
})
