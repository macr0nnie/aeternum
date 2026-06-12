// =============================================================================
// Aeternum — Root Layout
// =============================================================================

import { useEffect, useCallback, useState, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase, ensurePlayer, fetchPlayerProgress } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { usePersistenceSync } from '@/hooks/usePersistenceSync'
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
    setUserId, setPlayer, setInventory, setEquipped,
    setCompletedQuestIds, setClearedDungeonIds, setTraits,
    player, reset,
    characterSetupDone, setCharacterSetupDone,
    setSyncState, setSyncError, applyRunResult,
  } = useStore()

  // Keep Supabase in sync with every local state change
  usePersistenceSync()

  const [authResolved, setAuthResolved] = useState(false)
  const syncFired = useRef(false)

  // Restore session on boot — load player + server-persisted progress/inventory
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        const { data: playerData } = await ensurePlayer(session.user.id)
        if (playerData) {
          setPlayer(playerData as Parameters<typeof setPlayer>[0])
          // Hydrate server-persisted state (inventory, progress)
          const { data: progress } = await fetchPlayerProgress(session.user.id)
          if (progress) {
            if (progress.inventory) setInventory(progress.inventory as Parameters<typeof setInventory>[0])
            if (progress.equipped)  setEquipped(progress.equipped as Parameters<typeof setEquipped>[0])
            if (progress.completed_quest_ids) setCompletedQuestIds(progress.completed_quest_ids as string[])
            if (progress.cleared_dungeon_ids) setClearedDungeonIds(progress.cleared_dungeon_ids as string[])
            if (progress.traits) setTraits(progress.traits as Parameters<typeof setTraits>[0])
          }
        }
      } else {
        reset()
      }
      setAuthResolved(true)
    })
    return () => subscription.unsubscribe()
  }, [setUserId, setPlayer, setInventory, setEquipped, setCompletedQuestIds, setClearedDungeonIds, reset])

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
          <Tabs.Screen name="world"       options={{ title: 'World',    tabBarIcon: ({ color, size }) => <Ionicons name="globe-outline"    size={size} color={color} /> }} />
          <Tabs.Screen name="fortress"    options={{ title: 'Fortress', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline"     size={size} color={color} /> }} />
          <Tabs.Screen name="dungeons"    options={{ title: 'Gates',    tabBarIcon: ({ color, size }) => <Ionicons name="shield-outline"   size={size} color={color} /> }} />
          <Tabs.Screen name="hunter"      options={{ title: 'Hunter',   tabBarIcon: ({ color, size }) => <Ionicons name="body-outline"     size={size} color={color} /> }} />
          <Tabs.Screen name="party"       options={{ title: 'Party',    tabBarIcon: ({ color, size }) => <Ionicons name="people-outline"   size={size} color={color} /> }} />
          <Tabs.Screen name="settings"    options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
          {/* Hidden screens */}
          <Tabs.Screen name="index"            options={{ href: null }} />
          <Tabs.Screen name="quests"           options={{ href: null }} />
          <Tabs.Screen name="leaderboard"      options={{ href: null }} />
          <Tabs.Screen name="inventory"        options={{ href: null }} />
          <Tabs.Screen name="smithy"           options={{ href: null }} />
          <Tabs.Screen name="identity"         options={{ href: null }} />
          <Tabs.Screen name="progress"         options={{ href: null }} />
          <Tabs.Screen name="sync"             options={{ href: null }} />
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
