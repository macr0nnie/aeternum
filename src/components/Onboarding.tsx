// =============================================================================
// Aeternum — Onboarding / Entry Rift
// =============================================================================
// The app's front door. Rendered by the root layout as a full-screen overlay
// whenever there is no authenticated player. Guests enter instantly — one tap
// creates an anonymous session + a player row, then this overlay unmounts and
// the Command Hub appears.
//
// Why an overlay rather than a route: keeps the router's Tabs navigator mounted
// at all times (expo-router requirement) while gating access behind auth.
// =============================================================================

import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signInAsGuest, isSupabaseConfigured, buildLocalGuestPlayer } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { Label, Button, Spacer } from '@/components/UI'
import { COLORS, SPACING, LETTER_SPACING, FONTS, FONT_SIZES } from '@/theme/tokens'

interface OnboardingProps {
  // False while the initial auth check is still resolving — we show a neutral
  // "initializing" state instead of the Begin button to avoid a flash of the
  // entry screen for returning guests whose session is about to restore.
  ready: boolean
  // Set by the root layout when the boot session check failed/timed out
  // (backend unreachable). Surfaced so the user sees an error instead of a hang.
  bootError?: string | null
  // Retry the boot session check.
  onRetry?: () => void
}

export const Onboarding: React.FC<OnboardingProps> = ({ ready, bootError, onRetry }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setPlayer = useStore((s) => s.setPlayer)

  // A boot-level error (unreachable backend) takes precedence over local state.
  const displayError = error ?? bootError ?? null

  // Drop straight into a fully-local session — no network. Used when the backend
  // isn't configured/reachable so the app is always navigable for testing.
  function enterOffline() {
    setPlayer(buildLocalGuestPlayer())
  }

  async function handleBegin() {
    // No backend configured → skip the network round-trip entirely.
    if (!isSupabaseConfigured) {
      enterOffline()
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Bound the sign-in: if the backend is unreachable, getSession/signIn can
      // hang and leave the button spinning forever ("Begin not letting me in").
      const TIMEOUT = Symbol('timeout')
      const result = await Promise.race([
        signInAsGuest(),
        new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 8000)),
      ])
      if (result === TIMEOUT) {
        setError('Server is taking too long. Check your connection or enter offline.')
        setLoading(false)
        return
      }
      if (result.error) {
        // Most common cause: anonymous sign-ins not enabled, or the backend is
        // unreachable (e.g. local Supabase not running / wrong LAN IP).
        setError(result.error.message)
        setLoading(false)
        return
      }
      // On success the root layout's auth listener creates the player and unmounts
      // this overlay. Safety net: if that hasn't happened shortly, stop the spinner
      // so the user isn't stuck — they can retry or enter offline.
      setTimeout(() => setLoading(false), 8000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.')
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Wordmark */}
        <View style={styles.brand}>
          <Text style={styles.title}>AETERNUM</Text>
          <View style={styles.accentLine} />
          <Spacer size="sm" />
          <Label variant="tertiary" size="sm">Forge your legend</Label>
        </View>

        <View style={styles.action}>
          {ready ? (
            <>
              <Button
                label="Begin Ascent"
                onPress={handleBegin}
                loading={loading}
                fullWidth
              />
              <Spacer size="sm" />
              <Label variant="tertiary" size="xs">
                {isSupabaseConfigured
                  ? 'Enter instantly as a guest — no account required'
                  : 'Offline mode — backend not configured. Progress stays on this device.'}
              </Label>
              {displayError && (
                <>
                  <Spacer size="md" />
                  <Label variant="rarity" rarity="common" size="xs">
                    {`Entry failed: ${displayError}`}
                  </Label>
                  <Spacer size="sm" />
                  {onRetry && (
                    <>
                      <Button label="Retry" variant="ghost" onPress={onRetry} fullWidth />
                      <Spacer size="sm" />
                    </>
                  )}
                  <Button
                    label="Continue Offline"
                    variant="ghost"
                    onPress={enterOffline}
                    fullWidth
                  />
                </>
              )}
            </>
          ) : (
            <Label variant="tertiary" size="xs">Initializing…</Label>
          )}
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.ground,
    zIndex: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'space-between',
    paddingTop: SPACING.xxxl * 1.5,
    paddingBottom: SPACING.xxxl,
  },
  brand: {
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.display + 8,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.extraWide,
  },
  accentLine: {
    marginTop: SPACING.sm,
    width: 56,
    height: 2,
    backgroundColor: COLORS.textSecondary,
  },
  action: {
    alignItems: 'flex-start',
  },
})
