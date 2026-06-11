import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Player, RunSession, SyncRunResponse } from '@/types'

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

  // Local game progress (persisted via AsyncStorage)
  completedQuestIds: string[]
  clearedDungeonIds: string[]
  characterSetupDone: boolean
  healthPermissionAsked: boolean

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
  completeQuest: (questId: string, statRewards: Partial<import('@/types').Stats>) => void
  clearDungeon: (dungeonId: string, statRewards: Partial<import('@/types').Stats>) => void
  setCharacterSetupDone: (done: boolean) => void
  setHealthPermissionAsked: (asked: boolean) => void
  reset: () => void
}

const INITIAL_TRANSIENT = {
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

const INITIAL_PERSISTENT = {
  completedQuestIds: [],
  clearedDungeonIds: [],
  characterSetupDone: false,
  healthPermissionAsked: false,
}

export const useStore = create<AeternumState>()(
  persist(
    (set, get) => ({
      ...INITIAL_TRANSIENT,
      ...INITIAL_PERSISTENT,

      setUserId: (id) => set({ userId: id }),
      setPlayer: (player) => set({ player, playerError: null }),
      setPlayerLoading: (loading) => set({ playerLoading: loading }),
      setPlayerError: (error) => set({ playerError: error }),
      setRunHistory: (runs) => set({ runHistory: runs }),
      setRunHistoryLoading: (loading) => set({ runHistoryLoading: loading }),
      setSyncState: (syncState) => set({ syncState }),
      setSyncError: (syncError) => set({ syncError }),
      setLatestRunResult: (result) => set({ latestRunResult: result }),

      applyRunResult: (result) => {
        const { player } = get()
        if (!player) return
        const updatedStats = { ...player.stats }
        for (const [key, gain] of Object.entries(result.stat_gains)) {
          const k = key as keyof typeof updatedStats
          updatedStats[k] = (updatedStats[k] ?? 0) + (gain as number)
        }
        set({
          player: { ...player, stats: updatedStats },
          latestRunResult: result,
          syncState: 'done',
          syncError: null,
        })
      },

      completeQuest: (questId, statRewards) => {
        const { completedQuestIds, player } = get()
        if (completedQuestIds.includes(questId)) return
        const newIds = [...completedQuestIds, questId]
        let updatedPlayer = player
        if (player && Object.keys(statRewards).length > 0) {
          const updatedStats = { ...player.stats }
          for (const [k, v] of Object.entries(statRewards)) {
            const key = k as keyof typeof updatedStats
            updatedStats[key] = (updatedStats[key] ?? 0) + (v as number)
          }
          updatedPlayer = { ...player, stats: updatedStats }
        }
        set({ completedQuestIds: newIds, player: updatedPlayer })
      },

      clearDungeon: (dungeonId, statRewards) => {
        const { clearedDungeonIds, player } = get()
        if (clearedDungeonIds.includes(dungeonId)) return
        const newIds = [...clearedDungeonIds, dungeonId]
        let updatedPlayer = player
        if (player && Object.keys(statRewards).length > 0) {
          const updatedStats = { ...player.stats }
          for (const [k, v] of Object.entries(statRewards)) {
            const key = k as keyof typeof updatedStats
            updatedStats[key] = (updatedStats[key] ?? 0) + (v as number)
          }
          updatedPlayer = { ...player, stats: updatedStats }
        }
        set({ clearedDungeonIds: newIds, player: updatedPlayer })
      },

      setCharacterSetupDone: (done) => set({ characterSetupDone: done }),
      setHealthPermissionAsked: (asked) => set({ healthPermissionAsked: asked }),

      reset: () => set(INITIAL_TRANSIENT),
    }),
    {
      name: 'aeternum-local',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedQuestIds: state.completedQuestIds,
        clearedDungeonIds: state.clearedDungeonIds,
        characterSetupDone: state.characterSetupDone,
        healthPermissionAsked: state.healthPermissionAsked,
      }),
    },
  ),
)

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectPlayer = (s: AeternumState) => s.player
export const selectStats = (s: AeternumState) => s.player?.stats
export const selectSyncState = (s: AeternumState) => s.syncState
export const selectLatestRunResult = (s: AeternumState) => s.latestRunResult
export const selectRunHistory = (s: AeternumState) => s.runHistory
export const selectUserId = (s: AeternumState) => s.userId
export const selectCompletedQuestIds = (s: AeternumState) => s.completedQuestIds
export const selectClearedDungeonIds = (s: AeternumState) => s.clearedDungeonIds
export const selectCharacterSetupDone = (s: AeternumState) => s.characterSetupDone
export const selectHealthPermissionAsked = (s: AeternumState) => s.healthPermissionAsked
