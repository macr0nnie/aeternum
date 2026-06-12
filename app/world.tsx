// =============================================================================
// Aeternum — World Map Screen
// MapLibre + OpenStreetMap (CARTO Dark Matter — free, no API key)
// Claim territories · Attack enemies · Harvest resource nodes
// =============================================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  Alert, ActivityIndicator,
} from 'react-native'
import {
  Map as MapLibreMap, Camera, UserLocation,
  GeoJSONSource, Layer, ViewAnnotation,
} from '@maplibre/maplibre-react-native'
import type { CameraRef } from '@maplibre/maplibre-react-native'
import * as Location from 'expo-location'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  useStore, selectPlayer, selectResources, selectMyTerritories,
  selectNearbyTerritories, selectNearbyNodes,
} from '@/store/useStore'
import { SystemWindow } from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, elementAccent,
} from '@/theme/tokens'
import {
  fetchNearbyTerritories, fetchMyTerritories, placeTerritory,
  fetchNearbyNodes, harvestNode, attackTerritory, spawnNodesNearTerritory,
} from '@/lib/supabase'
import type { Territory, ResourceNode, Element, ResourceType } from '@/types'
import {
  RESOURCE_LABELS, RESOURCE_ICONS, TERRITORY_PLACE_COST,
  HARVEST_COOLDOWN_H, HARVEST_RANGE_M, ATTACK_RANGE_KM,
} from '@/types'

// Free dark basemap — no-labels variant keeps the game elements as the visual focus
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

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

function attackPower(stats: Record<string, number>): number {
  return (stats.ATK ?? 0) * 2 + (stats.SPD ?? 0) + Math.round((stats.LCK ?? 0) * 0.5)
}

function defencePower(stats: Record<string, number>, territory: Territory): number {
  return (stats.DEF ?? 0) * 2 + (stats.END ?? 0) + territory.level * 8
}

function resolveAttack(atkPow: number, defPow: number): 'win' | 'loss' {
  const winChance = Math.min(0.9, Math.max(0.1, atkPow / (atkPow + defPow)))
  return Math.random() < winChance ? 'win' : 'loss'
}

// =============================================================================
// Influence HUD
// =============================================================================

function InfluenceHUD({ influence }: { influence: number }) {
  return (
    <View style={hud.wrap}>
      <Text style={hud.icon}>◆</Text>
      <Text style={hud.val}>{influence}</Text>
      <Text style={hud.label}>INFLUENCE</Text>
    </View>
  )
}

const hud = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 56, right: 16,
    backgroundColor: COLORS.surfaceHigh, borderWidth: BORDER.thin,
    borderColor: COLORS.systemGold, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10,
  },
  icon: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.systemGold },
  val: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.systemGold, fontWeight: '700' },
  label: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
})

// =============================================================================
// Territory detail modal
// =============================================================================

interface TerritoryModalProps {
  territory: Territory | null
  playerId: string
  playerStats: Record<string, number>
  onClose: () => void
  onAttackDone: () => void
}

