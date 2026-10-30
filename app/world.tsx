// =============================================================================
// Aeternum — World Map Screen
// MapLibre + OpenFreeMap vector tiles, styled as a game world (src/theme/mapStyle.ts)
// Claim territories · Attack enemies · Harvest resource nodes
// =============================================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  Alert, ActivityIndicator, Image,
} from 'react-native'
import {
  Map as MapLibreMap, Camera, UserLocation,
  GeoJSONSource, Layer, ViewAnnotation, Images,
} from '@maplibre/maplibre-react-native'
import type { CameraRef } from '@maplibre/maplibre-react-native'
import { Ionicons } from '@expo/vector-icons'

// Painted map art (assets/map). Textures are tiled by MAP_STYLE fill-patterns;
// the ember is the Wayfarer marker. Icons are drawn at 3x.
const MAP_IMAGES = {
  paper:  require('../assets/map/paper.png'),
  meadow: require('../assets/map/meadow.png'),
  forest: require('../assets/map/forest.png'),
  water:  require('../assets/map/water.png'),
  fog:    require('../assets/map/fog.png'),
  ember:  require('../assets/map/ember.png'),
}
const NODE_ICON: Record<ResourceType, number> = {
  iron:    require('../assets/map/node-iron.png'),
  crystal: require('../assets/map/node-crystal.png'),
  mana:    require('../assets/map/node-mana.png'),
  herbs:   require('../assets/map/node-herbs.png'),
  gold:    require('../assets/map/node-gold.png'),
}
const BANNER_OWN = require('../assets/map/banner-own.png')
const BANNER_RIVAL = require('../assets/map/banner-rival.png')
import * as Location from 'expo-location'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  useStore, selectPlayer, selectResources, selectMyTerritories,
  selectNearbyTerritories, selectNearbyNodes, selectFortress,
} from '@/store/useStore'
import { SystemWindow, Icon } from '@/components/UI'
import { MAP_STYLE } from '@/theme/mapStyle'
import { regionName, stillnessFog } from '@/lib/worldMap'
import {
  COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING,
} from '@/theme/tokens'
import {
  fetchNearbyTerritories, fetchMyTerritories, placeTerritory,
  fetchNearbyNodes, harvestNode, spawnNodesNearTerritory,
  upgradeTerritory, repairTerritory, raidTerritory, captureTerritory,
  fetchBattlePreview,
} from '@/lib/supabase'
import type { Territory, ResourceNode, ResourceType, TraitKey, PlayerResources, Stats, DefenseSlot } from '@/types'
import {
  RESOURCE_LABELS, RESOURCE_ICONS, TERRITORY_PLACE_COST,
  HARVEST_COOLDOWN_H, HARVEST_RANGE_M, ATTACK_RANGE_KM,
  TERRITORY_MAX_LEVEL, unlockedResourceTypes, territoryUpgradeCost,
  territoryRepairCost, territoryDefense,
  STAMINA_COSTS, maxStamina,
} from '@/types'

// Capture unlocks once an enemy territory's HP drops to/below this fraction.
const CAPTURE_HP_THRESHOLD = 0.3

// Render a resource-cost object as a compact label, e.g. "iron 20 · gold 15".
function costLabel(cost: Partial<PlayerResources>): string {
  const parts = Object.entries(cost).filter(([, v]) => (v as number) > 0)
  if (parts.length === 0) return 'free'
  return parts.map(([k, v]) => `${k} ${v}`).join(' · ')
}

// TODO (prod): remove dummy location — require real GPS and show "enable location" screen
const DUMMY_LAT = 37.7749
const DUMMY_LNG = -122.4194

// =============================================================================
// Helpers
// =============================================================================

// MapLibre uses [lng, lat] GeoJSON order throughout
function coord(lat: number, lng: number): [number, number] {
  return [lng, lat]
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function canHarvest(node: ResourceNode): boolean {
  if (!node.last_harvested_at) return true
  const hrs = (Date.now() - new Date(node.last_harvested_at).getTime()) / 3_600_000
  return hrs >= HARVEST_COOLDOWN_H
}

// How far an owned territory extends your interaction reach (metres).
const TERRITORY_REACH_M = 500

// Interaction range check: you can act on a point if you're physically within
// `gpsRangeM` of it (GPS) OR you own a territory within TERRITORY_REACH_M of it.
function inInteractRange(
  targetLat: number, targetLng: number,
  playerLoc: { lat: number; lng: number } | null,
  ownedTerritories: Territory[],
  gpsRangeM: number,
): { ok: boolean; viaTerritory: boolean; distM: number } {
  const distM = playerLoc ? distanceM(playerLoc.lat, playerLoc.lng, targetLat, targetLng) : Infinity
  if (distM <= gpsRangeM) return { ok: true, viaTerritory: false, distM }
  const nearOwn = ownedTerritories.some(
    t => distanceM(t.lat, t.lng, targetLat, targetLng) <= TERRITORY_REACH_M,
  )
  return { ok: nearOwn, viaTerritory: nearOwn, distM }
}

function shieldHoursLeft(t: Territory): number {
  const ms = t.shield_until ? new Date(t.shield_until).getTime() - Date.now() : 0
  return ms > 0 ? Math.ceil(ms / 3_600_000) : 0
}


// =============================================================================
// Influence HUD
// =============================================================================

function InfluenceHUD({ influence, stamina, maxStam }: { influence: number; stamina: number; maxStam: number }) {
  const low = stamina < 15
  return (
    <View style={hud.col}>
      <View style={hud.wrap}>
        <Ionicons name="ribbon" size={15} color={COLORS.systemGold} />
        <Text style={hud.val}>{influence}</Text>
        <Text style={hud.label}>INFLUENCE</Text>
      </View>
      <View style={[hud.wrap, { borderColor: low ? COLORS.warning : COLORS.success }]}>
        <Ionicons name="flash" size={15} color={low ? COLORS.warning : COLORS.success} />
        <Text style={[hud.val, { color: low ? COLORS.warning : COLORS.success }]}>{stamina}<Text style={hud.max}>/{maxStam}</Text></Text>
        <Text style={hud.label}>STAMINA</Text>
      </View>
    </View>
  )
}

const hud = StyleSheet.create({
  col: { position: 'absolute', top: 56, right: 16, gap: 6, zIndex: 10, alignItems: 'flex-end' },
  wrap: {
    backgroundColor: COLORS.surfaceHigh, borderWidth: BORDER.thin,
    borderColor: COLORS.systemGold, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  val: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.systemGold, fontWeight: '700' },
  max: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '400' },
  label: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
})

