// =============================================================================
// Aeternum — Run Sync Screen
// =============================================================================

import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectSyncState, selectPlayer, selectLatestRunResult } from '@/store/useStore'
import { syncRun, SyncError } from '@/lib/runSync'
import { Heading, Label, Button, Spacer, Divider, SystemWindow, StatChip } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, elementAccent } from '@/theme/tokens'
import type { Element } from '@/types'

export default function SyncScreen() {
  const syncState = useStore(selectSyncState)
  const player = useStore(selectPlayer)
  const latestResult = useStore(selectLatestRunResult)
  const { setSyncState, setSyncError, applyRunResult, syncError } = useStore()

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)

  async function handleSync() {
    if (!player) return
    setSyncState('reading')
    setSyncError(null)
    try {
      setSyncState('uploading')
      const result = await syncRun(player.id)
      applyRunResult(result)
    } catch (err) {
      setSyncState('error')
      setSyncError(err instanceof SyncError ? err.message : 'An unexpected error occurred.')
    }
  }

  function handleReset() {
    setSyncState('idle')
    setSyncError(null)
  }

  const isActive = syncState === 'reading' || syncState === 'uploading'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Run Sync</Heading>
        <Spacer size="xs" />
        <Label variant="secondary">
          Complete your run, then sync to resolve combat and claim rewards.
        </Label>

        <Spacer size="lg" />

        {/* Status window */}
        <SystemWindow
          title={
            syncState === 'done' ? 'RUN RESOLVED' :
            syncState === 'error' ? 'SYNC FAILED' :
            isActive ? 'SYNCING' : 'AWAITING SYNC'
          }
          variant={syncState === 'done' ? 'gold' : syncState === 'error' ? 'alert' : 'info'}
        >
          {syncState === 'idle' && (
            <View style={styles.statusBody}>
              <Text style={[styles.statusLine, { color: COLORS.system }]}>{'> '}<Text style={styles.statusText}>READY</Text></Text>
              <Text style={styles.statusDesc}>
                Tap Sync Run below. Your last completed workout will be read from{' '}
                {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}.
              </Text>
            </View>
          )}

          {syncState === 'reading' && (
            <View style={styles.statusBody}>
              <Text style={[styles.statusLine, { color: COLORS.system }]}>
                {'> '}<Text style={styles.statusText}>READING HEALTH DATA</Text>
              </Text>
              <Text style={styles.statusDesc}>
                Fetching distance, steps, duration and heart rate...
              </Text>
              <View style={styles.dots}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: COLORS.system }]} />
                ))}
              </View>
            </View>
          )}

          {syncState === 'uploading' && (
            <View style={styles.statusBody}>
              <Text style={[styles.statusLine, { color: palette.bright }]}>
                {'> '}<Text style={styles.statusText}>RESOLVING COMBAT</Text>
              </Text>
              <Text style={styles.statusDesc}>
                Server is validating run and calculating stat gains...
              </Text>
              <View style={styles.dots}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: palette.base }]} />
                ))}
              </View>
            </View>
          )}

          {syncState === 'done' && latestResult && (
            <View style={styles.statusBody}>
              <Text style={[styles.statusLine, { color: COLORS.systemGold }]}>
                {'> '}<Text style={styles.statusText}>
                  {latestResult.validated ? 'RUN VALIDATED' : 'RUN FLAGGED — PARTIAL REWARDS'}
                </Text>
              </Text>
              <Spacer size="sm" />
              {Object.keys(latestResult.stat_gains).length > 0 && (
                <>
                  <Label variant="tertiary" size="xs">Stat Gains</Label>
                  <Spacer size="xs" />
                  <View style={styles.statRow}>
                    {Object.entries(latestResult.stat_gains).map(([k, v]) => (
                      <StatChip
                        key={k}
                        statKey={k as any}
                        value={player?.stats[k as keyof typeof player.stats] ?? 0}
                        gain={v as number}
                        element={element}
                      />
                    ))}
                  </View>
                </>
              )}
              {latestResult.rewards.length > 0 && (
                <>
                  <Spacer size="sm" />
                  <Label variant="tertiary" size="xs">Rewards</Label>
                  <Spacer size="xs" />
                  {latestResult.rewards.map((r) => (
                    <Text key={r.id} style={[styles.rewardLine, { color: rarityColors[r.rarity] }]}>
                      {'◆ '}{r.name.toUpperCase()}
                      <Text style={styles.rewardRarity}>{' ['}{r.rarity.toUpperCase()}{']'}</Text>
                    </Text>
                  ))}
                </>
              )}
              {latestResult.flag_reason && (
                <>
                  <Spacer size="sm" />
                  <Text style={styles.flagText}>{`⚠ ${latestResult.flag_reason}`}</Text>
                </>
              )}
            </View>
          )}

          {syncState === 'error' && (
            <View style={styles.statusBody}>
              <Text style={[styles.statusLine, { color: COLORS.error }]}>
                {'> '}<Text style={styles.statusText}>ERROR</Text>
              </Text>
              <Text style={[styles.statusDesc, { color: COLORS.textSecondary }]}>
                {syncError ?? 'Unknown error.'}
              </Text>
            </View>
          )}
        </SystemWindow>

        <Spacer size="lg" />

        {/* Action */}
        {(syncState === 'idle' || syncState === 'error') && (
          <>
            <Button
              label={syncState === 'error' ? 'Retry Sync' : '◆  Sync Run  ◆'}
              element={element}
              variant={syncState === 'error' ? 'ghost' : 'primary'}
              onPress={handleSync}
              fullWidth
            />
            {syncState === 'error' && (
              <>
                <Spacer size="sm" />
                <Button label="Cancel" element={element} variant="ghost" onPress={handleReset} fullWidth />
              </>
            )}
          </>
        )}

        {isActive && (
          <Button label="Syncing..." element={element} loading fullWidth onPress={() => undefined} />
        )}

        {syncState === 'done' && (
          <Button label="Sync Another Run" element={element} variant="ghost" onPress={handleReset} fullWidth />
        )}

        <Spacer size="lg" />
        <Divider element={element} />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{'◆ HOW IT WORKS ◆'}</Text>
          <Spacer size="sm" />
          <Text style={styles.infoText}>
            Run with your phone in your pocket. Aeternum reads your completed workout from{' '}
            {Platform.OS === 'ios' ? 'Apple Health (HealthKit)' : 'Health Connect'} after you finish —
            no GPS tracking, no app open during your run.
          </Text>
          <Spacer size="sm" />
          <Text style={styles.infoText}>
            The server validates distance, pace and steps, then resolves stat gains and loot.
            Suspicious data may be flagged — this does not affect your account.
          </Text>
        </View>

        <Spacer size="xl" />
      </ScrollView>
    </SafeAreaView>
  )
}

const rarityColors: Record<string, string> = {
  common: COLORS.common,
  uncommon: COLORS.uncommon,
  rare: COLORS.rare,
  legendary: COLORS.legendary,
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { padding: SPACING.md },
  statusBody: { gap: SPACING.xs },
  statusLine: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs },
  statusText: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, letterSpacing: LETTER_SPACING.wide },
  statusDesc: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZES.xs * 1.6,
    marginTop: SPACING.xs,
  },
  dots: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  dot: { width: 6, height: 6, borderRadius: 1, opacity: 0.7 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  rewardLine: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.normal,
    marginBottom: 2,
  },
  rewardRarity: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    opacity: 0.7,
  },
  flagText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
  },
  infoBox: { paddingVertical: SPACING.sm },
  infoTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: LETTER_SPACING.extraWide,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    lineHeight: FONT_SIZES.xs * 1.7,
  },
})
