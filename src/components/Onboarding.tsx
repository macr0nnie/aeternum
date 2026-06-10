// =============================================================================
// Aeternum — Onboarding / Entry Gate
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
import { signInAsGuest } from '@/lib/supabase'
import { Label, Button, Spacer } from '@/components/UI'
import { COLORS, SPACING, LETTER_SPACING, FONTS, FONT_SIZES } from '@/theme/tokens'

interface OnboardingProps {
  // False while the initial auth check is still resolving — we show a neutral
  // "initializing" state instead of the Begin button to avoid a flash of the
  // entry screen for returning guests whose session is about to restore.
  ready: boolean
}

export const Onboarding: React.FC<OnboardingProps> = ({ ready }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleBegin() {
    setLoading(true)
    setError(null)

    const { error: authError } = await signInAsGuest()

    if (authError) {
      // Most common cause: anonymous sign-ins not enabled on the Supabase project.
      setError(authError.message)
      setLoading(false)
      return
    }
    // On success the root layout's auth listener creates the player and unmounts
    // this overlay — keep the button in its loading state until that happens.
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Wordmark */}
        <View style={styles.brand}>
          <Text style={styles.title}>AETERNUM</Text>
          <View style={styles.accentLine} />
          <Spacer size="sm" />
          <Label variant="tertiary" size="sm">Awaken your commander</Label>
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
                Enter instantly as a guest — no account required
              </Label>
              {error && (
                <>
                  <Spacer size="md" />
                  <Label variant="rarity" rarity="common" size="xs">
                    {`Entry failed: ${error}`}
                  </Label>
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
    ...StyleSheet.absoluteFillObject,
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
