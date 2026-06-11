// =============================================================================
// Aeternum — Root Layout
// =============================================================================

import { useEffect, useCallback, useState } from 'react'
import { View, StyleSheet, Alert, Platform } from 'react-native'
import { Tabs } from 'expo-router'
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
  } = useStore()

  const [authResolved, setAuthResolved] = useState(false)

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
          <Tabs.Screen name="index" options={{ title: 'Command' }} />
          <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
          <Tabs.Screen name="quests" options={{ title: 'Quests' }} />
          <Tabs.Screen name="dungeons" options={{ title: 'Gates' }} />
          <Tabs.Screen name="identity" options={{ title: 'Identity' }} />
          <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
          {/* Hidden legacy routes */}
          <Tabs.Screen name="rewards" options={{ href: null }} />
          <Tabs.Screen name="party" options={{ href: null }} />
          {/* Suppress character-setup from tabs — shown as overlay */}
          <Tabs.Screen name="character-setup" options={{ href: null }} />
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
