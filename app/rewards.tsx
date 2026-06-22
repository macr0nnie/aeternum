// =============================================================================
// Aeternum — Post-Run Loot Screen
// =============================================================================
// Displays rewards and stat gains from the most recently resolved run.
// Reads from latestRunResult in the Zustand store — populated by applyRunResult()
// after a successful sync.
//
// If no run has been resolved this session, shows a prompt to sync first.
// =============================================================================

import { View, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectLatestRunResult, selectPlayer } from '@/store/useStore'
import { Panel, Heading, Label, Button, StatChip, Spacer, Divider } from '@/components/UI'
import { COLORS, SPACING, rarityColor } from '@/theme/tokens'
import { STAT_KEYS, type Element, type Reward, type StatKey } from '@/types'

export default function RewardsScreen() {
  const result = useStore(selectLatestRunResult)
  const player = useStore(selectPlayer)

  const element = (player?.primary_element as Element | null) ?? null

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Heading size="xl" element={element}>Rewards</Heading>
          <Spacer size="lg" />
          <Panel variant="surface" padding="lg">
            <Label variant="tertiary">No run resolved yet</Label>
            <Spacer size="sm" />
            <Label variant="secondary">
              Complete and sync a run to see your rewards here.
            </Label>
          </Panel>
          <Spacer size="lg" />
          <Button
            label="Go to Sync"
            element={element}
            onPress={() => router.push('/sync')}
            fullWidth
          />
        </ScrollView>
      </SafeAreaView>
    )
  }

  const statGainEntries = STAT_KEYS
    .filter((key) => (result.stat_gains[key] ?? 0) > 0)
    .map((key) => ({ key, gain: result.stat_gains[key] ?? 0 }))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Heading size="xl" element={element}>
            {result.validated ? 'Run Resolved' : 'Run Flagged'}
          </Heading>
          {!result.validated && result.flag_reason && (
            <>
              <Spacer size="xs" />
              <Panel variant="surface" padding="sm">
                <Label variant="tertiary">Flag Reason</Label>
                <Spacer size="xs" />
                <Label variant="primary">{result.flag_reason}</Label>
              </Panel>
            </>
          )}
        </View>

        <Spacer size="lg" />

        {/* Stat gains */}
        {statGainEntries.length > 0 && (
          <>
            <Label variant="tertiary">Stat Gains</Label>
            <Spacer size="sm" />
            <View style={styles.statRow}>
              {statGainEntries.map(({ key, gain }) => (
                <StatChip
                  key={key}
                  statKey={key as StatKey}
                  value={(player?.stats[key as StatKey] ?? 0)}
                  gain={gain}
                  element={element}
                />
              ))}
            </View>
            <Spacer size="lg" />
            <Divider element={element} />
          </>
        )}

        {/* Loot */}
        <Label variant="tertiary">Loot</Label>
        <Spacer size="sm" />

        {result.rewards.length === 0 ? (
          <Panel variant="surface" padding="sm">
            <Label variant="secondary">No loot this run.</Label>
          </Panel>
        ) : (
          result.rewards.map((reward) => (
            <RewardRow key={reward.id} reward={reward} />
          ))
        )}

        <Spacer size="xl" />
        <Divider element={element} />

        <Button
          label="Return to Command"
          element={element}
          onPress={() => router.replace('/')}
          fullWidth
        />

        <Spacer size="xl" />
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Reward row
// ---------------------------------------------------------------------------

function RewardRow({ reward }: { reward: Reward }) {
  const color = rarityColor(reward.rarity)

  return (
    <View style={[styles.rewardRow, { borderColor: color + '44' }]}>
      <View style={[styles.rarityStripe, { backgroundColor: color }]} />
      <View style={styles.rewardContent}>
        <Label variant="primary" size="md">{reward.name}</Label>
        <View style={styles.rewardMeta}>
          <Label variant="rarity" rarity={reward.rarity} size="xs">{reward.rarity}</Label>
          <Label variant="tertiary" size="xs">{reward.type}</Label>
        </View>
      </View>
    </View>
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
  header: {
    paddingTop: SPACING.sm,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  rewardRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  rarityStripe: {
    width: 3,
  },
  rewardContent: {
    flex: 1,
    padding: SPACING.sm,
    gap: 4,
  },
  rewardMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
})