// =============================================================================
// Territory detail modal
// =============================================================================

interface TerritoryModalProps {
  territory: Territory | null
  playerId: string
  playerStats: Record<string, number>
  resources: PlayerResources
  wallsLevel: number
  defenseSlots: DefenseSlot[]
  // Siege: whether the player is in range to act on this (enemy) territory.
  inRange: boolean
  rangeLabel: string
  // Stamina gating.
  stamina: number
  onSpendStamina: (amount: number) => boolean
  onClose: () => void
  onUpgraded: (t: Territory) => void
  onRepaired: (t: Territory) => void
  onCaptured: (t: Territory) => void
  onRaided: (t: Territory, stolen: Partial<PlayerResources>) => void
  onSpendResources: (cost: Partial<PlayerResources>) => boolean
}

function TerritoryModal({
  territory, playerId, playerStats, resources, wallsLevel, defenseSlots,
  inRange, rangeLabel, stamina, onSpendStamina,
  onClose, onUpgraded, onRepaired, onCaptured, onRaided, onSpendResources,
}: TerritoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  // Server-computed attack vs defense (we can't read the owner's stats or fortress).
  const [preview, setPreview] = useState<{ atk: number; def: number; last_territory: boolean } | null>(null)
  const enemyId = territory && territory.owner_id !== playerId ? territory.id : null

  useEffect(() => {
    setPreview(null)
    if (!enemyId) return
    let active = true
    fetchBattlePreview(enemyId)
      .then(({ data }) => { if (active && data) setPreview(data) })
      .catch(() => null)
    return () => { active = false }
  }, [enemyId])

  if (!territory) return null
  const isOwn = territory.owner_id === playerId

  // Owned-territory stats
  const def = territoryDefense(playerStats as Partial<Stats>, territory.level, wallsLevel, defenseSlots)
  const hpPct = territory.max_health > 0 ? territory.health / territory.max_health : 0
  const unlocked = unlockedResourceTypes(territory.level)
  const nextLevel = territory.level + 1
  const canUpgrade = territory.level < TERRITORY_MAX_LEVEL
  const upgradeCost = territoryUpgradeCost(territory.level)
  const nextUnlock = canUpgrade ? unlockedResourceTypes(nextLevel).filter(t => !unlocked.includes(t)) : []
  const repairCost = territoryRepairCost(territory)
  const needsRepair = territory.health < territory.max_health
  const canAfford = (cost: Partial<PlayerResources>) =>
    Object.entries(cost).every(([k, v]) => (resources[k as keyof PlayerResources] as number) >= (v as number))

  // Pay only after the server accepts, so a failed call never eats resources.
  async function ownerAction(
    cost: Partial<PlayerResources>,
    call: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
    done: (t: Territory) => void,
  ) {
    if (!canAfford(cost)) { Alert.alert('Not enough resources', costLabel(cost)); return }
    setBusy(true)
    try {
      const { data, error } = await call()
      if (error || !data) Alert.alert('Not done', error?.message ?? 'Check your connection.')
      else if (onSpendResources(cost)) done(data as Territory)
    } catch { Alert.alert('Error', 'Check your connection and try again.') }
    setBusy(false)
  }
  const handleUpgrade = () => ownerAction(upgradeCost, () => upgradeTerritory(territory!.id), onUpgraded)
  const handleRepair = () => ownerAction(repairCost, () => repairTerritory(territory!.id), onRepaired)

  // Siege: raid weakens HP (and steals resources); capture is unlocked once HP
  // drops below the threshold. The server decides both; stamina is spent only
  // when it accepts.
  const shieldH = shieldHoursLeft(territory)
  const captureReady = hpPct <= CAPTURE_HP_THRESHOLD && !preview?.last_territory

  async function siege(cost: number, call: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, done: (t: Territory) => void) {
    if (!inRange) { Alert.alert('Out of range', rangeLabel); return }
    if (stamina < cost) { Alert.alert('Not enough stamina', `This costs ${cost} stamina. Run to recharge.`); return }
    setLoading(true)
    try {
      const { data, error } = await call()
      if (error || !data) Alert.alert('Not done', error?.message ?? 'Check your connection.')
      else if (onSpendStamina(cost)) done(data as Territory)
    } catch {
      Alert.alert('Error', 'Check your connection and try again.')
    }
    setLoading(false)
  }

  const handleRaid = () => siege(STAMINA_COSTS.raid, () => raidTerritory(territory!.id), (t) => {
    // Plunder a resource the territory can produce, scaled by level.
    const stealType = unlocked[Math.floor(Math.random() * unlocked.length)] ?? 'iron'
    onRaided(t, { [stealType]: 5 + t.level * 3 })
  })
  const handleCapture = () => siege(STAMINA_COSTS.capture, () => captureTerritory(territory!.id), onCaptured)

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <SystemWindow title={isOwn ? '◆ YOUR TERRITORY' : '◆ ENEMY TERRITORY'} variant={isOwn ? 'gold' : 'alert'}>
            <Text style={modal.name}>{territory.name}</Text>
            <Text style={modal.sub}>
              {territory.owner_username ?? territory.owner_id.slice(0, 8)} · Level {territory.level}
            </Text>

            {/* Owned territory: HP / Defense / resources / upgrade / repair */}
            {isOwn && (
              <>
                {/* HP bar */}
                <View style={tm.statLine}>
                  <Text style={tm.statKey}>INTEGRITY</Text>
                  <Text style={tm.statNum}>{territory.health} / {territory.max_health}</Text>
                </View>
                <View style={tm.hpTrack}>
                  <View style={[tm.hpFill, {
                    width: `${Math.round(hpPct * 100)}%`,
                    backgroundColor: hpPct > 0.5 ? COLORS.success : hpPct > 0.2 ? COLORS.warning : COLORS.error,
                  }]} />
                </View>

                {/* Defense + level row */}
                <View style={tm.dualRow}>
                  <View style={tm.dualCell}>
                    <Text style={tm.statKey}>DEFENSE</Text>
                    <Text style={[tm.statNum, { color: COLORS.system }]}>{def}</Text>
                  </View>
                  <View style={tm.dualCell}>
                    <Text style={tm.statKey}>LEVEL</Text>
                    <Text style={[tm.statNum, { color: COLORS.systemGold }]}>{territory.level} / {TERRITORY_MAX_LEVEL}</Text>
                  </View>
                </View>

                {/* Harvestable resource types at this level */}
                <Text style={tm.sectionLabel}>HARVESTS</Text>
                <View style={tm.chipRow}>
                  {unlocked.map(t => (
                    <View key={t} style={tm.resChip}>
                      <Text style={tm.resChipTxt}><Icon name={RESOURCE_ICONS[t]} size={12} color={COLORS.textSecondary} /> {RESOURCE_LABELS[t]}</Text>
                    </View>
                  ))}
                </View>

                {/* Upgrade */}
                {canUpgrade && (
                  <>
                    {nextUnlock.length > 0 && (
                      <Text style={tm.unlockHint}>
                        → L{nextLevel} unlocks {nextUnlock.map(t => RESOURCE_LABELS[t]).join(', ')}
                      </Text>
                    )}
                    <TouchableOpacity style={tm.upgradeBtn} onPress={handleUpgrade} disabled={busy} activeOpacity={0.75}>
                      {busy ? <ActivityIndicator size="small" color={COLORS.systemGold} />
                        : <Text style={tm.upgradeTxt}><Icon name="triangle" size={12} color={COLORS.systemGold} /> UPGRADE → L{nextLevel}   ({costLabel(upgradeCost)})</Text>}
                    </TouchableOpacity>
                  </>
                )}

                {/* Repair */}
                {needsRepair && (
                  <TouchableOpacity style={tm.repairBtn} onPress={handleRepair} disabled={busy} activeOpacity={0.75}>
                    {busy ? <ActivityIndicator size="small" color={COLORS.success} />
                      : <Text style={tm.repairTxt}><Icon name="wrench" size={12} color={COLORS.success} /> REPAIR   ({costLabel(repairCost)})</Text>}
                  </TouchableOpacity>
                )}
              </>
            )}

            {!isOwn && (
              <>
                {/* Enemy HP — siege progress toward capture */}
                <View style={tm.statLine}>
                  <Text style={tm.statKey}>FORTIFICATION</Text>
                  <Text style={tm.statNum}>{territory.health} / {territory.max_health}</Text>
                </View>
                <View style={tm.hpTrack}>
                  <View style={[tm.hpFill, {
                    width: `${Math.round(hpPct * 100)}%`,
                    backgroundColor: hpPct > 0.5 ? COLORS.error : hpPct > CAPTURE_HP_THRESHOLD ? COLORS.warning : COLORS.success,
                  }]} />
                </View>

                <View style={modal.statRow}>
                  <View style={modal.statBox}>
                    <Text style={modal.statLabel}>YOUR ATK</Text>
                    <Text style={[modal.statVal, { color: COLORS.success }]}>{preview?.atk ?? '–'}</Text>
                  </View>
                  <Text style={modal.vs}>VS</Text>
                  <View style={modal.statBox}>
                    <Text style={modal.statLabel}>DEF</Text>
                    <Text style={[modal.statVal, { color: COLORS.error }]}>{preview?.def ?? '–'}</Text>
                  </View>
                </View>

                {/* Range + shield gates */}
                {!inRange && <Text style={tm.rangeWarn}>⊘ {rangeLabel}</Text>}
                {shieldH > 0 && <Text style={tm.rangeWarn}>⊘ Shielded for {shieldH}h after a recent claim or capture.</Text>}

                {/* Raid — weaken + steal */}
                <TouchableOpacity
                  style={[modal.attackBtn, (!inRange || shieldH > 0 || stamina < STAMINA_COSTS.raid) && tm.disabledBtn]}
                  onPress={handleRaid}
                  disabled={loading || !inRange || shieldH > 0 || stamina < STAMINA_COSTS.raid}
                  activeOpacity={0.75}
                >
                  {loading
                    ? <ActivityIndicator size="small" color={COLORS.systemAlert} />
                    : <Text style={modal.attackTxt}><Icon name="sword-cross" size={13} color={COLORS.systemAlert} /> RAID   ({STAMINA_COSTS.raid} stamina)</Text>}
                </TouchableOpacity>

                {/* Capture — only when weakened enough */}
                {captureReady ? (
                  <TouchableOpacity
                    style={[tm.captureBtn, (!inRange || shieldH > 0 || stamina < STAMINA_COSTS.capture) && tm.disabledBtn]}
                    onPress={handleCapture}
                    disabled={loading || !inRange || shieldH > 0 || stamina < STAMINA_COSTS.capture}
                    activeOpacity={0.75}
                  >
                    <Text style={tm.captureTxt}><Icon name="flag" size={13} color={COLORS.systemGold} /> CAPTURE   ({STAMINA_COSTS.capture} stamina)</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={tm.captureHint}>
                    {preview?.last_territory
                      ? 'Their last territory: it can be raided but not taken.'
                      : `Weaken to ${Math.round(CAPTURE_HP_THRESHOLD * 100)}% to capture`}
                  </Text>
                )}
              </>
            )}

            <TouchableOpacity
              style={modal.closeBtn}
              onPress={onClose}
              activeOpacity={0.75}
            >
              <Text style={modal.closeTxt}>CLOSE</Text>
            </TouchableOpacity>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// =============================================================================
// Node harvest modal
// =============================================================================

interface NodeModalProps {
  node: ResourceNode | null
  playerLat: number; playerLng: number; playerId: string
  inRange: boolean        // GPS-near OR owned territory near
  stamina: number
  onSpendStamina: (amount: number) => boolean
  onHarvest: (nodeId: string, type: string, amount: number) => void
  onClose: () => void
}

function useCooldownLabel(node: ResourceNode | null): string {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!node?.last_harvested_at) return
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [node?.last_harvested_at])

  if (!node?.last_harvested_at) return ''
  const cooldownEnd = new Date(node.last_harvested_at).getTime() + HARVEST_COOLDOWN_H * 3_600_000
  const msLeft = cooldownEnd - Date.now()
  if (msLeft <= 0) return ''
  const hLeft = Math.floor(msLeft / 3_600_000)
  const mLeft = Math.floor((msLeft % 3_600_000) / 60_000)
  return hLeft > 0 ? `${hLeft}h ${mLeft}m remaining` : `${mLeft}m remaining`
}

