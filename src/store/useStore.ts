// =============================================================================
// Aeternum — Global Zustand Store
// =============================================================================
// Single store for all shared app state. Mutations always go through named
// actions — no direct `set` calls from components.
//
// Why Zustand over Redux: minimal boilerplate, TypeScript-first, no context
// provider wrapping, and the selector pattern prevents unnecessary re-renders.
//
// Why a single store: the game state is tightly coupled (a run resolution
// touches player stats, rewards, and run history simultaneously). A single
// store makes cross-slice mutations trivial and avoids sync issues.
// =============================================================================

import { create } from 'zustand'
import type { Player, RunSession, SyncRunResponse } from '@/types'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AeternumState {
  // Auth
  userId: string | null

  // Player
  player: Player | null
  playerLoading: boolean
  playerError: string | null

  // Run history
  runHistory: RunSession[]
  runHistoryLoading: boolean

  // Pending sync state
  syncState: 'idle' | 'reading' | 'uploading' | 'done' | 'error'
  syncError: string | null

  // Latest resolved run (shown on rewards screen)
  latestRunResult: SyncRunResponse | null

  // Actions
  setUserId: (id: string | null) => void
  setPlayer: (player: Player) => void
  setPlayerLoading: (loading: boolean) => void
  setPlayerError: (error: string | null) => void
  setRunHistory: (runs: RunSession[]) => void
  setRunHistoryLoading: (loading: boolean) => void
  setSyncState: (state: AeternumState['syncState']) => void
  setSyncError: (error: string | null) => void
  setLatestRunResult: (result: SyncRunResponse | null) => void
  applyRunResult: (result: SyncRunResponse) => void
  reset: () => void
}

// ---------------------------------------------------------------------------
// Initial state (extracted for reset action)
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  userId: null,
  player: null,
  playerLoading: false,
  playerError: null,
  runHistory: [],
  runHistoryLoading: false,
  syncState: 'idle' as const,
  syncError: null,
  latestRunResult: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStore = create<AeternumState>((set, get) => ({
  ...INITIAL_STATE,

  setUserId: (id) => set({ userId: id }),

  setPlayer: (player) => set({ player, playerError: null }),

  setPlayerLoading: (loading) => set({ playerLoading: loading }),

  setPlayerError: (error) => set({ playerError: error }),

  setRunHistory: (runs) => set({ runHistory: runs }),

  setRunHistoryLoading: (loading) => set({ runHistoryLoading: loading }),

  setSyncState: (syncState) => set({ syncState }),

  setSyncError: (syncError) => set({ syncError }),

  setLatestRunResult: (result) => set({ latestRunResult: result }),

  // Apply a resolved run result to the player's in-memory state so the UI
  // updates immediately without needing a round-trip fetch.
  applyRunResult: (result) => {
    const { player } = get()
    if (!player) return

    const updatedStats = { ...player.stats }
    for (const [key, gain] of Object.entries(result.stat_gains)) {
      const statKey = key as keyof typeof updatedStats
      updatedStats[statKey] = (updatedStats[statKey] ?? 0) + (gain as number)
    }

    set({
      player: { ...player, stats: updatedStats },
      latestRunResult: result,
      syncState: 'done',
      syncError: null,
    })
  },

  reset: () => set(INITIAL_STATE),
}))

// ---------------------------------------------------------------------------
// Selectors (stable references — prevents unnecessary re-renders)
// ---------------------------------------------------------------------------

export const selectPlayer = (s: AeternumState) => s.player
export const selectStats = (s: AeternumState) => s.player?.stats
export const selectSyncState = (s: AeternumState) => s.syncState
export const selectLatestRunResult = (s: AeternumState) => s.latestRunResult
export const selectRunHistory = (s: AeternumState) => s.runHistory
export const selectUserId = (s: AeternumState) => s.userId
