import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Player, RunSession, SyncRunResponse, GearItem, Relic, GearLoadout, PlayerInventory, CoOpGateResponse, Territory, ResourceNode, PlayerResources, Fortress, FortressBuildingKey, FortressCrop, ResourceType } from '@/types'
import { EMPTY_INVENTORY, EMPTY_LOADOUT, EMPTY_RESOURCES, EMPTY_FORTRESS } from '@/types'
import type { PublicPlayer } from '@/lib/supabase'

export interface PartyInvite {
  id: string
  from_player_id: string
  to_player_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  from_username?: string
}

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

  // Latest resolved run
  latestRunResult: SyncRunResponse | null

  // Local game progress (persisted)
  completedQuestIds: string[]
  clearedDungeonIds: string[]
  characterSetupDone: boolean
  healthPermissionAsked: boolean

  // Gear & inventory (persisted)
  inventory: PlayerInventory
  equipped: GearLoadout
  unlockedTalentIds: string[]

  // Party (transient — refreshed on mount)
  partyMembers: PublicPlayer[]
  partyInvites: PartyInvite[]
  lastCoOpResult: CoOpGateResponse | null

  // Territory (persisted resources; territories fetched from server)
  resources: PlayerResources
  fortress: Fortress
  crops: FortressCrop[]
  myTerritories: Territory[]
  nearbyTerritories: Territory[]
  nearbyNodes: ResourceNode[]

  // Unlocked skills
  unlockedSkillIds: string[]

  // Actions — auth/player
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

  // Actions — party
  setPartyMembers: (members: PublicPlayer[]) => void
  setPartyInvites: (invites: PartyInvite[]) => void
  setLastCoOpResult: (result: CoOpGateResponse | null) => void

  // Actions — inventory
  addGearToInventory: (item: GearItem) => void
  addRelicToInventory: (relic: Relic) => void
  addMaterial: (materialId: string, qty: number) => void
  addConsumable: (consumableId: string, qty: number) => void
  consumeConsumable: (consumableId: string, qty?: number) => void
  equipGear: (item: GearItem) => void
  unequipGear: (slot: keyof Omit<GearLoadout, 'relic'>) => void
  equipRelic: (relic: Relic) => void
  unequipRelic: () => void
  unlockTalent: (talentId: string) => void

  // Actions — territory
  setResources: (r: PlayerResources) => void
  addInfluence: (amount: number) => void
  spendInfluence: (amount: number) => boolean
  addResource: (type: ResourceType, amount: number) => void
  spendResources: (cost: Partial<PlayerResources>) => boolean
  setFortress: (f: Fortress) => void
  upgradeFortressBuilding: (key: FortressBuildingKey) => void
  setCrops: (crops: FortressCrop[]) => void
  unlockSkill: (skillId: string) => void
  setMyTerritories: (t: Territory[]) => void
  addMyTerritory: (t: Territory) => void
  setNearbyTerritories: (t: Territory[]) => void
  setNearbyNodes: (n: ResourceNode[]) => void

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
  partyMembers: [] as PublicPlayer[],
  partyInvites: [] as PartyInvite[],
  lastCoOpResult: null as CoOpGateResponse | null,
  crops: [] as FortressCrop[],
  myTerritories: [] as Territory[],
  nearbyTerritories: [] as Territory[],
  nearbyNodes: [] as ResourceNode[],
}

const INITIAL_PERSISTENT = {
  completedQuestIds: [],
  clearedDungeonIds: [],
  characterSetupDone: false,
  healthPermissionAsked: false,
  inventory: EMPTY_INVENTORY,
  equipped: EMPTY_LOADOUT,
  unlockedTalentIds: [],
  unlockedSkillIds: [],
  resources: EMPTY_RESOURCES,
  fortress: EMPTY_FORTRESS,
}