function NodeModal({ node, playerLat, playerLng, playerId, inRange, stamina, onSpendStamina, onHarvest, onClose }: NodeModalProps) {
  const [loading, setLoading] = useState(false)
  const cooldownLabel = useCooldownLabel(node)
  if (!node) return null

  const dist = Math.round(distanceM(playerLat, playerLng, node.lat, node.lng))
  const ready = canHarvest(node)
  const amount = node.richness * 5
  const hasStamina = stamina >= STAMINA_COSTS.harvest

  async function handleHarvest() {
    if (!onSpendStamina(STAMINA_COSTS.harvest)) {
      Alert.alert('Not enough stamina', `Harvesting costs ${STAMINA_COSTS.harvest} stamina. Run to recharge.`)
      return
    }
    setLoading(true)
    try {
      await harvestNode(node!.id, playerId)
      onHarvest(node!.id, node!.resource_type, amount)
    } catch { /* ignore */ }
    setLoading(false)
    onClose()
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <SystemWindow title="◆ RESOURCE NODE" variant="info">
            <Icon name={RESOURCE_ICONS[node.resource_type as keyof typeof RESOURCE_ICONS] ?? 'rhombus'} size={32} color={COLORS.textPrimary} style={nm.icon} />
            <Text style={nm.name}>{RESOURCE_LABELS[node.resource_type as keyof typeof RESOURCE_LABELS]}</Text>
            <Text style={nm.richness}>{'◆'.repeat(node.richness)}{'◇'.repeat(3 - node.richness)}</Text>
            <Text style={nm.dist}>{dist}m away · {inRange ? <><Icon name="check" size={11} color={COLORS.success} /> In range</> : `Move within ${HARVEST_RANGE_M}m or own a territory nearby`}</Text>
            {!ready && (
              <Text style={nm.cooldown}>
                <Icon name="timer-sand" size={12} color={COLORS.textTertiary} /> {cooldownLabel ? cooldownLabel : `Cooldown active (${HARVEST_COOLDOWN_H}h between harvests)`}
              </Text>
            )}
            {ready && inRange && <Text style={nm.ready}><Icon name="check" size={12} color={COLORS.success} /> READY TO HARVEST</Text>}
            {inRange && ready && (
              <TouchableOpacity
                style={[nm.harvestBtn, !hasStamina && tm.disabledBtn]}
                onPress={handleHarvest}
                disabled={loading || !hasStamina}
                activeOpacity={0.75}
              >
                {loading
                  ? <ActivityIndicator size="small" color={COLORS.system} />
                  : <Text style={nm.harvestTxt}><Icon name="rhombus-medium" size={12} color={COLORS.system} /> HARVEST  +{amount} {node.resource_type}  ({STAMINA_COSTS.harvest} stamina)</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={modal.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={modal.closeTxt}>CLOSE</Text>
            </TouchableOpacity>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// =============================================================================
// Place territory modal
// =============================================================================

function PlaceModal({ visible, cost, onConfirm, onClose }: {
  visible: boolean; cost: number; onConfirm: (name: string) => void; onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <SystemWindow title="◆ CLAIM TERRITORY" variant="gold">
            <Text style={pl.sub}>Plant your banner at the crosshair. Name your new holding.</Text>
            <TextInput
              style={pl.input}
              placeholder="Name your territory..."
              placeholderTextColor={COLORS.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={24}
              autoCapitalize="words"
            />
            <Text style={pl.cost}>Cost: {cost} Influence</Text>
            <TouchableOpacity
              style={[pl.confirmBtn, !name.trim() && { opacity: 0.5 }]}
              onPress={() => { if (name.trim()) { onConfirm(name.trim()); setName('') } }}
              disabled={!name.trim()}
              activeOpacity={0.75}
            >
              <Text style={pl.confirmTxt}>◆ CLAIM ◆</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={modal.closeTxt}>CANCEL</Text>
            </TouchableOpacity>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// =============================================================================
// Shared modal styles
// =============================================================================

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  box: { width: '92%' },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, marginBottom: 2 },
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.md },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
  statVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, fontWeight: '700' },
  vs: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textTertiary },
  probBar: { height: 4, backgroundColor: COLORS.borderMid, borderRadius: 2, marginBottom: 4, overflow: 'hidden' },
  probFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 2 },
  probLabel: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.md },
  attackBtn: { backgroundColor: 'rgba(229,57,53,0.15)', borderWidth: BORDER.thin, borderColor: COLORS.systemAlert, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
  attackTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.systemAlert, letterSpacing: LETTER_SPACING.wide },
  closeBtn: { borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center' },
  closeTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
})

// Owned-territory detail (HP / defense / upgrade / repair)
const tm = StyleSheet.create({
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statKey: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
  statNum: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, fontWeight: '700' },
  hpTrack: { height: 6, backgroundColor: COLORS.borderMid, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.sm },
  hpFill: { height: '100%', borderRadius: 3 },
  dualRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  dualCell: { flex: 1, alignItems: 'center', borderWidth: BORDER.thin, borderColor: COLORS.borderLow, borderRadius: RADIUS.sm, paddingVertical: SPACING.xs },
  sectionLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide, marginBottom: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: SPACING.sm },
  resChip: { borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  resChipTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  unlockHint: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, marginBottom: SPACING.xs },
  upgradeBtn: { backgroundColor: COLORS.systemGoldDim, borderWidth: BORDER.thin, borderColor: COLORS.systemGold, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
  upgradeTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.normal },
  repairBtn: { backgroundColor: 'rgba(61,220,132,0.12)', borderWidth: BORDER.thin, borderColor: COLORS.success, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
  repairTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, color: COLORS.success, letterSpacing: LETTER_SPACING.normal },
  rangeWarn: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.warning, textAlign: 'center', marginBottom: SPACING.sm },
  disabledBtn: { opacity: 0.4 },
  captureBtn: { backgroundColor: COLORS.systemGoldDim, borderWidth: BORDER.thin, borderColor: COLORS.systemGold, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.sm },
  captureTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.wide },
  captureHint: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.xs, marginBottom: SPACING.sm },
})

