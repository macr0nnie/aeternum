// =============================================================================
// Aeternum — Character Setup Screen
// =============================================================================
// Full-screen overlay shown to new players (username still "Runner-XXXX").
// Players set their commander name and choose a starting element.
// On completion the player row is updated and this overlay unmounts.
// =============================================================================

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer } from '@/store/useStore'
import { updatePlayer, isSupabaseConfigured } from '@/lib/supabase'
import { SystemWindow, Button, Spacer, Label } from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, BORDER, RADIUS,
} from '@/theme/tokens'

interface CharacterSetupProps {
  onComplete: () => void
}

export const CharacterSetup: React.FC<CharacterSetupProps> = ({ onComplete }) => {
  const player = useStore(selectPlayer)
  const { setPlayer, setCharacterSetupDone } = useStore()

  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleComplete() {
    if (!player) return

    const trimmed = username.trim()
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    if (trimmed.length > 20) {
      setError('Name must be 20 characters or fewer.')
      return
    }

    setLoading(true)
    setError(null)

    const updates = { username: trimmed }

    // Offline guest players exist only on-device (id `offline-…`) — never try to
    // persist them to the backend, and skip the network for any unconfigured
    // backend. Otherwise updatePlayer hits an unreachable/unknown row and hangs,
    // leaving setup stuck on its spinner so the app never loads.
    const isOfflinePlayer = player.id.startsWith('offline-')

    try {
      if (isSupabaseConfigured && !isOfflinePlayer) {
        // Bound the save so an unreachable backend can't hang character setup.
        const TIMEOUT = Symbol('timeout')
        const result = await Promise.race([
          updatePlayer(player.id, updates),
          new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 8000)),
        ])
        if (result === TIMEOUT) {
          setError('Could not reach server — continuing offline.')
          setPlayer({ ...player, ...updates })
        } else {
          if (result.error) setError('Could not save. Continuing offline.')
          if (result.data) setPlayer(result.data as typeof player)
          else setPlayer({ ...player, ...updates })
        }
      } else {
        setPlayer({ ...player, ...updates })
      }

      // NOTE: q_first_steps / q_name_path are claimed by the player on the Quest
      // Board (with reward feedback) — do NOT auto-claim them here, or those board
      // missions become dead taps that grant nothing visible.

      setCharacterSetupDone(true)
      onComplete()
    } catch {
      setError('Something went wrong. Continuing anyway.')
      setPlayer({ ...player, ...updates })
      setCharacterSetupDone(true)
      onComplete()
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.systemTag}>◆ SYSTEM ◆</Text>
          <Spacer size="sm" />
          <Text style={styles.title}>ASCENSION</Text>
          <View style={styles.titleUnderline} />
          <Spacer size="sm" />
          <Text style={styles.subtitle}>
            A new adventurer has been detected.{'\n'}Initialising profile...
          </Text>
        </View>

        <Spacer size="xl" />

        {/* Name + begin — identity (class/pathway) is earned through play, not chosen */}
        <SystemWindow title="ADVENTURER DESIGNATION">
          <Label variant="secondary" size="xs">
            Choose the name you will carry into every rift. Your path is forged by
            what you do — not chosen here.
          </Label>
          <Spacer size="md" />
          <View style={styles.inputWrapper}>
            <Text style={styles.inputPrefix}>{'>'}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textTertiary}
              maxLength={20}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleComplete}
            />
          </View>
          {error && (
            <>
              <Spacer size="sm" />
              <Label variant="system" size="xs">{error}</Label>
            </>
          )}
          <Spacer size="lg" />
          <Button
            label="Begin"
            variant="system"
            onPress={handleComplete}
            loading={loading}
            fullWidth
          />
        </SystemWindow>

        <Spacer size="xxxl" />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.ground,
    zIndex: 20,
  },
  scroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    alignItems: 'flex-start',
  },
  systemTag: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.system,
    letterSpacing: LETTER_SPACING.extraWide,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.display + 12,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.extraWide,
    lineHeight: FONT_SIZES.display + 16,
  },
  titleUnderline: {
    marginTop: SPACING.xs,
    width: 48,
    height: 2,
    backgroundColor: COLORS.system,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    letterSpacing: LETTER_SPACING.tight,
    lineHeight: FONT_SIZES.sm * 1.7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER.mid,
    borderColor: COLORS.systemBorder,
    borderRadius: RADIUS.sharp,
    backgroundColor: COLORS.surfaceHigh,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  inputPrefix: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.md,
    color: COLORS.system,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.wide,
    padding: 0,
  },
})
