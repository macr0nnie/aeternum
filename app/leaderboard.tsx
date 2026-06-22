// =============================================================================
// Aeternum — Leaderboard Screen
// =============================================================================
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native'
import { useStore, selectPlayer } from '@/store/useStore'
import { DungeonRankBadge, SectionHeader } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, elementAccent } from '@/theme/tokens'
import { fetchLeaderboard, type LeaderboardCategory } from '@/lib/supabase'
import type { Element } from '@/types'

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

const TABS: { key: LeaderboardCategory; label: string; unit: (v: number, row: any) => string }[] = [
  { key: 'distance',   label: 'DISTANCE',   unit: (v) => `${(v as number).toFixed(1)} km` },
  { key: 'stat_power', label: 'POWER',      unit: (_, row) => `PWR ${row.total_stat_power}` },
  { key: 'gates',      label: 'GATES',      unit: (_, row) => `${(row.cleared_dungeon_ids as string[] | null)?.length ?? 0} cleared` },
]

// ---------------------------------------------------------------------------
// Rank position badge
// ---------------------------------------------------------------------------

const PositionBadge: React.FC<{ position: number }> = ({ position }) => {
  const color =
    position === 1 ? COLORS.systemGold :
    position === 2 ? '#c0c0c0' :
    position === 3 ? '#cd7f32' :
    COLORS.textTertiary

  return (
    <View style={[posBadge.wrap, { borderColor: color }]}>
      <Text style={[posBadge.text, { color }]}>
        {position <= 3 ? ['◆', '◈', '◇'][position - 1] : `#${position}`}
      </Text>
    </View>
  )
}

const posBadge = StyleSheet.create({
  wrap: { width: 36, alignItems: 'center', borderWidth: BORDER.thin, borderRadius: RADIUS.xs, paddingVertical: 3 },
  text: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, letterSpacing: LETTER_SPACING.normal },
})

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface LeaderRowProps {
  position: number
  row: any
  category: LeaderboardCategory
  isSelf: boolean
  unitFn: (v: number, row: any) => string
}

const LeaderRow: React.FC<LeaderRowProps> = ({ position, row, category, isSelf, unitFn }) => {
  const palette = elementAccent(row.primary_element as Element | null)
  const value = category === 'distance' ? row.total_distance_km : 0

  return (
    <View style={[rowStyles.row, isSelf && rowStyles.selfRow]}>
      <PositionBadge position={position} />
      <View style={[rowStyles.elementBar, { backgroundColor: palette.base }]} />
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, isSelf && { color: COLORS.systemGold }]}>
          {row.username}{isSelf ? ' ◀' : ''}
        </Text>
        <Text style={rowStyles.sub}>{unitFn(value, row)}</Text>
      </View>
      <DungeonRankBadge rank={row.rank} size="sm" />
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLow,
  },
  selfRow: {
    backgroundColor: COLORS.systemGoldDim,
    marginHorizontal: -SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.slight,
  },
  elementBar: { width: 3, height: 32, borderRadius: 2 },
  info: { flex: 1 },
  name: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  sub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
})

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LeaderboardScreen() {
  const player = useStore(selectPlayer)
  const [category, setCategory] = useState<LeaderboardCategory>('distance')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (cat: LeaderboardCategory) => {
    setLoading(true)
    try {
      const { data } = await fetchLeaderboard(cat)
      setRows(data ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(category) }, [category, load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(category); setRefreshing(false)
  }, [category, load])

  const currentTab = TABS.find(t => t.key === category)!

  // Find self position
  const selfPosition = player
    ? rows.findIndex(r => r.id === player.id) + 1
    : -1

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.systemGold} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>◆ RANKINGS ◆</Text>
          {selfPosition > 0 && (
            <Text style={styles.selfRank}>YOUR RANK: #{selfPosition}</Text>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, category === t.key && styles.tabActive]}
              onPress={() => setCategory(t.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, category === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title={`TOP ${rows.length} — ${currentTab.label}`} />

        {loading ? (
          <Text style={styles.loading}>Loading rankings...</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.loading}>No data yet. Be the first!</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((row, idx) => (
              <LeaderRow
                key={row.id}
                position={idx + 1}
                row={row}
                category={category}
                isSelf={row.id === player?.id}
                unitFn={currentTab.unit}
              />
            ))}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xl },
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.widest },
  selfRank: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, marginTop: 4, letterSpacing: LETTER_SPACING.wide },
  tabBar: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tab: {
    flex: 1, paddingVertical: SPACING.sm, borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid, borderRadius: RADIUS.sm, alignItems: 'center',
  },
  tabActive: { borderColor: COLORS.systemGold, backgroundColor: COLORS.systemGoldDim },
  tabText: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
  tabTextActive: { color: COLORS.systemGold },
  list: { gap: 0 },
  loading: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.xl },
})
