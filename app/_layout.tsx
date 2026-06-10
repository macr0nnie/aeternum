// =============================================================================
// Aeternum — Root Layout
// =============================================================================
// Expo Router's entry layout. Handles:
//   - Font loading (Rajdhani + Share Tech Mono)
//   - Auth gate — unauthenticated users never reach game screens
//   - Tab navigation with element accent theming
//   - Splash screen hold until fonts are ready
// =============================================================================

import React, { useEffect, useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase, ensurePlayer } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { Onboarding } from '@/components/Onboarding'
import { elementAccent, COLORS } from '@/theme/tokens'
import type { Element } from '@/types'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Rajdhani_700Bold: require('../assets/fonts/Rajdhani_700Bold.ttf'),
    ShareTechMono_400Regular: require('../assets/fonts/ShareTechMono_400Regular.ttf'),
  })

  const { setUserId, setPlayer, player, reset } = useStore()

  // True once the initial Supabase session check has completed. Until then we
  // hold the onboarding overlay in a neutral state so returning guests don't
  // see the "Begin" button flash before their session restores.
  const [authResolved, setAuthResolved] = useState(false)

  // Auth listener — keeps store in sync with Supabase session. Fires once on
  // mount with the restored (or absent) session, then on every change.
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) await SplashScreen.hideAsync()
  }, [fontsLoaded, fontError])

  // Font failure shouldn't trap the user on the splash screen forever — fall
  // through to the app (system fonts) rather than hanging.
  if (!fontsLoaded && !fontError) return null

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)

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
          <Tabs.Screen
            name="index"
            options={{ title: 'Command' }}
          />
          <Tabs.Screen
            name="sync"
            options={{ title: 'Sync' }}
          />
          <Tabs.Screen
            name="rewards"
            options={{ title: 'Rewards' }}
          />
          <Tabs.Screen
            name="identity"
            options={{ title: 'Identity' }}
          />
          <Tabs.Screen
            name="progress"
            options={{ title: 'Progress' }}
          />
          <Tabs.Screen
            name="party"
            options={{ title: 'Party' }}
          />
        </Tabs>

        {/* Entry gate — covers the app until an authenticated player exists */}
        {!player && <Onboarding ready={authResolved} />}
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
