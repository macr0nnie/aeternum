// =============================================================================
// Aeternum — Root Layout
// =============================================================================

import { useEffect, useCallback, useState, useRef } from 'react'
import { View, StyleSheet, Alert, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase, ensurePlayer } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { Onboarding } from '@/components/Onboarding'
import { CharacterSetup } from '@/components/CharacterSetup'
import { elementAccent, COLORS } from '@/theme/tokens'
import type { Element } from '@/types'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Rajdhani_700Bold: require('../assets/fonts/Rajdhani_700Bold.ttf'),
    ShareTechMono_400Regular: require('../assets/fonts/ShareTechMono_400Regular.ttf'),
  })

  const {
    setUserId, setPlayer, player, reset,
    characterSetupDone, setCharacterSetupDone,
    healthPermissionAsked, setHealthPermissionAsked,
    setSyncState, setSyncError, applyRunResult,
  } = useStore()

  const [authResolved, setAuthResolved] = useState(false)
  const syncFired = useRef(false)

  // Restore session on boot — AsyncStorage keeps the JWT between app restarts
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        const { data } = await ensurePlayer(session.user.id)
        if (data) setPlayer(data as Parameters<typeof setPlayer>[0])
      } else {
        reset()
      }
      setAuthResolved(true)
    })
    return () => subscription.unsubscribe()
  }, [setUserId, setPlayer, reset])

  // Request health permissions once after character setup is done
  useEffect(() => {
    if (!player || !characterSetupDone || healthPermissionAsked) return

    async function requestHealth() {
      setHealthPermissionAsked(true)
      try {
        const { initHealth } = await import('@/lib/health')
        const granted = await initHealth()
        if (!granted) {
          Alert.alert(
            'Health Access',
            Platform.OS === 'ios'
              ? 'Enable HealthKit in Settings → Health → Data Access & Devices → Aeternum to sync your runs.'
              : 'Enable Health Connect permissions in Settings to sync your runs.',
            [{ text: 'OK' }],
          )
        }
      } catch {
        // Health not available on this device — fail silently
      }
    }

    requestHealth()
  }, [player, characterSetupDone, healthPermissionAsked, setHealthPermissionAsked])

  // Auto-sync on app open once player is ready — fires once per session
  useEffect(() => {
    if (!player || !characterSetupDone || syncFired.current) return
    syncFired.current = true

    async function autoSync() {
      setSyncState('reading')
      setSyncError(null)
      try {
        const { syncRun } = await import('@/lib/runSync')
        setSyncState('uploading')
        const result = await syncRun(player!.id)
        applyRunResult(result)
      } catch (err) {
        // Silently set error state — no crash, no alert
        setSyncState('error')
        const msg = err instanceof Error ? err.message : 'Sync unavailable.'
        setSyncError(msg)
      }
    }

    autoSync()
  }, [player, characterSetupDone, setSyncState, setSyncError, applyRunResult])

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) await SplashScreen.hideAsync()
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) return null

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)

  // Show character setup for brand-new players (username still auto-generated "Runner-XXXX")
  const isNewPlayer =
    player !== null &&
    !characterSetupDone &&
    player.username.startsWith('Runner-')

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} onLayout={onLayoutRootView}>
        <StatusBar style="light" />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: COLORS.surface,
              borderTopColor: palette.border,
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
            },
            tabBarActiveTintColor: palette.base,
            tabBarInactiveTintColor: COLORS.textTertiary,
            tabBarLabelStyle: {
              fontFamily: 'Rajdhani_700Bold',
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            },
          }}
        >
          <Tabs.Screen name="index"       options={{ title: 'Command',     tabBarIcon: ({ color, size }) => <Ionicons name="terminal-outline"   size={size} color={color} /> }} />
          <Tabs.Screen name="sync"        options={{ href: null }} />
          <Tabs.Screen name="quests"      options={{ title: 'Quests',      tabBarIcon: ({ color, size }) => <Ionicons name="list-outline"        size={size} color={color} /> }} />
          <Tabs.Screen name="dungeons"    options={{ title: 'Gates',       tabBarIcon: ({ color, size }) => <Ionicons name="shield-outline"      size={size} color={color} /> }} />
          <Tabs.Screen name="party"       options={{ title: 'Party',       tabBarIcon: ({ color, size }) => <Ionicons name="people-outline"      size={size} color={color} /> }} />
          <Tabs.Screen name="leaderboard" options={{ title: 'Ranks',       tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline"      size={size} color={color} /> }} />
          <Tabs.Screen name="inventory"   options={{ title: 'Bag',         tabBarIcon: ({ color, size }) => <Ionicons name="bag-outline"         size={size} color={color} /> }} />
          <Tabs.Screen name="smithy"      options={{ title: 'Smithy',      tabBarIcon: ({ color, size }) => <Ionicons name="hammer-outline"      size={size} color={color} /> }} />
          <Tabs.Screen name="identity"    options={{ title: 'Identity',    tabBarIcon: ({ color, size }) => <Ionicons name="person-outline"      size={size} color={color} /> }} />
          <Tabs.Screen name="progress"    options={{ title: 'Progress',    tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline"   size={size} color={color} /> }} />
          {/* Hidden routes */}
          <Tabs.Screen name="rewards"          options={{ href: null }} />
          <Tabs.Screen name="character-setup"  options={{ href: null }} />
        </Tabs>

        {/* Entry gate — unauthenticated users */}
        {!player && <Onboarding ready={authResolved} />}

        {/* Character setup overlay — new players only */}
        {isNewPlayer && (
          <CharacterSetup onComplete={() => setCharacterSetupDone(true)} />
        )}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.ground,
  },
})
