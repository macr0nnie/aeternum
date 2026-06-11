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
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer } from '@/store/useStore'
import { updatePlayer, isSupabaseConfigured } from '@/lib/supabase'
import { SystemWindow, CornerPanel, Button, Spacer, Label } from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, BORDER, RADIUS,
  elementAccent, SHADOWS,
} from '@/theme/tokens'
import { ELEMENTS, ELEMENT_LABELS, type Element } from '@/types'

interface CharacterSetupProps {
  onComplete: () => void
}

// Element icons / descriptions for the selection grid
const ELEMENT_META: Record<Element, { icon: string; desc: string; statBonus: string }> = {
  fire:    { icon: '🔥', desc: 'Raw power and devastation', statBonus: '+ATK' },
  water:   { icon: '💧', desc: 'Flow and adaptability', statBonus: '+SPD' },
  nature:  { icon: '🌿', desc: 'Growth and endurance', statBonus: '+END' },
  arcane:  { icon: '✦', desc: 'Intellect and mystery', statBonus: '+INT' },
  shadow:  { icon: '◈', desc: 'Concealment and cunning', statBonus: '+LCK' },
  frost:   { icon: '❄', desc: 'Stillness and precision', statBonus: '+PER' },
  earth:   { icon: '⬡', desc: 'Stability and defence', statBonus: '+DEF' },
  harvest: { icon: '◉', desc: 'Fortune and abundance', statBonus: '+LCK' },
  forge:   { icon: '⚙', desc: 'Craft and resilience', statBonus: '+DEF' },
  mending: { icon: '✚', desc: 'Recovery and support', statBonus: '+END' },
}

export const CharacterSetup: React.FC<CharacterSetupProps> = ({ onComplete }) => {
  const player = useStore(selectPlayer)
  const { setPlayer, setCharacterSetupDone, completeQuest } = useStore()

  const [step, setStep] = useState<'name' | 'element'>('name')
  const [username, setUsername] = useState('')
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const palette = elementAccent(selectedElement)

  async function handleConfirmName() {
    const trimmed = username.trim()
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    if (trimmed.length > 20) {
      setError('Name must be 20 characters or fewer.')
      return
    }
    setError(null)
    setStep('element')
  }

  async function handleComplete() {
    if (!selectedElement) {
      setError('Choose your element to proceed.')
      return
    }
    if (!player) return

    setLoading(true)
    setError(null)

    const trimmed = username.trim() || player.username
    const updates = {
      username: trimmed,
      primary_element: selectedElement,
    }

    try {
      if (isSupabaseConfigured) {
        const { data, error: updateErr } = await updatePlayer(player.id, updates)
        if (updateErr) {
          setError('Could not save. Continuing offline.')
        }
        if (data) setPlayer(data as typeof player)
        else setPlayer({ ...player, ...updates })
      } else {
        setPlayer({ ...player, ...updates })
      }

      // Award setup quest rewards
      completeQuest('q_first_steps', { END: 1, CHA: 1 })
      completeQuest('q_name_path', { CHA: 2 })

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
          <Text style={styles.title}>AWAKENING</Text>
          <View style={styles.titleUnderline} />
          <Spacer size="sm" />
          <Text style={styles.subtitle}>
            A new hunter has been detected.{'\n'}Initialising profile...
          </Text>
        </View>

        <Spacer size="xl" />

        {/* Step: Name */}
        {step === 'name' && (
          <SystemWindow title="COMMANDER DESIGNATION">
            <Label variant="secondary" size="xs">
              Choose the name you will carry into every gate.
            </Label>
            <Spacer size="md" />
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>{'>'}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter commander name"
                placeholderTextColor={COLORS.textTertiary}
                maxLength={20}
                autoFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleConfirmName}
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
              label="Confirm Name"
              variant="system"
              onPress={handleConfirmName}
              fullWidth
            />
          </SystemWindow>
        )}

        {/* Step: Element */}
        {step === 'element' && (
          <>
            <SystemWindow title="ELEMENT SELECTION">
              <Label variant="secondary" size="xs">
                Your element shapes your power. Choose wisely — it cannot be changed early.
              </Label>
              <Spacer size="sm" />
              <Label variant="system" size="xs">
                {`Commander: ${username.trim() || player?.username || ''}`}
              </Label>
            </SystemWindow>

            <Spacer size="md" />

            {/* Element grid */}
            <View style={styles.elementGrid}>
              {ELEMENTS.map((el) => {
                const meta = ELEMENT_META[el]
                const elPalette = elementAccent(el)
                const isSelected = selectedElement === el

                return (
                  <TouchableOpacity
                    key={el}
                    onPress={() => setSelectedElement(el)}
                    activeOpacity={0.75}
                    style={[
                      styles.elementCard,
                      {
                        borderColor: isSelected ? elPalette.base : COLORS.borderMid,
                        backgroundColor: isSelected ? elPalette.dim : COLORS.surface,
                      },
                      isSelected && { ...(SHADOWS.glowBlue as object), shadowColor: elPalette.base },
                    ]}
                  >
                    <Text style={[styles.elementIcon, { color: elPalette.bright }]}>
                      {meta.icon}
                    </Text>
                    <Text style={[styles.elementName, { color: isSelected ? elPalette.bright : COLORS.textPrimary }]}>
                      {ELEMENT_LABELS[el].toUpperCase()}
                    </Text>
                    <Text style={[styles.elementBonus, { color: elPalette.base }]}>
                      {meta.statBonus}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Selected element description */}
            {selectedElement && (
              <>
                <Spacer size="md" />
                <CornerPanel color={palette.base} backgroundColor={palette.dim}>
                  <Text style={[styles.elementDesc, { color: palette.bright }]}>
                    {ELEMENT_META[selectedElement].desc.toUpperCase()}
                  </Text>
                  <Spacer size="xs" />
                  <Text style={[styles.elementDescSub, { color: palette.base }]}>
                    Primary bonus: {ELEMENT_META[selectedElement].statBonus}
                  </Text>
                </CornerPanel>
              </>
            )}

            {error && (
              <>
                <Spacer size="sm" />
                <Label variant="system" size="xs">{error}</Label>
              </>
            )}

            <Spacer size="xl" />

            <Button
              label={selectedElement ? 'Begin Ascent' : 'Select an Element'}
              element={selectedElement}
              variant={selectedElement ? 'primary' : 'ghost'}
              onPress={handleComplete}
              loading={loading}
              disabled={!selectedElement}
              fullWidth
            />
            <Spacer size="sm" />
            <TouchableOpacity onPress={() => setStep('name')}>
              <Label variant="tertiary" size="xs">← Change name</Label>
            </TouchableOpacity>
          </>
        )}

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
  elementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  elementCard: {
    width: '47%',
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.sharp,
    padding: SPACING.md,
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  elementIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  elementName: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.wide,
  },
  elementBonus: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
  },
  elementDesc: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.normal,
  },
  elementDescSub: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.tight,
  },
})