const nm = StyleSheet.create({
  icon: { fontFamily: FONTS.display, fontSize: 32, textAlign: 'center', marginBottom: SPACING.xs },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 4 },
  richness: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.systemGold, textAlign: 'center', letterSpacing: 4, marginBottom: SPACING.xs },
  dist: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.sm },
  cooldown: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.warning, textAlign: 'center', marginBottom: SPACING.sm },
  ready: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.success, textAlign: 'center', marginBottom: SPACING.sm, letterSpacing: LETTER_SPACING.wide },
  harvestBtn: { backgroundColor: COLORS.systemDim, borderWidth: BORDER.thin, borderColor: COLORS.system, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
  harvestTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.system, letterSpacing: LETTER_SPACING.wide },
})

const pl = StyleSheet.create({
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.md },
  input: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, marginBottom: SPACING.sm,
  },
  cost: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, textAlign: 'center', marginBottom: SPACING.md },
  confirmBtn: {
    backgroundColor: COLORS.systemGoldDim, borderWidth: BORDER.thin, borderColor: COLORS.systemGold,
    borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm,
  },
  confirmTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.wide },
})

// =============================================================================
// Territory pin marker component
// =============================================================================

// Territory marker — a wax-seal / banner medallion that reads on a parchment map.
// Larger hit area (the outer wrap is 48px) for easy tapping.
function TerritoryPin({ mine, label }: { mine: boolean; label?: string }) {
  return (
    <View style={pin.hit}>
      <Image source={mine ? BANNER_OWN : BANNER_RIVAL} style={pin.banner} />
      {label ? (
        <View style={pin.labelWrap}>
          <Text style={pin.label} numberOfLines={1}>{label}</Text>
        </View>
      ) : null}
    </View>
  )
}

