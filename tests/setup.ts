// =============================================================================
// Vitest setup — mock native modules so the store/lib can run in Node.
// =============================================================================
import { vi } from 'vitest'

// AsyncStorage is native; provide an in-memory mock so the persisted Zustand
// store can be imported and exercised in tests.
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => { store.set(k, v) }),
      removeItem: vi.fn(async (k: string) => { store.delete(k) }),
      clear: vi.fn(async () => { store.clear() }),
    },
  }
})

// Supabase client is network/native; the store imports types only, but guard
// against accidental client construction in tests.
vi.mock('@/lib/supabase', async () => {
  return {
    supabase: {},
    isSupabaseConfigured: false,
  }
})
