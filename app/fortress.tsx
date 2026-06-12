// =============================================================================
// Aeternum — Fortress Screen (Main Base)
// Upgrade buildings · Manage resources · View territories
// =============================================================================
import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  useStore, selectPlayer, selectResources, selectFortress, selectMyTerritories,
} from '@/store/useStore'
import { SystemWindow, SectionHeader } from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, elementAccent,
} from '@/theme/tokens'
import { fetchPlayerResources, upsertPlayerResources, fetchFortress, upsertFortress, fetchMyTerritories } from '@/lib/supabase'
import {
  FORTRESS_BUILDINGS, RESOURCE_ICONS,
  type FortressBuilding, type Fortress, type PlayerResources, type ResourceType,
} from '@/types'
import type { Element, Territory } from '@/types'

// =============================================================================
// Resource display
// =============================================================================

function ResourceBar() {
  const resources = useStore(selectResources)
  const types: ResourceType[] = ['iron', 'crystal', 'mana', 'herbs', 'gold']
  return (
    <View style={res.row}>
      <View style={res.influence}>
        <Text style={res.influenceVal}>{resources.influence}</Text>
        <Text style={res.influenceLabel}>◆ INFLUENCE</Text>
      </View>
      <View style={res.divider} />
      {types.map(t => (
        <View key={t} style={res.chip}>
          <Text style={res.chipIcon}>{RESOURCE_ICONS[t]}</Text>
          <Text style={res.chipVal}>{resources[t]}</Text>
          <Text style={res.chipLabel}>{t.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  )
}

const res = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight, padding: SPACING.sm, gap: SPACING.xs, marginBottom: SPACING.md,
  },
  influence: { alignItems: 'center', paddingHorizontal: SPACING.xs },
  influenceVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.systemGold },
  influenceLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.wide },
  divider: { width: 1, height: 32, backgroundColor: COLORS.borderMid, marginHorizontal: SPACING.xs },
  chip: { alignItems: 'center', minWidth: 40 },
  chipIcon: { fontSize: 14, marginBottom: 1 },
  chipVal: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textPrimary, fontWeight: '700' },
  chipLabel: { fontFamily: FONTS.mono, fontSize: 7, color: COLORS.textTertiary, letterSpacing: 1 },
})

// =============================================================================
// Building card
// =============================================================================

interface BuildingCardProps {
  building: FortressBuilding
  currentLevel: number
  resources: PlayerResources
  upgrading: boolean
  onUpgrade: (key: keyof Omit<Fortress, 'level'>) => void
}

function BuildingCard({ building, currentLevel, resources, upgrading, onUpgrade }: BuildingCardProps) {
  const cost = building.upgradeCost(currentLevel + 1)
  const atMax = currentLevel >= building.maxLevel
  const canAfford = atMax ? false : Object.entries(cost).every(
    ([k, v]) => (resources[k as keyof PlayerResources] as number) >= (v as number)
  )

  return (
    <View style={[bld.card, upgrading && bld.cardUpgrading]}>
      <View style={bld.header}>
        <Text style={bld.icon}>{building.icon}</Text>
        <View style={bld.info}>
          <Text style={bld.name}>{building.name}</Text>
          <Text style={bld.desc}>{building.description}</Text>
        </View>
        <View style={bld.levelWrap}>
          <Text style={bld.levelVal}>{currentLevel}</Text>
          <Text style={bld.levelLabel}>/ {building.maxLevel}</Text>
        </View>
      </View>

      {/* Level bar */}
      <View style={bld.barTrack}>
        <View style={[bld.barFill, { width: `${(currentLevel / building.maxLevel) * 100}%` }]} />
      </View>

      <Text style={bld.bonus}>{building.statBonus}</Text>

      {!atMax && (
        <View style={bld.upgradeRow}>
          <View style={bld.costRow}>
            {Object.entries(cost).map(([k, v]) => (
              <View key={k} style={bld.costChip}>
                <Text style={bld.costIcon}>{RESOURCE_ICONS[k as ResourceType] ?? k}</Text>
                <Text style={[bld.costVal, { color: (resources[k as keyof PlayerResources] as number) >= (v as number) ? COLORS.success : COLORS.error }]}>
                  {v as number}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[bld.upgradeBtn, (!canAfford || upgrading) && bld.upgradeBtnDisabled]}
            onPress={() => onUpgrade(building.key)}
            disabled={!canAfford || upgrading}
            activeOpacity={0.75}
          >
            <Text style={[bld.upgradeTxt, (!canAfford || upgrading) && { color: COLORS.textTertiary }]}>
              {upgrading ? 'UPGRADING...' : 'UPGRADE'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {atMax && (
        <Text style={bld.maxText}>MAX LEVEL</Text>
      )}
    </View>
  )
}

const bld = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight, padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  cardUpgrading: { borderColor: COLORS.systemGold, opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  icon: { fontSize: 24, width: 32, textAlign: 'center' },
  info: { flex: 1 },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  desc: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 16 },
  levelWrap: { alignItems: 'center' },
  levelVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.systemGold },
  levelLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary },
  barTrack: { height: 3, backgroundColor: COLORS.borderLow, borderRadius: 2, marginBottom: SPACING.xs, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.systemGold, borderRadius: 2 },
  bonus: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.system, marginBottom: SPACING.sm },
  upgradeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  costRow: { flexDirection: 'row', gap: SPACING.xs, flex: 1 },
  costChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  costIcon: { fontSize: 12 },
  costVal: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  upgradeBtn: {
    backgroundColor: COLORS.systemGoldDim, borderWidth: BORDER.thin, borderColor: COLORS.systemGold,
    borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 5,
  },
  upgradeBtnDisabled: { borderColor: COLORS.borderMid, backgroundColor: 'transparent' },
  upgradeTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.wide },
  maxText: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4 },
})

