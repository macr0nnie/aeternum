import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import {
  savePlayerInventory, savePlayerProgress, savePlayerStats, savePlayerTraits,
} from '@/lib/supabase'
import type { Stats } from '@/types'

export function usePersistenceSync() {
  const player       = useStore(s => s.player)
  const inventory    = useStore(s => s.inventory)
  const equipped     = useStore(s => s.equipped)
  const completedQuestIds  = useStore(s => s.completedQuestIds)
  const clearedDungeonIds  = useStore(s => s.clearedDungeonIds)

  const traits = useStore(s => s.traits)

  const invTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const traitsTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced inventory + loadout save (2 s)
  useEffect(() => {
    if (!player?.id) return
    if (invTimer.current) clearTimeout(invTimer.current)
    invTimer.current = setTimeout(() => {
      savePlayerInventory(player.id, inventory, equipped)
    }, 2000)
    return () => { if (invTimer.current) clearTimeout(invTimer.current) }
  }, [inventory, equipped, player?.id])

  // Debounced quest + dungeon progress save (1 s — cheaper payload)
  useEffect(() => {
    if (!player?.id) return
    if (progressTimer.current) clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      savePlayerProgress(player.id, completedQuestIds, clearedDungeonIds)
    }, 1000)
    return () => { if (progressTimer.current) clearTimeout(progressTimer.current) }
  }, [completedQuestIds, clearedDungeonIds, player?.id])

  // Debounced stats + rank save (3 s — only on actual change)
  const prevStats = useRef<string>('')
  useEffect(() => {
    if (!player?.id || !player.stats) return
    const key = JSON.stringify(player.stats) + player.rank
    if (key === prevStats.current) return
    prevStats.current = key
    if (statsTimer.current) clearTimeout(statsTimer.current)
    statsTimer.current = setTimeout(() => {
      savePlayerStats(player.id, player.stats as Stats, player.rank)
    }, 3000)
    return () => { if (statsTimer.current) clearTimeout(statsTimer.current) }
  }, [player?.stats, player?.rank, player?.id])

  // Debounced traits save (3 s — behavioral fingerprint, low urgency)
  const prevTraits = useRef<string>('')
  useEffect(() => {
    if (!player?.id) return
    const key = JSON.stringify(traits)
    if (key === prevTraits.current) return
    prevTraits.current = key
    if (traitsTimer.current) clearTimeout(traitsTimer.current)
    traitsTimer.current = setTimeout(() => {
      savePlayerTraits(player.id, traits)
    }, 3000)
    return () => { if (traitsTimer.current) clearTimeout(traitsTimer.current) }
  }, [traits, player?.id])
}
