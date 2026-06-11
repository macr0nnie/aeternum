// =============================================================================
// Aeternum — Supabase Client
// =============================================================================
// Singleton client — imported everywhere that needs database or auth access.
//
// Why singleton: creating multiple GoTrueClient instances causes auth token
// conflicts and doubled realtime connections. One module, one instance.
//
// Why AsyncStorage: the default in-memory storage loses the session on app
// restart. AsyncStorage persists the JWT so the user stays signed in.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Player } from '@/types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// True only when both env vars are present and not left at the .env.example
// placeholder values. Screens use this to decide whether to attempt the backend
// or fall back to a navigable offline state.
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl!.includes('your-project') &&
  !supabaseAnonKey!.includes('your-anon-key')

if (!isSupabaseConfigured) {
  // Why warn instead of throw: a module-level throw white-screens the whole app
  // before React mounts, with no recovery path. The app must always boot — the
  // entry screen then offers an offline path or a clear "backend unreachable"
  // message. Copy .env.example → .env to enable the real backend.
  console.warn(
    '[Aeternum] Supabase is not configured — running in offline mode. ' +
      'Copy .env.example → .env and set EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY to enable the backend.',
  )
}

// Fall back to harmless placeholders so createClient never throws at import
// time when env vars are absent. Network calls then fail and are handled
// gracefully by callers (see Onboarding + runSync) rather than crashing.
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'offline-placeholder-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)

// ---------------------------------------------------------------------------
// Offline guest
// ---------------------------------------------------------------------------
// A fully-local player so the UI is navigable without any backend — used for
// development/testing and as a graceful fallback when Supabase is unreachable.
// Nothing here is persisted server-side; it lives only in the Zustand store.

export function buildLocalGuestPlayer(): Player {
  const now = new Date().toISOString()
  return {
    id: `offline-${Math.random().toString(36).slice(2, 10)}`,
    username: `Runner-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    rank: 'E',
    total_distance_km: 0,
    primary_element: null,
    secondary_element: null,
    stats: { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 0, PER: 0, CHA: 0 },
    title: 'Unawakened',
    title_chronicle: [],
    created_at: now,
    updated_at: now,
  }
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ---------------------------------------------------------------------------
// Guest entry
// ---------------------------------------------------------------------------
// Players enter instantly as anonymous guests — no email, no friction. A
// player row is created on first entry. An email can be linked later for
// account recovery (Supabase supports upgrading an anonymous user in place).
//
// Requires "Allow anonymous sign-ins" to be enabled in the Supabase project
// (Authentication → Sign In / Providers → Anonymous).

export async function signInAsGuest() {
  return supabase.auth.signInAnonymously()
}

// Generate a default commander name for a new guest. Players rename later on
// the Identity screen. No uniqueness constraint exists, so collisions are fine.
function generateGuestUsername(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `Runner-${suffix}`
}

// ---------------------------------------------------------------------------
// Player helpers
// ---------------------------------------------------------------------------

export async function fetchPlayer(playerId: string) {
  return supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()
}

// Fetch the player row, creating one with defaults if this is a new guest.
// RLS ("players_own_row") permits the insert because auth.uid() === playerId.
export async function ensurePlayer(playerId: string) {
  const existing = await fetchPlayer(playerId)
  if (existing.data) return existing

  return supabase
    .from('players')
    .insert({ id: playerId, username: generateGuestUsername() })
    .select('*')
    .single()
}

export async function fetchRunHistory(playerId: string, limit = 20) {
  return supabase
    .from('run_sessions')
    .select('*')
    .eq('player_id', playerId)
    .order('started_at', { ascending: false })
    .limit(limit)
}

export async function updatePlayer(playerId: string, updates: Partial<import('@/types').Player>) {
  return supabase
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .select('*')
    .single()
}