function TerritoryModal({ territory, playerId, playerStats, onClose, onAttackDone }: TerritoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ outcome: 'win' | 'loss'; atkPow: number; defPow: number } | null>(null)

  if (!territory) return null
  const isOwn = territory.owner_id === playerId
  const atkPow = attackPower(playerStats)
  const defPow = defencePower(playerStats, territory)
  const winChance = Math.round(Math.min(90, Math.max(10, (atkPow / (atkPow + defPow)) * 100)))

  async function handleAttack() {
    setLoading(true)
    try {
      const outcome = resolveAttack(atkPow, defPow)
      await attackTerritory(playerId, territory!.owner_id, territory!.id, atkPow, defPow, outcome)
      setResult({ outcome, atkPow, defPow })
    } catch {
      Alert.alert('Error', 'Attack failed. Check your connection and try again.')
    }
    setLoading(false)
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <SystemWindow title={isOwn ? '◆ YOUR TERRITORY' : '◆ ENEMY TERRITORY'} variant={isOwn ? 'gold' : 'alert'}>
            <Text style={modal.name}>{territory.name}</Text>
            <Text style={modal.sub}>
              {territory.owner_username ?? territory.owner_id.slice(0, 8)} · Level {territory.level}
            </Text>

            {!isOwn && !result && (
              <>
                <View style={modal.statRow}>
                  <View style={modal.statBox}>
                    <Text style={modal.statLabel}>YOUR ATK</Text>
                    <Text style={[modal.statVal, { color: COLORS.success }]}>{atkPow}</Text>
                  </View>
                  <Text style={modal.vs}>VS</Text>
                  <View style={modal.statBox}>
                    <Text style={modal.statLabel}>DEF</Text>
                    <Text style={[modal.statVal, { color: COLORS.error }]}>{defPow}</Text>
                  </View>
                </View>
                <View style={modal.probBar}>
                  <View style={[modal.probFill, { width: `${winChance}%` }]} />
                </View>
                <Text style={modal.probLabel}>{winChance}% WIN CHANCE</Text>
                <TouchableOpacity style={modal.attackBtn} onPress={handleAttack} disabled={loading} activeOpacity={0.75}>
                  {loading
                    ? <ActivityIndicator size="small" color={COLORS.systemAlert} />
                    : <Text style={modal.attackTxt}>⚔  ATTACK</Text>}
                </TouchableOpacity>
              </>
            )}

            {result && (
              <View style={modal.resultBox}>
                <Text style={[modal.resultTxt, { color: result.outcome === 'win' ? COLORS.success : COLORS.error }]}>
                  {result.outcome === 'win' ? '◆ TERRITORY CAPTURED' : '◈ ATTACK REPELLED'}
                </Text>
                <Text style={modal.resultSub}>ATK {result.atkPow} vs DEF {result.defPow}</Text>
              </View>
            )}

            <TouchableOpacity
              style={modal.closeBtn}
              onPress={() => { if (result?.outcome === 'win') onAttackDone(); onClose() }}
              activeOpacity={0.75}
            >
              <Text style={modal.closeTxt}>{result ? 'DONE' : 'CLOSE'}</Text>
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

function NodeModal({ node, playerLat, playerLng, playerId, onHarvest, onClose }: NodeModalProps) {
  const [loading, setLoading] = useState(false)
  const cooldownLabel = useCooldownLabel(node)
  if (!node) return null

  const dist = Math.round(distanceM(playerLat, playerLng, node.lat, node.lng))
  const inRange = dist <= HARVEST_RANGE_M
  const ready = canHarvest(node)
  const amount = node.richness * 5

  async function handleHarvest() {
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
            <Text style={nm.icon}>{RESOURCE_ICONS[node.resource_type as keyof typeof RESOURCE_ICONS] ?? '◈'}</Text>
            <Text style={nm.name}>{RESOURCE_LABELS[node.resource_type as keyof typeof RESOURCE_LABELS]}</Text>
            <Text style={nm.richness}>{'◆'.repeat(node.richness)}{'◇'.repeat(3 - node.richness)}</Text>
            <Text style={nm.dist}>{dist}m away · {inRange ? '✓ In range' : `Move within ${HARVEST_RANGE_M}m`}</Text>
            {!ready && (
              <Text style={nm.cooldown}>
                {cooldownLabel ? `⏱ ${cooldownLabel}` : `⏱ Cooldown active (${HARVEST_COOLDOWN_H}h between harvests)`}
              </Text>
            )}
            {ready && <Text style={nm.ready}>✓ READY TO HARVEST</Text>}
            {inRange && ready && (
              <TouchableOpacity style={nm.harvestBtn} onPress={handleHarvest} disabled={loading} activeOpacity={0.75}>
                {loading
                  ? <ActivityIndicator size="small" color={COLORS.system} />
                  : <Text style={nm.harvestTxt}>◆ HARVEST  +{amount} {node.resource_type}</Text>}
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
            <Text style={pl.sub}>Plant your flag at your current GPS position.</Text>
            <TextInput
              style={pl.input}
              placeholder="Territory name..."
              placeholderTextColor={COLORS.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={24}
              autoCapitalize="words"
            />
            <Text style={pl.cost}>Cost: ◆ {cost} Influence</Text>
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
  resultBox: { alignItems: 'center', paddingVertical: SPACING.md },
  resultTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: LETTER_SPACING.normal, marginBottom: 4 },
  resultSub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  closeBtn: { borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, alignItems: 'center' },
  closeTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
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

function TerritoryPin({ color, borderColor }: { color: string; borderColor: string }) {
  return (
    <View style={[pin.wrap, { backgroundColor: color, borderColor }]}>
      <Text style={pin.icon}>⚑</Text>
    </View>
  )
}

const pin = StyleSheet.create({
  wrap: { width: 32, height: 32, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16, color: '#fff' },
})

function NodePin({ node }: { node: ResourceNode }) {
  const ready = canHarvest(node)
  return (
    <View style={[nodePin.wrap, ready && nodePin.ready]}>
      <Text style={nodePin.icon}>{RESOURCE_ICONS[node.resource_type as keyof typeof RESOURCE_ICONS] ?? '◈'}</Text>
    </View>
  )
}

const nodePin = StyleSheet.create({
  wrap: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.borderMid, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  ready: { borderColor: COLORS.success, backgroundColor: COLORS.surfaceHigh },
  icon: { fontSize: 14 },
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
  const {
    addInfluence, spendInfluence, addResource,
    setMyTerritories, addMyTerritory, setNearbyTerritories, setNearbyNodes,
  } = useStore()

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locError, setLocError] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [selectedNode, setSelectedNode] = useState<ResourceNode | null>(null)
  const [showPlace, setShowPlace] = useState(false)
  const [placing, setPlacing] = useState(false)
  const cameraRef = useRef<CameraRef>(null)

  const element = player?.primary_element as Element | null
  const palette = elementAccent(element)
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
    try {
      const pos = await Promise.race<Location.LocationObject | null>([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 6000)),
      ])
      if (pos) return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {}
    // Last-known fallback — works on emulator that previously had a mock location set
    try {
      const last = await Location.getLastKnownPositionAsync()
      if (last) return { lat: last.coords.latitude, lng: last.coords.longitude }
    } catch {}
    return null
  }

  // Fetch nearby territories + nodes centred on (lat, lng)
  const loadMapData = useCallback(async (lat: number, lng: number) => {
    if (!player) return
    const [nearby, mine, nodes] = await Promise.all([
      fetchNearbyTerritories(lat, lng, ATTACK_RANGE_KM),
      fetchMyTerritories(player.id),
      fetchNearbyNodes(lat, lng, 2),
    ])
    setNearbyTerritories((nearby.data ?? []) as Territory[])
    setMyTerritories((mine.data ?? []) as Territory[])
    setNearbyNodes((nodes.data ?? []) as ResourceNode[])
  }, [player, setNearbyTerritories, setMyTerritories, setNearbyNodes])

  // Scan: grab GPS once, load map data, then centre camera
  async function handleScan() {
    setScanning(true)
    const loc = await getLocation()
    if (loc) {
      setLocation(loc)
      await loadMapData(loc.lat, loc.lng)
      cameraRef.current?.jumpTo({ center: coord(loc.lat, loc.lng), zoom: 13 })
    } else {
      Alert.alert('Location Unavailable', 'Could not get your position. On an emulator, set a mock location via Extended Controls → Location.')
    }
    setScanning(false)
  }

  async function handlePlace(name: string) {
    if (!player) return
    setPlacing(true)
    // Resolve GPS before spending anything — nothing to refund if location fails
    const loc = await getLocation()
    if (!loc) {
      Alert.alert('Error', 'Could not get your location. Try again.')
      setPlacing(false); setShowPlace(false)
      return
    }
    if (!spendInfluence(TERRITORY_PLACE_COST)) {
      Alert.alert('Not enough influence', `You need ${TERRITORY_PLACE_COST} influence to claim territory.`)
      setPlacing(false); setShowPlace(false)
      return
    }
    setLocation(loc)
    let placed = false
    try {
      const { data } = await placeTerritory(player.id, loc.lat, loc.lng, name)
      if (data) {
        placed = true
        addMyTerritory(data as Territory)
        // Node spawning is non-critical — don't block on its failure
        await spawnNodesNearTerritory(data.id, loc.lat, loc.lng).catch(() => null)
        await loadMapData(loc.lat, loc.lng)
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
    setNearbyNodes(nearbyNodes.map(n =>
      n.id === nodeId ? { ...n, last_harvested_at: new Date().toISOString(), last_harvested_by: player!.id } : n
    ))
  }

  const myIds = new Set(myTerritories.map(t => t.id))
  const enemyTerritories = nearbyTerritories.filter(t => !myIds.has(t.id))
  // Fallback center keeps map warm before first scan; real coords overwrite on SCAN
  const mapCenter = location ?? { lat: 37.7749, lng: -122.4194 }

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
      <InfluenceHUD influence={resources.influence} />

      {/* Map always mounted — GL context initializes immediately, no cold-start on SCAN */}
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: coord(mapCenter.lat, mapCenter.lng), zoom: 13 }}
        />
        <UserLocation />

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
                  circleColor: palette.base,
                  circleOpacity: 0.08,
                  circleStrokeWidth: 1,
                  circleStrokeColor: palette.base,
                  circleStrokeOpacity: 0.35,
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

            {/* Own territory markers */}
            {myTerritories.map(t => (
              <ViewAnnotation key={t.id} lngLat={coord(t.lat, t.lng)}>
                <TouchableOpacity onPress={() => setSelectedTerritory(t)} activeOpacity={0.85}>
                  <TerritoryPin color={palette.base} borderColor={palette.bright} />
                </TouchableOpacity>
              </ViewAnnotation>
            ))}

            {/* Enemy territory markers */}
            {enemyTerritories.map(t => (
              <ViewAnnotation key={t.id} lngLat={coord(t.lat, t.lng)}>
                <TouchableOpacity onPress={() => setSelectedTerritory(t)} activeOpacity={0.85}>
                  <TerritoryPin color={COLORS.systemAlert} borderColor={COLORS.error} />
                </TouchableOpacity>
              </ViewAnnotation>
            ))}

            {/* Resource node markers */}
            {nearbyNodes.map(n => (
              <ViewAnnotation key={n.id} lngLat={coord(n.lat, n.lng)}>
                <TouchableOpacity onPress={() => setSelectedNode(n)} activeOpacity={0.85}>
                  <NodePin node={n} />
                </TouchableOpacity>
              </ViewAnnotation>
            ))}
          </>
        )}
      </MapLibreMap>

      {/* Pre-scan prompt — overlaid on map until first GPS fix */}
      {!location && (
        <View style={styles.scanOverlay} pointerEvents="none">
          <Text style={styles.scanPromptIcon}>◎</Text>
          <Text style={styles.scanPromptTxt}>Press SCAN AREA to load the world map</Text>
        </View>
      )}

      {/* Bottom action buttons */}
      <View style={styles.bottomRow}>
        {/* Scan — primary action, grabs GPS once */}
        <TouchableOpacity
          style={[styles.scanBtn, { borderColor: palette.base, backgroundColor: palette.dim }]}
          onPress={handleScan}
          disabled={scanning}
          activeOpacity={0.75}
        >
          {scanning
            ? <ActivityIndicator size="small" color={palette.base} />
            : <Text style={[styles.scanTxt, { color: palette.base }]}>◎  SCAN AREA</Text>}
        </TouchableOpacity>

        {/* Claim — only after scan */}
        {location && (
          <TouchableOpacity
            style={[styles.claimBtn, { borderColor: COLORS.systemGold, backgroundColor: COLORS.systemGoldDim }]}
            onPress={() => Alert.alert(
              'Claim Territory',
              `Place a territory here? Costs ◆ ${TERRITORY_PLACE_COST} Influence.`,
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Claim', onPress: () => setShowPlace(true) }]
            )}
            disabled={placing}
            activeOpacity={0.75}
          >
            {placing
              ? <ActivityIndicator size="small" color={COLORS.systemGold} />
              : <Text style={styles.claimTxt}>⚑  CLAIM</Text>}
          </TouchableOpacity>
        )}
      </View>

      <TerritoryModal
        territory={selectedTerritory}
        playerId={player?.id ?? ''}
        playerStats={stats}
        onClose={() => setSelectedTerritory(null)}
        onAttackDone={() => { if (location) loadMapData(location.lat, location.lng) }}
      />
      <NodeModal
        node={selectedNode}
        playerLat={location?.lat ?? 0}
        playerLng={location?.lng ?? 0}
        playerId={player?.id ?? ''}
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
  errorTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 18 },
  scanPromptIcon: { fontFamily: FONTS.display, fontSize: 40, color: COLORS.textTertiary, marginBottom: SPACING.sm },
  scanPromptTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center' },
  scanOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  bottomRow: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center',
  },
  scanBtn: {
    flex: 1, borderWidth: BORDER.thick, borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm, alignItems: 'center',
  },
  scanTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, letterSpacing: LETTER_SPACING.wide },
  claimBtn: {
    borderWidth: BORDER.thick, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, alignItems: 'center',
  },
  claimTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.wide },
})