// =============================================================================
// Territory list item
// =============================================================================

function TerritoryItem({ territory }: { territory: Territory }) {
  return (
    <View style={ti.row}>
      <View style={ti.flag}>
        <Text style={ti.flagIcon}>⚑</Text>
        <Text style={ti.level}>Lv{territory.level}</Text>
      </View>
      <View style={ti.info}>
        <Text style={ti.name}>{territory.name}</Text>
        <Text style={ti.coords}>{territory.lat.toFixed(4)}°N, {territory.lng.toFixed(4)}°E</Text>
      </View>
    </View>
  )
}

const ti = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLow },
  flag: { width: 36, height: 36, backgroundColor: COLORS.surfaceHigh, borderRadius: RADIUS.xs, alignItems: 'center', justifyContent: 'center' },
  flagIcon: { fontSize: 16 },
  level: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.systemGold, textAlign: 'center' },
  info: { flex: 1 },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  coords: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary },
})

// =============================================================================
// Main screen
// =============================================================================

export default function FortressScreen() {
  const player = useStore(selectPlayer)
  const resources = useStore(selectResources)
  const fortress = useStore(selectFortress)
  const myTerritories = useStore(selectMyTerritories)
  const { setResources, setFortress, upgradeFortressBuilding, spendResources, setMyTerritories } = useStore()

  const [refreshing, setRefreshing] = useState(false)
  const [upgradingKey, setUpgradingKey] = useState<string | null>(null)
  const element = player?.primary_element as Element | null
  const palette = elementAccent(element)

  const load = useCallback(async () => {
    if (!player) return
    const [resData, fortData, terrData] = await Promise.all([
      fetchPlayerResources(player.id),
      fetchFortress(player.id),
      fetchMyTerritories(player.id),
    ])
    if (resData.data) {
      const r = resData.data
      setResources({ influence: r.influence ?? 0, iron: r.iron ?? 0, crystal: r.crystal ?? 0, mana: r.mana_res ?? 0, herbs: r.herbs ?? 0, gold: r.gold_res ?? 0 })
    }
    if (fortData.data) setFortress({ level: fortData.data.level, barracks_level: fortData.data.barracks_level, walls_level: fortData.data.walls_level, forge_level: fortData.data.forge_level })
    if (terrData.data) setMyTerritories(terrData.data as Territory[])
  }, [player, setResources, setFortress, setMyTerritories])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false)
  }, [load])

  async function handleUpgrade(key: keyof Omit<Fortress, 'level'>) {
    if (!player) return
    const building = FORTRESS_BUILDINGS.find(b => b.key === key)
    if (!building) return
    const currentLevel = fortress[key]
    const cost = building.upgradeCost(currentLevel + 1)
    if (!spendResources(cost as Partial<PlayerResources>)) return
    upgradeFortressBuilding(key)
    setUpgradingKey(key)
    const newLevel = currentLevel + 1
    const fresh = useStore.getState().resources
    try {
      await upsertFortress(player.id, { [key]: newLevel })
      await upsertPlayerResources(player.id, {
        influence: fresh.influence,
        iron: fresh.iron, crystal: fresh.crystal,
        mana_res: fresh.mana, herbs: fresh.herbs, gold_res: fresh.gold,
      })
    } catch {
      // Local state already updated — next pull-to-refresh will reconcile with server
    } finally {
      setUpgradingKey(null)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.base} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.base }]}>◆ FORTRESS ◆</Text>
          <Text style={styles.sub}>{player?.username ?? '—'} · Main Base</Text>
        </View>

        {/* Resource bar */}
        <ResourceBar />

        {/* Fortress level */}
        <SystemWindow title="FORTRESS STATUS">
          <View style={styles.fortRow}>
            <View>
              <Text style={styles.fortLevel}>Level {fortress.level}</Text>
              <Text style={styles.fortSub}>Main stronghold</Text>
            </View>
            <View style={styles.fortStats}>
              <Text style={styles.fortStat}>Territories: {myTerritories.length}</Text>
              <Text style={styles.fortStat}>Influence: {resources.influence}</Text>
            </View>
          </View>
        </SystemWindow>

        {/* Buildings */}
        <SectionHeader title="BUILDINGS" />
        {FORTRESS_BUILDINGS.map(b => (
          <BuildingCard
            key={b.key}
            building={b}
            currentLevel={fortress[b.key]}
            resources={resources}
            upgrading={upgradingKey === b.key}
            onUpgrade={handleUpgrade}
          />
        ))}

        {/* Territories */}
        <SectionHeader title={`TERRITORIES (${myTerritories.length})`} />
        {myTerritories.length === 0 ? (
          <SystemWindow title="NO TERRITORIES" variant="info">
            <Text style={styles.emptyTxt}>
              Go to the World map and claim your first territory.
              Territories cost ◆ 50 Influence and must be placed at your current location.
            </Text>
          </SystemWindow>
        ) : (
          <View style={styles.terrList}>
            {myTerritories.map(t => <TerritoryItem key={t.id} territory={t} />)}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  header: { alignItems: 'center', marginBottom: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, letterSpacing: LETTER_SPACING.widest },
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  fortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fortLevel: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.systemGold },
  fortSub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary },
  fortStats: { alignItems: 'flex-end', gap: 4 },
  fortStat: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  terrList: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight, paddingHorizontal: SPACING.sm,
  },
  emptyTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 18 },
})