const pin = StyleSheet.create({
  hit: { width: 84, alignItems: 'center', paddingTop: 4, paddingBottom: 10 },
  banner: { width: 48, height: 56 },
  labelWrap: {
    marginTop: 2, backgroundColor: 'rgba(40,30,18,0.82)', borderRadius: 3,
    paddingHorizontal: 5, paddingVertical: 1, maxWidth: 84,
  },
  label: { fontFamily: FONTS.mono, fontSize: 9, color: '#f0e4cc', letterSpacing: 0.3 },
})

// Resource node — a painted crystal tinted by type. Glows when ready to harvest.
function NodePin({ node }: { node: ResourceNode }) {
  const ready = canHarvest(node)
  return (
    <View style={nodePin.hit}>
      {ready && <View style={nodePin.glow} />}
      <Image source={NODE_ICON[node.resource_type as ResourceType] ?? NODE_ICON.crystal} style={nodePin.gem} />
      {ready && <View style={nodePin.readyDot} />}
    </View>
  )
}

const nodePin = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  gem: { width: 32, height: 34 },
  glow: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.success, opacity: 0.25 },
  readyDot: { position: 'absolute', top: 4, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, borderWidth: 1, borderColor: '#fff' },
})

// =============================================================================
// Main screen
// =============================================================================

