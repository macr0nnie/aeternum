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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example → .env and fill in your project values.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

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
// Player helpers
// ---------------------------------------------------------------------------

export async function fetchPlayer(playerId: string) {
  return supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
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
