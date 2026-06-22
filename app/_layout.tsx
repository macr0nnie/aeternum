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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase, ensurePlayer, fetchPlayerProgress, fetchPlayerResources, fetchFortress, isSupabaseConfigured } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { usePersistenceSync } from '@/hooks/usePersistenceSync'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Onboarding } from '@/components/Onboarding'
import { HealthPermissionPrompt } from '@/components/HealthPermissionPrompt'
import { CharacterSetup } from '@/components/CharacterSetup'
import { elementAccent, COLORS } from '@/theme/tokens'
import type { Element } from '@/types'
import { installGlobalHandlers, setCrashReporter } from '@/lib/crashReporter'
import * as Sentry from '@sentry/react-native'

// Initialise Sentry once at module load. DSN comes from an env var so it's not
// hardcoded; with no DSN, Sentry stays inert and we fall back to local logging.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN && !__DEV__,   // don't spam Sentry from local dev
  tracesSampleRate: 0.2,
})
// Route our app-wide crash reporter through Sentry.
setCrashReporter({
  capture: (e, ctx) => Sentry.captureException(e, ctx ? { extra: ctx } : undefined),
})

SplashScreen.preventAutoHideAsync()
installGlobalHandlers()

export default Sentry.wrap(function RootLayout() {
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
    healthPermissionAsked, setHealthPermissionAsked,
    setResources, setFortress,
  } = useStore()

  // Keep Supabase in sync with every local state change
  usePersistenceSync()

  const [authResolved, setAuthResolved] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)
  const retryBoot = useCallback(() => {
    setBootError(null)
    setAuthResolved(false)
    setBootAttempt((n) => n + 1)
  }, [])
  const syncFired = useRef(false)

  // Restore session on boot — load player + server-persisted progress/inventory
  useEffect(() => {
  let mounted = true

  // Load (or create) the player + server-persisted progress for a signed-in user.
  // Shared by the boot path AND the auth listener so that signing in *after*
  // boot (e.g. tapping "Begin") actually creates the player and dismisses the
  // Onboarding overlay. Without this, sign-in left `player` null forever and the
  // app got stuck on the Begin screen.
  const loadUser = async (userId: string) => {
    setUserId(userId)

    const { data: playerData } = await ensurePlayer(userId)
    if (!mounted) return
    if (playerData) {
      setPlayer(playerData as any)

      const { data: progress } = await fetchPlayerProgress(userId)
      if (!mounted) return
      if (progress) {
        if (progress.inventory) setInventory(progress.inventory as any)
        if (progress.equipped) setEquipped(progress.equipped as any)
        if (progress.completed_quest_ids) setCompletedQuestIds(progress.completed_quest_ids)
        if (progress.cleared_dungeon_ids) setClearedDungeonIds(progress.cleared_dungeon_ids)
        if (progress.traits) setTraits(progress.traits as any)
      }

      // Hydrate resources + fortress on boot (previously only loaded when the
      // Fortress tab opened, so influence/resources looked missing until then).
      const [res, fort] = await Promise.all([
        fetchPlayerResources(userId).catch(() => ({ data: null })),
        fetchFortress(userId).catch(() => ({ data: null })),
      ])
      if (!mounted) return
      if (res.data) {
        const r = res.data as any
        setResources({
          influence: r.influence ?? 0, iron: r.iron ?? 0, crystal: r.crystal ?? 0,
          mana: r.mana_res ?? 0, herbs: r.herbs ?? 0, gold: r.gold_res ?? 0,
        })
      }
      if (fort.data) {
        const f = fort.data as any
        setFortress({
          level: f.level ?? 1,
          barracks_level: f.barracks_level ?? 0,
          walls_level: f.walls_level ?? 0,
          forge_level: f.forge_level ?? 0,
          element: f.element ?? null,
          defense_slots: f.defense_slots ?? [],
        })
      }
    }
  }

  const init = async () => {
    // No backend configured (placeholder env) → skip the network round-trip
    // entirely so we don't hang on an unreachable URL. The Onboarding overlay
    // will offer the offline entry path.
    if (!isSupabaseConfigured) {
      if (mounted) setAuthResolved(true)
      return
    }
    try {
      // Bound the boot so a hung/unreachable backend can't leave the app stuck on
      // the loading screen forever. A `TIMEOUT` sentinel lets us tell "backend
      // unreachable" apart from a clean "no session" and surface a real error.
      const TIMEOUT = Symbol('timeout')
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 6000)),
      ])
      if (!mounted) return
      if (sessionResult === TIMEOUT) {
        setBootError('Could not reach the server. Check your connection and retry.')
        return
      }
      const session = sessionResult.data?.session
      if (session?.user) await loadUser(session.user.id)
    } catch (err) {
      console.error('[RootLayout] boot session load failed', err)
      if (mounted) setBootError('Could not reach the server. Check your connection and retry.')
    } finally {
      if (mounted) setAuthResolved(true)
    }
  }

  init()

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      // Fire-and-forget; guarded internally against unmount.
      loadUser(session.user.id).catch(err =>
        console.error('[RootLayout] auth-change player load failed', err),
      )
    } else {
      reset()
    }
  })

  return () => {
    mounted = false
    subscription.unsubscribe()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bootAttempt])

  // Auto-sync on app open once player is ready — fires once per session
  useEffect(() => {
    if (!player || !characterSetupDone || syncFired.current) return
    // Offline guest players (id `offline-…`) have no server row — never sync them,
    // or the call hits an unreachable backend and the sync state spins forever.
    if (player.id.startsWith('offline-')) return
    syncFired.current = true

    let active = true

    async function autoSync() {
      setSyncState('reading')
      setSyncError(null)
      try {
        const { syncRun } = await import('@/lib/runSync')
        if (!active) return
        setSyncState('uploading')
        const { result, summary } = await syncRun(player!.id)
        if (!active) return
        applyRunResult(result, summary)
      } catch (err) {
        if (!active) return
        // Silently set error state — no crash, no alert
        setSyncState('error')
        const msg = err instanceof Error ? err.message : 'Sync unavailable.'
        setSyncError(msg)
      }
    }

    autoSync()

    return () => { active = false }
  }, [player, characterSetupDone, setSyncState, setSyncError, applyRunResult])

  // Show the health-connect prompt once the player is set up (online players
  // only). We use a VISIBLE in-app modal whose CONNECT button launches the
  // native permission popup from a real tap — a background call to
  // requestPermission does not reliably surface the system dialog.
  const showHealthPrompt =
    !!player &&
    characterSetupDone &&
    !healthPermissionAsked &&
    !player.id.startsWith('offline-')

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
      <SafeAreaProvider>
      <ErrorBoundary label="root">
      <RootShell
        onLayoutRootView={onLayoutRootView}
        palette={palette}
        player={player}
        authResolved={authResolved}
        bootError={bootError}
        retryBoot={retryBoot}
        isNewPlayer={isNewPlayer}
        setCharacterSetupDone={setCharacterSetupDone}
      />
      {/* One-time health connect prompt, shown right after character creation. */}
      <HealthPermissionPrompt
        visible={showHealthPrompt}
        onDone={() => setHealthPermissionAsked(true)}
        onSkip={() => setHealthPermissionAsked(true)}
      />
      </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
});