export default function WorldScreen() {
  const player = useStore(selectPlayer)
  const resources = useStore(selectResources)
  const myTerritories = useStore(selectMyTerritories)
  const nearbyTerritories = useStore(selectNearbyTerritories)
  const nearbyNodes = useStore(selectNearbyNodes)
  const fortress = useStore(selectFortress)
  const {
    addInfluence, spendInfluence, addResource, addTrait, spendResources,
    setMyTerritories, addMyTerritory, updateMyTerritory, setNearbyTerritories, setNearbyNodes,
    getStamina, spendStamina,
  } = useStore()
  useStore(s => s.staminaUpdatedAt) // subscribe so stamina re-renders on change
  const stamina = getStamina()

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const fog = useMemo(() => stillnessFog(location), [location])
  const [locError, setLocError] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [selectedNode, setSelectedNode] = useState<ResourceNode | null>(null)
  const [showPlace, setShowPlace] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const cameraRef = useRef<CameraRef>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Live map-center under the crosshair — where CLAIM HERE plants the flag.
  const crosshair = useRef<{ lat: number; lng: number } | null>(null)

  function showNote(msg: string, ms = 4000) {
    if (noteTimer.current) clearTimeout(noteTimer.current)
    setScanNote(msg)
    noteTimer.current = setTimeout(() => setScanNote(null), ms)
  }

  const stats = (player?.stats ?? {}) as Record<string, number>

  // Request permission once on mount — no continuous watcher
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') setLocError(true)
    })
  }, [])

  // Single GPS ping — called on demand (Scan button, Claim button).
  // On Android emulator without a mock location, getCurrentPositionAsync never rejects —
  // it just hangs. We race it against a 6 s timeout then fall back to the last cached fix.
  async function getLocation(): Promise<{ lat: number; lng: number } | null> {
    // Last-known first — returns instantly and picks up emulator mock GPS locations.
    // getCurrentPositionAsync(Accuracy.Low) uses the network provider which ignores mocks.
    try {
      const last = await Location.getLastKnownPositionAsync()
      if (last) return { lat: last.coords.latitude, lng: last.coords.longitude }
    } catch {}
    // Live fix fallback with timeout — uses GPS/Balanced so it sees the mock location
    try {
      const pos = await Promise.race<Location.LocationObject | null>([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
      ])
      if (pos) return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {}
    return null
  }

  // Fetch nearby territories + nodes centred on (lat, lng); returns counts for UI feedback
  const loadMapData = useCallback(async (lat: number, lng: number) => {
    if (!player) return { territories: 0, nodes: 0 }
    try {
      const [nearby, mine, nodes] = await Promise.all([
        fetchNearbyTerritories(lat, lng, ATTACK_RANGE_KM),
        fetchMyTerritories(player.id),
        fetchNearbyNodes(lat, lng, 2),
      ])
      const nearbyList = (nearby.data ?? []) as Territory[]
      const mineList   = (mine.data   ?? []) as Territory[]
      const nodeList   = (nodes.data  ?? []) as ResourceNode[]
      setNearbyTerritories(nearbyList)
      setMyTerritories(mineList)
      setNearbyNodes(nodeList)
      return { territories: nearbyList.length + mineList.length, nodes: nodeList.length }
    } catch {
      return { territories: 0, nodes: 0 }
    }
  }, [player, setNearbyTerritories, setMyTerritories, setNearbyNodes])

  // Scan: grab GPS once, load map data, then centre camera. Real GPS is required
  // — without it we don't drop the player at a fake location (which would pollute
  // the shared map). In dev only, fall back to a fixed coord for emulator testing.
  async function handleScan() {
    if (!player) return
    setScanning(true)
    const loc = await getLocation() ?? (__DEV__ ? { lat: DUMMY_LAT, lng: DUMMY_LNG } : null)
    if (!loc) {
      setScanning(false)
      setLocError(true)
      showNote('Location needed to scan. Enable GPS/location permission and retry.')
      return
    }
    setLocation(loc)
    let result = await loadMapData(loc.lat, loc.lng)
    cameraRef.current?.jumpTo({ center: coord(loc.lat, loc.lng), zoom: 14 })
    addTrait('exploration' as TraitKey, 2)

    // First-run seeding: if the world is empty AND the player owns nothing yet,
    // spawn a FREE starter territory + nodes so a new player always has something
    // to interact with. Online players only (territory lives on the backend).
    const isOffline = player.id.startsWith('offline-')
    const ownsNothing = myTerritories.length === 0
    if (!isOffline && ownsNothing && result.territories === 0 && result.nodes === 0) {
      const seeded = await seedStarterTerritory(loc.lat, loc.lng)
      if (seeded) {
        result = await loadMapData(loc.lat, loc.lng)
        setScanning(false)
        showNote('Starter territory established! Resource nodes spawned nearby.')
        return
      }
    }

    setScanning(false)
    const { territories, nodes } = result ?? { territories: 0, nodes: 0 }
    showNote(
      territories > 0 || nodes > 0
        ? `${territories} territories · ${nodes} nodes found`
        : isOffline
          ? 'Territory needs an online account — sign in to claim.'
          : 'No activity nearby — pan the crosshair and tap CLAIM HERE.'
    )
  }

  // Spawn a free starter territory + nodes at the given location. Returns true on
  // success. No influence cost — this is the new-player onramp.
  async function seedStarterTerritory(lat: number, lng: number): Promise<boolean> {
    if (!player) return false
    try {
      const { data } = await placeTerritory(player.id, lat, lng, `${player.username}'s Outpost`)
      if (!data) return false
      addMyTerritory(data as Territory)
      addTrait('conquest' as TraitKey, 5)
      await spawnNodesNearTerritory(data.id, lat, lng).catch(() => null)
      return true
    } catch {
      return false
    }
  }

  async function handlePlace(name: string) {
    if (!player) return
    if (player.id.startsWith('offline-')) {
      Alert.alert('Online account required', 'Sign in with an account to claim territory.')
      setShowPlace(false)
      return
    }
    // Plant at the crosshair (map center) so placement is deliberate and visible.
    // Requires a real position — never claim at a fake/dummy coord.
    const loc = crosshair.current ?? location
    if (!loc) {
      Alert.alert('Location needed', 'Scan the area first so we know where to plant your banner.')
      setShowPlace(false)
      return
    }

    // Must claim within attack range of where the player actually is — keeps the
    // "go there in real life" premise intact.
    if (location) {
      const distKm = distanceM(location.lat, location.lng, loc.lat, loc.lng) / 1000
      if (distKm > ATTACK_RANGE_KM) {
        Alert.alert('Too far away', `Move the crosshair within ${ATTACK_RANGE_KM} km of your location to claim.`)
        setShowPlace(false)
        return
      }
    }

    if (stamina < STAMINA_COSTS.claim) {
      Alert.alert('Not enough stamina', `Claiming costs ${STAMINA_COSTS.claim} stamina. Run to recharge.`)
      setShowPlace(false)
      return
    }
    setPlacing(true)
    if (!spendInfluence(TERRITORY_PLACE_COST)) {
      Alert.alert('Not enough influence', `You need ${TERRITORY_PLACE_COST} influence to claim territory. Clear rifts to earn influence.`)
      setPlacing(false); setShowPlace(false)
      return
    }
    spendStamina(STAMINA_COSTS.claim)
    setLocation(loc)
    let placed = false
    try {
      const { data } = await placeTerritory(player.id, loc.lat, loc.lng, name)
      if (data) {
        placed = true
        addMyTerritory(data as Territory)
        addTrait('conquest' as TraitKey, 10)
        addTrait('exploration' as TraitKey, 3)
        await spawnNodesNearTerritory(data.id, loc.lat, loc.lng).catch(() => null)
        await loadMapData(loc.lat, loc.lng)
        showNote('Territory claimed! Resource nodes spawned nearby.')
      } else {
        addInfluence(TERRITORY_PLACE_COST)
        Alert.alert('Error', 'Could not claim territory. Influence refunded.')
      }
    } catch {
      if (!placed) {
        addInfluence(TERRITORY_PLACE_COST)
        Alert.alert('Error', 'Could not claim territory. Influence refunded.')
      }
    }
    setPlacing(false)
    setShowPlace(false)
  }

  function handleHarvestDone(nodeId: string, type: string, amount: number) {
    addResource(type as ResourceType, amount)
    addTrait('gathering' as TraitKey, 5)
    setNearbyNodes(nearbyNodes.map(n =>
      n.id === nodeId ? { ...n, last_harvested_at: new Date().toISOString(), last_harvested_by: player!.id } : n
    ))
  }

  const myIds = new Set(myTerritories.map(t => t.id))
  const enemyTerritories = nearbyTerritories.filter(t => !myIds.has(t.id))

  const mapCenter = location ?? { lat: DUMMY_LAT, lng: DUMMY_LNG }

  // Restrict panning to ~5 km radius around the player.
  // No bounds before first scan so the map can initialise without jumping.
  const MAP_BOUND_DEG = 0.045  // ≈ 5 km
  // LngLatBounds = [west, south, east, north]
  const mapBounds = location
    ? [
        location.lng - MAP_BOUND_DEG,
        location.lat - MAP_BOUND_DEG,
        location.lng + MAP_BOUND_DEG,
        location.lat + MAP_BOUND_DEG,
      ] as [number, number, number, number]
    : undefined

  if (locError) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <SystemWindow title="LOCATION REQUIRED" variant="alert">
            <Text style={styles.errorTxt}>
              Aeternum needs location access to show the world map.{'\n'}
              Enable it in your device settings.
            </Text>
          </SystemWindow>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.root}>
      {/* Influence HUD */}
      <InfluenceHUD influence={resources.influence} stamina={stamina} maxStam={maxStamina(stats.END ?? 0)} />
      {location && (
        <View style={styles.regionWrap} pointerEvents="none">
          <Text style={styles.regionSmall}>YOU WALK IN</Text>
          <Text style={styles.regionName}>{regionName(location.lat, location.lng)}</Text>
        </View>
      )}

      {/* Map always mounted — GL context initializes immediately, no cold-start on SCAN */}
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE as any}
        androidView="texture"
        onRegionDidChange={(e) => {
          // center is [lng, lat]; store it as the crosshair claim target.
          const c = e.nativeEvent?.center
          if (c) crosshair.current = { lat: c[1], lng: c[0] }
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: coord(mapCenter.lat, mapCenter.lng), zoom: 14 }}
          minZoom={12}
          maxZoom={18}
          {...(mapBounds ? { maxBounds: mapBounds } : {})}
        />
        <Images images={MAP_IMAGES} />

        {/* The Stillness: fog over everything beyond the last scan. Rendered
            before the Wayfarer marker so the ember stays on top. */}
        <GeoJSONSource id="stillness" data={fog}>
          <Layer
            id="stillness-fog"
            type="fill"
            style={{ fillPattern: 'fog', fillOpacity: ['get', 'opacity'] }}
          />
        </GeoJSONSource>

        {/* The Wayfarer: an ember instead of the default blue dot. */}
        <UserLocation>
          <Layer
            id="wayfarer-glow"
            type="circle"
            source="mlrn-user-location"
            style={{ circleRadius: 16, circleColor: '#e8833a', circleOpacity: 0.25, circleBlur: 0.6 }}
          />
          <Layer
            id="wayfarer-ember"
            type="symbol"
            source="mlrn-user-location"
            style={{ iconImage: 'ember', iconSize: 0.34, iconAnchor: 'bottom', iconAllowOverlap: true }}
          />
        </UserLocation>

        {location && (
          <>
            {/* Harvest range circle around player */}
            <GeoJSONSource
              id="harvest-range"
              data={{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: coord(location.lat, location.lng) },
                properties: {},
              }}
            >
              <Layer
                id="harvest-range-circle"
                type="circle"
                style={{
                  circleRadius: ['interpolate', ['exponential', 2], ['zoom'], 10, 1, 20, HARVEST_RANGE_M / 0.075],
                  circleColor: '#3f7d4f',
                  circleOpacity: 0.10,
                  circleStrokeWidth: 1.5,
                  circleStrokeColor: '#2f5d3a',
                  circleStrokeOpacity: 0.45,
                }}
              />
            </GeoJSONSource>

            {/* Attack range circle — shows enemy territory reach */}
            <GeoJSONSource
              id="attack-range"
              data={{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: coord(location.lat, location.lng) },
                properties: {},
              }}
            >
              <Layer
                id="attack-range-circle"
                type="circle"
                style={{
                  circleRadius: ['interpolate', ['exponential', 2], ['zoom'], 10, 1, 20, (ATTACK_RANGE_KM * 1000) / 0.075],
                  circleColor: COLORS.systemAlert,
                  circleOpacity: 0.04,
                  circleStrokeWidth: 1,
                  circleStrokeColor: COLORS.systemAlert,
                  circleStrokeOpacity: 0.2,
                }}
              />
            </GeoJSONSource>

            {/* Own territory markers — warm seal.
                ViewAnnotation needs a unique `id` and handles the tap via its
                OWN onPress (the native annotation view swallows inner touches). */}
            {myTerritories.map(t => (
              <ViewAnnotation key={t.id} id={`terr-${t.id}`} lngLat={coord(t.lat, t.lng)} onPress={() => setSelectedTerritory(t)}>
                <TerritoryPin mine label={t.name} />
              </ViewAnnotation>
            ))}

            {/* Enemy territory markers — crimson seal */}
            {enemyTerritories.map(t => (
              <ViewAnnotation key={t.id} id={`terr-${t.id}`} lngLat={coord(t.lat, t.lng)} onPress={() => setSelectedTerritory(t)}>
                <TerritoryPin mine={false} label={t.name} />
              </ViewAnnotation>
            ))}

            {/* Resource node markers */}
            {nearbyNodes.map(n => (
              <ViewAnnotation key={n.id} id={`node-${n.id}`} lngLat={coord(n.lat, n.lng)} onPress={() => setSelectedNode(n)}>
                <NodePin node={n} />
              </ViewAnnotation>
            ))}
          </>
        )}
      </MapLibreMap>

      {/* Placement crosshair — fixed at screen center. Pan the map under it and
          tap CLAIM to plant a banner exactly here. Non-interactive overlay. */}
      {location && (
        <View style={styles.crosshairWrap} pointerEvents="none">
          <View style={styles.crosshairRing}>
            <Ionicons name="flag" size={16} color="#5a3f1e" />
          </View>
          <View style={styles.crosshairStem} />
          <View style={styles.crosshairDot} />
        </View>
      )}

      {/* Pre-scan prompt — overlaid on map until first GPS fix */}
      {!location && (
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanPromptCard}>
            <Ionicons name="compass-outline" size={40} color="#6b5333" />
            <Text style={styles.scanPromptTxt}>Tap SCAN to chart the lands around you</Text>
          </View>
        </View>
      )}

      {/* Scan result / status note */}
      {scanNote && (
        <View style={styles.noteBar} pointerEvents="none">
          <Text style={styles.noteTxt}>{scanNote}</Text>
        </View>
      )}

      {/* Bottom action bar */}
      <View style={styles.bottomRow}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={handleScan}
          disabled={scanning}
          activeOpacity={0.85}
        >
          {scanning
            ? <ActivityIndicator size="small" color="#f0e4cc" />
            : (
              <>
                <Ionicons name="scan-outline" size={18} color="#f0e4cc" />
                <Text style={styles.scanTxt}>SCAN</Text>
              </>
            )}
        </TouchableOpacity>

        {/* Claim — only after scan; plants a banner at the crosshair */}
        {location && (
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => setShowPlace(true)}
            disabled={placing}
            activeOpacity={0.85}
          >
            {placing
              ? <ActivityIndicator size="small" color="#2a1c08" />
              : (
                <>
                  <Ionicons name="flag" size={18} color="#2a1c08" />
                  <Text style={styles.claimTxt}>CLAIM</Text>
                  <View style={styles.claimCostPill}>
                    <Ionicons name="ribbon" size={10} color="#2a1c08" />
                    <Text style={styles.claimCost}>{TERRITORY_PLACE_COST}</Text>
                  </View>
                </>
              )}
          </TouchableOpacity>
        )}
      </View>

      <TerritoryModal
        territory={selectedTerritory}
        playerId={player?.id ?? ''}
        playerStats={stats}
        resources={resources}
        wallsLevel={fortress.walls_level}
        defenseSlots={fortress.defense_slots ?? []}
        inRange={selectedTerritory ? inInteractRange(selectedTerritory.lat, selectedTerritory.lng, location, myTerritories, ATTACK_RANGE_KM * 1000).ok : false}
        rangeLabel={`Move within ${ATTACK_RANGE_KM} km, or own a territory nearby.`}
        stamina={stamina}
        onSpendStamina={spendStamina}
        onClose={() => setSelectedTerritory(null)}
        onUpgraded={(t) => { updateMyTerritory(t); setSelectedTerritory(t) }}
        onRepaired={(t) => { updateMyTerritory(t); setSelectedTerritory(t) }}
        onCaptured={(t) => {
          // Moves from enemy list to owned; refresh map.
          addMyTerritory(t)
          if (location) loadMapData(location.lat, location.lng)
          setSelectedTerritory(null)
          showNote('Territory captured! It and its nodes are now yours. Shielded for 12h.')
        }}
        onRaided={(t, stolen) => {
          setNearbyTerritories(nearbyTerritories.map(x => x.id === t.id ? t : x))
          setSelectedTerritory(t)
          for (const [k, v] of Object.entries(stolen)) addResource(k as ResourceType, v as number)
          showNote('Raid successful — resources plundered, fortification weakened.')
        }}
        onSpendResources={spendResources}
      />
      <NodeModal
        node={selectedNode}
        playerLat={location?.lat ?? 0}
        playerLng={location?.lng ?? 0}
        playerId={player?.id ?? ''}
        inRange={selectedNode ? inInteractRange(selectedNode.lat, selectedNode.lng, location, myTerritories, HARVEST_RANGE_M).ok : false}
        stamina={stamina}
        onSpendStamina={spendStamina}
        onHarvest={handleHarvestDone}
        onClose={() => setSelectedNode(null)}
      />
      <PlaceModal
        visible={showPlace}
        cost={TERRITORY_PLACE_COST}
        onConfirm={handlePlace}
        onClose={() => setShowPlace(false)}
      />
    </View>
  )
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  regionWrap: {
    position: 'absolute', top: 56, left: 16, zIndex: 10, alignItems: 'center',
    backgroundColor: 'rgba(28,21,14,0.88)', borderWidth: 1, borderColor: '#8a6a43',
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  regionSmall: { fontFamily: FONTS.mono, fontSize: 8, color: '#c9b38c', letterSpacing: LETTER_SPACING.wide },
  regionName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: '#f6e7c6', letterSpacing: 1 },
  crosshairWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  crosshairRing: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: '#d4af52',
    backgroundColor: 'rgba(233,220,195,0.85)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  crosshairStem: { width: 2, height: 14, backgroundColor: '#d4af52', marginTop: -1 },
  crosshairDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a23b34', marginTop: -2 },
  errorTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 18 },
  scanPromptCard: {
    alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(233,220,195,0.9)', borderWidth: 1.5, borderColor: '#c2a878',
    borderRadius: RADIUS.md, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
  },
  scanPromptTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: '#5a3f1e', textAlign: 'center' },
  scanOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  bottomRow: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center',
  },
  scanBtn: {
    flex: 1, flexDirection: 'row', gap: 8,
    backgroundColor: '#3a2c18', borderWidth: 1.5, borderColor: '#5a3f1e', borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  scanTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: '#f0e4cc', letterSpacing: LETTER_SPACING.wide },
  claimBtn: {
    flex: 1, flexDirection: 'row', gap: 8,
    backgroundColor: '#d4af52', borderWidth: 1.5, borderColor: '#b8923a', borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  claimTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: '#2a1c08', letterSpacing: LETTER_SPACING.wide },
  claimCostPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(42,28,8,0.15)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  claimCost: { fontFamily: FONTS.mono, fontSize: 11, color: '#2a1c08', fontWeight: '700' },
  noteBar: {
    position: 'absolute', bottom: 96, left: 16, right: 16,
    backgroundColor: 'rgba(8,11,19,0.88)',
    borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  noteTxt: {
    fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs,
    color: COLORS.textPrimary, textAlign: 'center', letterSpacing: LETTER_SPACING.wide,
  },
})
