// =============================================================================
// Aeternum — Run Sync Screen
// =============================================================================
// The player's primary post-run interaction. Reads Health Connect data and
// submits to the Edge Function. State flows: idle → reading → uploading → done.
//
// On success the player is navigated to rewards.tsx automatically.
// =============================================================================

import React, { useEffect } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectSyncState, selectPlayer } from '@/store/useStore'
import { syncRun, formatDistance, formatDuration, formatPace, SyncError } from '@/lib/runSync'
import { Panel, Heading, Label, Button, Spacer, Divider } from '@/components/UI'
import { COLORS, SPACING, elementAccent } from '@/theme/tokens'
import type { Element } from '@/types'

export default function SyncScreen() {
  const syncState = useStore(selectSyncState)
  const player = useStore(selectPlayer)
  const { setSyncState, setSyncError, applyRunResult, syncError } = useStore()

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)

  // Navigate to rewards once resolved
  useEffect(() => {
    if (syncState !== 'done') return
    const timeout = setTimeout(() => router.replace('/rewards'), 800)
    return () => clearTimeout(timeout)
  }, [syncState])

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
      if (err instanceof SyncError) {
        setSyncError(err.message)
      } else {
        setSyncError('An unexpected error occurred.')
      }
    }
  }

  function handleReset() {
    setSyncState('idle')
    setSyncError(null)
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Run Sync</Heading>
        <Spacer size="xs" />
        <Label variant="secondary">
          Complete your run, then tap Sync to submit it.
        </Label>

        <Spacer size="lg" />

        {/* Status panel */}
        <Panel element={element} elevated padding="lg">
          {syncState === 'idle' && (
            <>
              <Label variant="tertiary">Status</Label>
              <Spacer size="sm" />
              <Label variant="primary" size="md">Ready to sync</Label>
              <Spacer size="xs" />
              <Label variant="secondary">
                Your last completed run will be read from Health Connect.
                Make sure your fitness tracker has finished syncing.
              </Label>
            </>
          )}

          {syncState === 'reading' && (
            <>
              <Label variant="tertiary">Status</Label>
              <Spacer size="sm" />
              <Label variant="primary" size="md">Reading Health Connect...</Label>
              <Spacer size="xs" />
              <Label variant="secondary">
                Fetching run data: distance, steps, duration, heart rate.
              </Label>
            </>
          )}

          {syncState === 'uploading' && (
            <>
              <Label variant="tertiary">Status</Label>
              <Spacer size="sm" />
              <Label variant="primary" size="md">Resolving combat...</Label>
              <Spacer size="xs" />
              <Label variant="secondary">
                Submitting run to server. Validating and calculating rewards.
              </Label>
            </>
          )}

          {syncState === 'done' && (
            <>
              <Label variant="rarity" rarity="uncommon">Run Resolved</Label>
              <Spacer size="sm" />
              <Label variant="primary" size="md">Rewards incoming...</Label>
            </>
          )}

          {syncState === 'error' && (
            <>
              <Label variant="tertiary">Sync Failed</Label>
              <Spacer size="sm" />
              <Label variant="primary" size="md">{syncError ?? 'Unknown error'}</Label>
            </>
          )}
        </Panel>

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Action buttons */}
        {(syncState === 'idle' || syncState === 'error') && (
          <>
            <Button
              label={syncState === 'error' ? 'Retry Sync' : 'Sync Run'}
              element={element}
              onPress={handleSync}
              fullWidth
            />
            {syncState === 'error' && (
              <>
                <Spacer size="sm" />
                <Button
                  label="Cancel"
                  element={element}
                  variant="ghost"
                  onPress={handleReset}
                  fullWidth
                />
              </>
            )}
          </>
        )}

        {(syncState === 'reading' || syncState === 'uploading') && (
          <Button
            label={syncState === 'reading' ? 'Reading...' : 'Uploading...'}
            element={element}
            loading
            fullWidth
            onPress={() => undefined}
          />
        )}

        <Spacer size="xl" />

        {/* Info panel */}
        <Panel variant="transparent" padding="sm">
          <Label variant="tertiary">How it works</Label>
          <Spacer size="xs" />
          <Label variant="secondary">
            Aeternum reads your completed exercise session from Health Connect.
            Your phone stays in your pocket during the run — no GPS tracking,
            no app open, no battery drain.
          </Label>
          <Spacer size="sm" />
          <Label variant="secondary">
            After syncing, the server validates your run and calculates combat
            results, loot, and stat gains. If the run data looks unusual, it may
            be flagged — this does not affect your account.
          </Label>
        </Panel>

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
})
