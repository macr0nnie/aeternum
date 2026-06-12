// =============================================================================
// Aeternum — Settings Screen
// =============================================================================
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform, Switch,
} from 'react-native'
import { useStore, selectPlayer, selectHealthPermissionAsked } from '@/store/useStore'
import { SectionHeader, SystemWindow } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING } from '@/theme/tokens'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Setting row
// ---------------------------------------------------------------------------

interface SettingRowProps {
  label: string
  sub?: string
  onPress?: () => void
  destructive?: boolean
  value?: string
  toggle?: boolean
  toggled?: boolean
  onToggle?: (v: boolean) => void
}

const SettingRow: React.FC<SettingRowProps> = ({
  label, sub, onPress, destructive, value, toggle, toggled, onToggle,
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress && !toggle}
  >
    <View style={styles.rowLabel}>
      <Text style={[styles.rowTitle, destructive && { color: COLORS.systemAlert }]}>{label}</Text>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
    </View>
    {toggle && onToggle ? (
      <Switch
        value={toggled}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.borderMid, true: COLORS.system + '80' }}
        thumbColor={toggled ? COLORS.system : COLORS.textTertiary}
      />
    ) : value ? (
      <Text style={styles.rowValue}>{value}</Text>
    ) : onPress ? (
      <Text style={styles.rowChevron}>›</Text>
    ) : null}
  </TouchableOpacity>
)

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const player = useStore(selectPlayer)
  const healthPermissionAsked = useStore(selectHealthPermissionAsked)
  const { reset } = useStore()

  const [signingOut, setSigningOut] = useState(false)

  async function handleRequestHealth() {
    try {
      const { initHealth } = await import('@/lib/health')
      const granted = await initHealth()
      if (granted) {
        Alert.alert('Health Access', 'Permissions granted. Sync will work on your next run.')
      } else {
        Alert.alert(
          'Health Access Denied',
          Platform.OS === 'ios'
            ? 'Go to Settings → Health → Data Access & Devices → Aeternum and enable all permissions.'
            : 'Go to your device Settings → Health Connect → App permissions → Aeternum and enable all permissions.',
        )
      }
    } catch {
      Alert.alert('Error', 'Could not open health permissions. Try again.')
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Your progress is saved to the server. You can sign back in anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true)
            await supabase.auth.signOut()
            reset()
            setSigningOut(false)
          },
        },
      ],
    )
  }

  function handleResetLocalData() {
    Alert.alert(
      'Reset Local Data',
      'Clears all local cache: quests, dungeons, gear, and territory data. Your stats and distance on the server are unaffected and will reload on next launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => reset(),
        },
      ],
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>◆ SETTINGS ◆</Text>
        </View>

        {/* Account */}
        <SectionHeader title="ACCOUNT" />
        <View style={styles.section}>
          <SettingRow
            label="Username"
            value={player?.username ?? '—'}
          />
          <SettingRow
            label="Rank"
            value={player?.rank ?? '—'}
          />
          <SettingRow
            label="Player ID"
            sub="Your unique account identifier"
            value={player?.id ? `${player.id.slice(0, 8)}…` : '—'}
          />
          <SettingRow
            label="Sign Out"
            sub="Progress is saved to the server"
            {...(!signingOut && { onPress: handleSignOut })}
            destructive
          />
        </View>

        {/* Health & Sync */}
        <SectionHeader title="HEALTH & SYNC" />
        <View style={styles.section}>
          <SettingRow
            label={Platform.OS === 'ios' ? 'Apple Health Permissions' : 'Health Connect Permissions'}
            sub={healthPermissionAsked ? 'Permissions have been requested' : 'Not yet requested'}
            onPress={handleRequestHealth}
          />
          <SettingRow
            label="How Sync Works"
            sub="Run with your phone in your pocket. After your run, open Aeternum — it reads your last completed workout automatically."
          />
        </View>

        {/* App info */}
        <SectionHeader title="APP" />
        <View style={styles.section}>
          <SettingRow label="Version" value="1.0.0" />
          <SettingRow
            label="Reset Local Cache"
            sub="Clears quest/dungeon/gear cache. Server data is safe."
            onPress={handleResetLocalData}
            destructive
          />
        </View>

        {/* Danger zone */}
        <SectionHeader title="DANGER ZONE" />
        <SystemWindow title="⚠  DATA WARNING" variant="alert">
          <Text style={styles.warningText}>
            Reset Local Cache only affects data stored on this device.
            Your stats, distance, and rank are always stored on the server and will be restored on next login.
          </Text>
        </SystemWindow>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xl },
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.widest,
  },

  section: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLow,
    minHeight: 52,
  },
  rowLabel: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  rowSub: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
  rowValue: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    maxWidth: 140,
    textAlign: 'right',
  },
  rowChevron: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textTertiary,
  },

  warningText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
})
