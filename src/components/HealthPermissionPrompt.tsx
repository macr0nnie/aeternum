// =============================================================================
// Aeternum — Health Permission Prompt
// =============================================================================
// A one-time in-app modal that asks the player to connect health data. The
// native Health Connect / HealthKit permission dialog is launched from the
// CONNECT button's onPress — a real user gesture, which is the only reliable
// way to make the system popup appear (a background effect does not).
// =============================================================================

import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native'
import { SystemWindow, Icon } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, BORDER, RADIUS } from '@/theme/tokens'
import type { HealthConnectStatus } from '@/lib/health'

const HEALTH_CONNECT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'

interface Props {
  visible: boolean
  // Called after the flow resolves. `granted` reflects the outcome.
  onDone: (granted: boolean) => void
  // Dismiss without connecting (player can do it later).
  onSkip: () => void
}

// 'intro' = first ask; the rest are post-attempt guidance states.
type PromptView = 'intro' | HealthConnectStatus

export function HealthPermissionPrompt({ visible, onDone, onSkip }: Props) {
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<PromptView>('intro')

  async function handleConnect() {
    setLoading(true)
    try {
      const { connectHealth } = await import('@/lib/health')
      const status = await connectHealth() // launches the native permission popup
      if (status === 'granted') onDone(true)
      else setView(status)               // show targeted guidance for the result
    } catch {
      setView('unavailable')
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenHealthUI() {
    const { openHealthPermissions } = await import('@/lib/health')
    await openHealthPermissions() // opens Health Connect's own permission screen
    onDone(false)
  }

  const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'
  const isAndroid = Platform.OS === 'android'

  function SkipBtn() {
    return (
      <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7} disabled={loading}>
        <Text style={styles.skipTxt}>Maybe later</Text>
      </TouchableOpacity>
    )
  }

  function PrimaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <TouchableOpacity style={styles.connectBtn} onPress={onPress} disabled={loading} activeOpacity={0.8}>
        {loading
          ? <ActivityIndicator size="small" color={COLORS.system} />
          : <Text style={styles.connectTxt}>{label}</Text>}
      </TouchableOpacity>
    )
  }

  function renderBody() {
    switch (view) {
      // First ask — explain value + show exactly what's read.
      case 'intro':
        return (
          <>
            <Text style={styles.body}>
              Aeternum turns your real activity into power. Connect {platformName} to
              sync your movement into stats, loot and stamina.
            </Text>
            <View style={styles.dataList}>
              <View style={styles.dataRow}><Icon name="shoe-print" size={16} color={COLORS.system} /><Text style={styles.dataTxt}>Steps</Text></View>
              <View style={styles.dataRow}><Icon name="map-marker-distance" size={16} color={COLORS.system} /><Text style={styles.dataTxt}>Distance</Text></View>
              <View style={styles.dataRow}><Icon name="heart-pulse" size={16} color={COLORS.system} /><Text style={styles.dataTxt}>Heart rate</Text></View>
            </View>
            <Text style={styles.note}>
              Read-only. Used only inside the game — never shared or sold.
              {isAndroid ? '\nTip: tap “Allow all” on the next screen.' : ''}
            </Text>
            <PrimaryBtn label="CONNECT & SYNC" onPress={handleConnect} />
            <SkipBtn />
          </>
        )

      // Health Connect app missing — send them to install it.
      case 'needs-install':
        return (
          <>
            <Text style={styles.body}>
              Android syncs activity through the free <Text style={styles.bold}>Health Connect</Text> app,
              which isn’t installed yet. Install it once, then come back and connect.
            </Text>
            <PrimaryBtn label="GET HEALTH CONNECT" onPress={() => Linking.openURL(HEALTH_CONNECT_PLAY_URL)} />
            <TouchableOpacity style={styles.retryBtn} onPress={() => setView('intro')} activeOpacity={0.7}>
              <Text style={styles.retryTxt}>I’ve installed it — try again</Text>
            </TouchableOpacity>
            <SkipBtn />
          </>
        )

      case 'needs-update':
        return (
          <>
            <Text style={styles.body}>
              Your <Text style={styles.bold}>Health Connect</Text> app needs an update before it can share data.
            </Text>
            <PrimaryBtn label="UPDATE HEALTH CONNECT" onPress={() => Linking.openURL(HEALTH_CONNECT_PLAY_URL)} />
            <TouchableOpacity style={styles.retryBtn} onPress={() => setView('intro')} activeOpacity={0.7}>
              <Text style={styles.retryTxt}>Updated — try again</Text>
            </TouchableOpacity>
            <SkipBtn />
          </>
        )

      // User dismissed or didn't toggle the data on.
      case 'denied':
        return (
          <>
            <Text style={styles.body}>
              Almost there — Aeternum still needs access to your{' '}
              <Text style={styles.bold}>Steps</Text> and <Text style={styles.bold}>Distance</Text>.
              Open {platformName} and turn those toggles <Text style={styles.bold}>on</Text>.
            </Text>
            <PrimaryBtn label={`OPEN ${platformName.toUpperCase()}`} onPress={handleOpenHealthUI} />
            <TouchableOpacity style={styles.retryBtn} onPress={handleConnect} activeOpacity={0.7}>
              <Text style={styles.retryTxt}>Try the popup again</Text>
            </TouchableOpacity>
            <SkipBtn />
          </>
        )

      // Device can't support it.
      default:
        return (
          <>
            <Text style={styles.body}>
              This device can’t connect {platformName} right now. You can still play —
              your activity just won’t auto-sync.
            </Text>
            <PrimaryBtn label="OK" onPress={() => onDone(false)} />
          </>
        )
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <SystemWindow title="◆ CONNECT YOUR ACTIVITY" variant="info">
            {renderBody()}
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  box: { width: '100%' },
  body: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  note: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, lineHeight: 16, marginBottom: SPACING.lg },
  connectBtn: {
    backgroundColor: 'rgba(79,168,248,0.15)', borderWidth: BORDER.thin, borderColor: COLORS.system,
    borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm,
  },
  connectTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.system, letterSpacing: LETTER_SPACING.wide },
  skipBtn: { alignItems: 'center', paddingVertical: SPACING.xs },
  skipTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.normal },
  bold: { color: COLORS.textPrimary, fontFamily: FONTS.display },
  dataList: { gap: SPACING.xs, marginBottom: SPACING.sm, paddingLeft: SPACING.xs },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dataTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  retryBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  retryTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.system, letterSpacing: LETTER_SPACING.normal },
})