// Inner shell: lives inside SafeAreaProvider so it can read the bottom inset and
// pad the tab bar above the Android gesture/nav buttons (otherwise the bar
// overlaps them and the buttons are hard to tap).
interface RootShellProps {
  onLayoutRootView: () => void
  palette: ReturnType<typeof elementAccent>
  player: ReturnType<typeof useStore.getState>['player']
  authResolved: boolean
  bootError: string | null
  retryBoot: () => void
  isNewPlayer: boolean
  setCharacterSetupDone: (done: boolean) => void
}

function RootShell({
  onLayoutRootView, palette, player, authResolved, bootError, retryBoot,
  isNewPlayer, setCharacterSetupDone,
}: RootShellProps) {
  const insets = useSafeAreaInsets()
  return (
      <View style={styles.root} onLayout={onLayoutRootView}>
        <StatusBar style="light" />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: COLORS.surface,
              borderTopColor: palette.border,
              borderTopWidth: 1,
              // Add the bottom safe-area inset so the bar sits above the Android
              // nav/gesture bar instead of underneath it.
              height: 60 + insets.bottom,
              paddingBottom: 8 + insets.bottom,
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
          <Tabs.Screen name="dungeons"    options={{ title: 'Rifts',    tabBarIcon: ({ color, size }) => <Ionicons name="shield-outline"   size={size} color={color} /> }} />
          <Tabs.Screen name="hunter"      options={{ title: 'Hero',     tabBarIcon: ({ color, size }) => <Ionicons name="body-outline"     size={size} color={color} /> }} />
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
        {!player && <Onboarding ready={authResolved} bootError={bootError} onRetry={retryBoot} />}

        {/* Character setup overlay — new players only */}
        {isNewPlayer && (
          <CharacterSetup onComplete={() => setCharacterSetupDone(true)} />
        )}
      </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.ground,
  },
})