function applyStatRewards(
  player: Player,
  statRewards: Partial<import('@/types').Stats>,
): Player {
  const updatedStats = { ...player.stats }
  for (const [k, v] of Object.entries(statRewards)) {
    const key = k as keyof typeof updatedStats
    updatedStats[key] = (updatedStats[key] ?? 0) + (v as number)
  }
  return { ...player, stats: updatedStats }
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
        set({
          player: applyStatRewards(player, result.stat_gains as Partial<import('@/types').Stats>),
          latestRunResult: result,
          syncState: 'done',
          syncError: null,
        })
      },

      completeQuest: (questId, statRewards) => {
        const { completedQuestIds, player } = get()
        if (completedQuestIds.includes(questId)) return
        set({
          completedQuestIds: [...completedQuestIds, questId],
          player: player && Object.keys(statRewards).length > 0
            ? applyStatRewards(player, statRewards)
            : player,
        })
      },

      clearDungeon: (dungeonId, statRewards) => {
        const { clearedDungeonIds, player } = get()
        if (clearedDungeonIds.includes(dungeonId)) return
        set({
          clearedDungeonIds: [...clearedDungeonIds, dungeonId],
          player: player && Object.keys(statRewards).length > 0
            ? applyStatRewards(player, statRewards)
            : player,
        })
      },

      setCharacterSetupDone: (done) => set({ characterSetupDone: done }),
      setHealthPermissionAsked: (asked) => set({ healthPermissionAsked: asked }),

      // Party
      setPartyMembers: (members) => set({ partyMembers: members }),
      setPartyInvites: (invites) => set({ partyInvites: invites }),
      setLastCoOpResult: (result) => set({ lastCoOpResult: result }),

      // Inventory mutations
      addGearToInventory: (item) => {
        const { inventory } = get()
        const instanceId = `${item.id}_${Date.now()}`
        set({ inventory: { ...inventory, gear: [...inventory.gear, { ...item, instanceId }] } })
      },

      addRelicToInventory: (relic) => {
        const { inventory } = get()
        if (inventory.relics.some(r => r.id === relic.id)) return
        set({ inventory: { ...inventory, relics: [...inventory.relics, relic] } })
      },

      addMaterial: (materialId, qty) => {
        const { inventory } = get()
        const current = inventory.materials[materialId] ?? 0
        const next = Math.max(0, current + qty)
        const materials = { ...inventory.materials }
        if (next === 0) delete materials[materialId]
        else materials[materialId] = next
        set({ inventory: { ...inventory, materials } })
      },

      addConsumable: (consumableId, qty) => {
        const { inventory } = get()
        const current = inventory.consumables[consumableId] ?? 0
        set({ inventory: { ...inventory, consumables: { ...inventory.consumables, [consumableId]: current + qty } } })
      },

      consumeConsumable: (consumableId, qty = 1) => {
        const { inventory } = get()
        const current = inventory.consumables[consumableId] ?? 0
        const next = Math.max(0, current - qty)
        const consumables = { ...inventory.consumables }
        if (next === 0) delete consumables[consumableId]
        else consumables[consumableId] = next
        set({ inventory: { ...inventory, consumables } })
      },

      equipGear: (item) => {
        const { equipped, inventory } = get()
        const slot = item.slot as keyof Omit<GearLoadout, 'relic'>
        const prev = equipped[slot]
        const newGear = prev
          ? inventory.gear.filter(g => g.instanceId !== item.instanceId).concat(prev)
          : inventory.gear.filter(g => g.instanceId !== item.instanceId)
        set({ equipped: { ...equipped, [slot]: item }, inventory: { ...inventory, gear: newGear } })
      },

      unequipGear: (slot) => {
        const { equipped, inventory } = get()
        const item = equipped[slot]
        if (!item) return
        set({
          equipped: { ...equipped, [slot]: null },
          inventory: { ...inventory, gear: [...inventory.gear, item] },
        })
      },

      equipRelic: (relic) => {
        const { equipped, inventory } = get()
        const prev = equipped.relic
        const newRelics = prev
          ? inventory.relics.filter(r => r.id !== relic.id).concat(prev)
          : inventory.relics.filter(r => r.id !== relic.id)
        set({ equipped: { ...equipped, relic }, inventory: { ...inventory, relics: newRelics } })
      },

      unequipRelic: () => {
        const { equipped, inventory } = get()
        if (!equipped.relic) return
        set({
          equipped: { ...equipped, relic: null },
          inventory: { ...inventory, relics: [...inventory.relics, equipped.relic] },
        })
      },

      unlockTalent: (talentId) => {
        const { unlockedTalentIds } = get()
        if (unlockedTalentIds.includes(talentId)) return
        set({ unlockedTalentIds: [...unlockedTalentIds, talentId] })
      },

      // Territory actions
      setResources: (r) => set({ resources: r }),
      addInfluence: (amount) => set((s) => ({ resources: { ...s.resources, influence: s.resources.influence + amount } })),
      spendInfluence: (amount) => {
        const { resources } = get()
        if (resources.influence < amount) return false
        set({ resources: { ...resources, influence: resources.influence - amount } })
        return true
      },
      addResource: (type, amount) => set((s) => ({ resources: { ...s.resources, [type]: (s.resources[type as keyof PlayerResources] as number) + amount } })),
      spendResources: (cost) => {
        const { resources } = get()
        for (const [k, v] of Object.entries(cost)) {
          if ((resources[k as keyof PlayerResources] as number) < (v as number)) return false
        }
        const next = { ...resources }
        for (const [k, v] of Object.entries(cost)) {
          (next[k as keyof PlayerResources] as number) -= v as number
        }
        set({ resources: next })
        return true
      },
      setFortress: (f) => set({ fortress: f }),
      upgradeFortressBuilding: (key) => set((s) => ({ fortress: { ...s.fortress, [key]: (s.fortress[key] as number) + 1 } })),
      setCrops: (crops) => set({ crops }),
      unlockSkill: (skillId) => set((s) => ({
        unlockedSkillIds: s.unlockedSkillIds.includes(skillId) ? s.unlockedSkillIds : [...s.unlockedSkillIds, skillId],
      })),
      setMyTerritories: (t) => set({ myTerritories: t }),
      addMyTerritory: (t) => set((s) => ({ myTerritories: [t, ...s.myTerritories] })),
      setNearbyTerritories: (t) => set({ nearbyTerritories: t }),
      setNearbyNodes: (n) => set({ nearbyNodes: n }),

      reset: () => set({ ...INITIAL_TRANSIENT, ...INITIAL_PERSISTENT }),
    }),
    {
      name: 'aeternum-local',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedQuestIds: state.completedQuestIds,
        clearedDungeonIds: state.clearedDungeonIds,
        characterSetupDone: state.characterSetupDone,
        healthPermissionAsked: state.healthPermissionAsked,
        inventory: state.inventory,
        equipped: state.equipped,
        unlockedTalentIds: state.unlockedTalentIds,
        unlockedSkillIds: state.unlockedSkillIds,
        resources: state.resources,
        fortress: state.fortress,
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
export const selectInventory = (s: AeternumState) => s.inventory
export const selectEquipped = (s: AeternumState) => s.equipped
export const selectUnlockedTalentIds = (s: AeternumState) => s.unlockedTalentIds
export const selectPartyMembers = (s: AeternumState) => s.partyMembers
export const selectPartyInvites = (s: AeternumState) => s.partyInvites
export const selectLastCoOpResult = (s: AeternumState) => s.lastCoOpResult
export const selectResources = (s: AeternumState) => s.resources
export const selectFortress = (s: AeternumState) => s.fortress
export const selectCrops = (s: AeternumState) => s.crops
export const selectUnlockedSkillIds = (s: AeternumState) => s.unlockedSkillIds
export const selectMyTerritories = (s: AeternumState) => s.myTerritories
export const selectNearbyTerritories = (s: AeternumState) => s.nearbyTerritories
export const selectNearbyNodes = (s: AeternumState) => s.nearbyNodes
