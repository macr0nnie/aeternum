// =============================================================================
// Aeternum — Dungeons Screen
// =============================================================================
// Stat-gated dungeon map. No active combat — dungeons are cleared by meeting
// stat requirements. Clearing awards stat bonuses immediately.
// =============================================================================

import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer, selectClearedDungeonIds, selectEquipped, selectPartyMembers } from '@/store/useStore'
import {
  Heading, Label, Button, Spacer, Divider, DungeonRankBadge, SystemWindow,
  CornerPanel, SectionHeader, StatBar,
} from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, BORDER, RADIUS,
  elementAccent, SHADOWS,
} from '@/theme/tokens'
import { DUNGEON_ENTRIES, STAT_KEYS, STAT_LABELS, STAT_SOURCES, type DungeonEntry, type Element, type StatKey } from '@/types'
import { resolveCoOpGate, type PublicPlayer } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Win probability calculator (client-side preview only — server resolves actual outcome)
// ---------------------------------------------------------------------------

const C_PLUS_RANKS = new Set(['C', 'B', 'A', 'S'])
const WIN_PROB_FLOOR = 0.05   // always at least 5%
const WIN_PROB_CEIL  = 0.97   // never guaranteed

function calcWinProbability(dungeon: DungeonEntry, stats: Record<string, number>, totalDistance: number): number {
  const reqs = dungeon.statRequirements
  const entries = Object.entries(reqs)
  if (entries.length === 0) return WIN_PROB_CEIL

  let totalExcess = 0
  for (const [key, required] of entries) {
    const have = stats[key] ?? 0
    const excess = required > 0 ? (have - required) / required : 1
    totalExcess += excess
  }
  const avgExcess = totalExcess / entries.length

  // avgExcess of 0 → 50% base win chance; each +0.1 adds ~5%; each -0.1 subtracts ~5%
  const raw = 0.5 + avgExcess * 0.5
  return Math.min(WIN_PROB_CEIL, Math.max(WIN_PROB_FLOOR, raw))
}

function winProbLabel(prob: number): { label: string; color: string } {
  if (prob >= 0.85) return { label: 'NEAR CERTAIN', color: COLORS.success }
  if (prob >= 0.65) return { label: 'FAVORABLE',    color: '#3ddc84' }
  if (prob >= 0.45) return { label: 'CONTESTED',    color: COLORS.warning }
  if (prob >= 0.25) return { label: 'DANGEROUS',    color: '#f97316' }
  return { label: 'CRITICAL RISK', color: COLORS.error }
}

// ---------------------------------------------------------------------------
// Win probability modal (C+ gates only)
// ---------------------------------------------------------------------------

interface WinProbModalProps {
  dungeon: DungeonEntry
  winProb: number
  hasVoidLens: boolean
  onConfirm: () => void
  onClose: () => void
}

function WinProbModal({ dungeon, winProb, hasVoidLens, onConfirm, onClose }: WinProbModalProps) {
  const pct = Math.round(winProb * 100)
  const { label, color } = winProbLabel(winProb)
  const rankColor = DUNGEON_RANK_COLORS[dungeon.rank]

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <SystemWindow
            title="⚠  GATE ANALYSIS"
            variant={dungeon.rank === 'S' ? 'gold' : dungeon.rank === 'A' || dungeon.rank === 'B' ? 'alert' : 'info'}
          >
            <Text style={styles.modalDungeonName}>{dungeon.name.toUpperCase()}</Text>
            <Spacer size="xs" />

            {/* Win probability bar */}
            <View style={styles.probSection}>
              <View style={styles.probLabelRow}>
                <Text style={[styles.probLabel, { color }]}>{label}</Text>
                <Text style={[styles.probPct, { color }]}>{pct}%</Text>
              </View>
              <View style={styles.probTrack}>
                <View style={[styles.probFill, { width: `${pct}%` as any, backgroundColor: color }]} />
              </View>
              {!hasVoidLens && (
                <Text style={styles.probHint}>Equip a Void Lens relic to see exact values.</Text>
              )}
            </View>

            <Divider />
            <Text style={styles.modalFlavor}>{`"${dungeon.flavor}"`}</Text>
            <Spacer size="xs" />
            <Text style={styles.probWarning}>
              {winProb < 0.5
                ? 'Defeat in this gate will cost you stat points. Prepare carefully.'
                : 'Your stats suggest a solid chance of success. Proceed with confidence.'}
            </Text>

            <Spacer size="md" />
            <View style={styles.modalActions}>
              <Button label="◆ ENTER GATE ◆" variant="system" onPress={onConfirm} fullWidth />
              <Spacer size="sm" />
              <Button label="Retreat" variant="ghost" onPress={onClose} fullWidth />
            </View>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Co-op member selector modal
// ---------------------------------------------------------------------------

interface CoOpModalProps {
  dungeon: DungeonEntry
  partyMembers: PublicPlayer[]
  hostId: string
  onConfirm: (participantIds: string[]) => void
  onClose: () => void
}

function CoOpModal({ dungeon, partyMembers, hostId, onConfirm, onClose }: CoOpModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const rankColor = DUNGEON_RANK_COLORS[dungeon.rank] ?? COLORS.system

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const participantIds = [hostId, ...Array.from(selected)]
  const bonus = selected.size > 0 ? `+${selected.size * 15}% stat bonus` : 'Solo run'

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <SystemWindow title="⚔  CO-OP GATE" variant="info">
            <Text style={styles.modalDungeonName}>{dungeon.name.toUpperCase()}</Text>
            <Spacer size="xs" />
            <Text style={[styles.coopBonus, { color: selected.size > 0 ? COLORS.success : COLORS.textTertiary }]}>
              {bonus}
            </Text>
            <Spacer size="sm" />

            {partyMembers.length === 0 ? (
              <Text style={styles.coopEmpty}>
                No party members yet. Add hunters from the Party tab to tackle gates together.
              </Text>
            ) : (
              <>
                <Label variant="tertiary" size="xs">SELECT PARTY MEMBERS</Label>
                <Spacer size="xs" />
                {partyMembers.map(m => {
                  const isSelected = selected.has(m.id)
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[coopStyles.memberRow, isSelected && { borderColor: COLORS.success, backgroundColor: COLORS.success + '10' }]}
                      onPress={() => toggle(m.id)}
                      activeOpacity={0.75}
                    >
                      <View style={coopStyles.memberInfo}>
                        <Text style={coopStyles.memberName}>{m.username}</Text>
                        <Text style={coopStyles.memberSub}>
                          RANK {m.rank} · PWR {m.total_stat_power}
                        </Text>
                      </View>
                      <View style={[coopStyles.checkbox, isSelected && { backgroundColor: COLORS.success }]}>
                        {isSelected && <Text style={coopStyles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </>
            )}

            <Spacer size="md" />
            <View style={styles.modalActions}>
              <Button
                label={selected.size > 0 ? `◆ ENTER WITH PARTY (${participantIds.length}) ◆` : '◆ ENTER SOLO ◆'}
                variant="system"
                onPress={() => onConfirm(participantIds)}
                fullWidth
              />
              <Spacer size="sm" />
              <Button label="Retreat" variant="ghost" onPress={onClose} fullWidth />
            </View>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Co-op result modal
// ---------------------------------------------------------------------------

interface CoOpResultProps {
  won: boolean
  winProb: number
  participantCount: number
  statGains: Record<string, number>
  onClose: () => void
}

function CoOpResultModal({ won, winProb, participantCount, statGains, onClose }: CoOpResultProps) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <SystemWindow
            title={won ? '◆ GATE CLEARED ◆' : '◆ GATE FAILED ◆'}
            variant={won ? 'gold' : 'alert'}
          >
            <Text style={[styles.coopResultLine, { color: won ? COLORS.systemGold : COLORS.systemAlert }]}>
              {won ? 'Victory — all participants rewarded.' : 'Defeat — no stat gains this attempt.'}
            </Text>
            <Spacer size="xs" />
            <Text style={styles.coopResultSub}>
              Party size: {participantCount}  ·  Win probability was {Math.round(winProb * 100)}%
            </Text>
            {won && Object.keys(statGains).length > 0 && (
              <>
                <Spacer size="sm" />
                <Label variant="tertiary" size="xs">STAT GAINS (ALL MEMBERS)</Label>
                <Spacer size="xs" />
                <View style={styles.rewardGrid}>
                  {Object.entries(statGains).map(([k, v]) => (
                    <View key={k} style={styles.rewardChip}>
                      <Text style={styles.rewardKey}>{k}</Text>
                      <Text style={styles.rewardVal}>{`+${v}`}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <Spacer size="md" />
            <Button label="Close" variant="ghost" onPress={onClose} fullWidth />
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

const coopStyles = StyleSheet.create({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight,
    backgroundColor: COLORS.surface,
  },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  memberSub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  checkbox: {
    width: 20, height: 20, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: 3, alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.ground },
})

const DUNGEON_RANK_COLORS: Record<string, string> = {
  F: '#4a5068', E: '#3ddc84', D: '#4fa8f8',
  C: '#a78bfa', B: '#f97316', A: '#ffd54f', S: '#e11d48',
}

const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S']

export default function DungeonsScreen() {
  const player = useStore(selectPlayer)
  const clearedIds = useStore(selectClearedDungeonIds)
  const equipped = useStore(selectEquipped)
  const partyMembers = useStore(selectPartyMembers)
  const { clearDungeon } = useStore()

  const [selectedDungeon, setSelectedDungeon] = useState<DungeonEntry | null>(null)
  const [showWinProb, setShowWinProb] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [showCoOp, setShowCoOp] = useState(false)
  const [coOpLoading, setCoOpLoading] = useState(false)
  const [coOpResult, setCoOpResult] = useState<{ won: boolean; winProb: number; participantCount: number; statGains: Record<string, number> } | null>(null)

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)
  const rawStats = player?.stats ?? { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 0, PER: 0, CHA: 0 }
  const stats: Record<string, number> = rawStats as unknown as Record<string, number>
  const totalDistance = player?.total_distance_km ?? 0
  const hasVoidLens = equipped.relic?.id === 'rel_void_lens'

  function meetsRequirements(dungeon: DungeonEntry): boolean {
    if (totalDistance < dungeon.minDistanceKm) return false
    for (const [key, minVal] of Object.entries(dungeon.statRequirements)) {
      const current = stats[key as keyof typeof stats] ?? 0
      if (current < (minVal as number)) return false
    }
    return true
  }

  function handleEnterDungeon(dungeon: DungeonEntry) {
    setSelectedDungeon(dungeon)
    // Show win probability analysis first for C+ gates
    if (C_PLUS_RANKS.has(dungeon.rank)) {
      setShowWinProb(true)
    } else {
      setShowClearModal(true)
    }
  }

  function handleWinProbConfirm() {
    setShowWinProb(false)
    setShowCoOp(true)
  }

  async function handleCoOpConfirm(participantIds: string[]) {
    if (!selectedDungeon || !player) return
    setShowCoOp(false)

    if (participantIds.length === 1) {
      // Solo — use local clear path
      clearDungeon(selectedDungeon.id, selectedDungeon.statRewards)
      setSelectedDungeon(null)
      return
    }

    // Co-op — call server
    setCoOpLoading(true)
    try {
      const result = await resolveCoOpGate(selectedDungeon.id, participantIds)
      if (!result) throw new Error('No response from server')
      if (result.won) {
        clearDungeon(selectedDungeon.id, result.outcomes?.find(o => o.player_id === player.id)?.stat_gains ?? {})
      }
      setCoOpResult({
        won: result.won,
        winProb: result.win_probability ?? calcWinProbability(selectedDungeon, stats, totalDistance),
        participantCount: result.participant_count ?? participantIds.length,
        statGains: (result.outcomes?.[0]?.stat_gains ?? {}) as Record<string, number>,
      })
    } catch {
      // Edge function unavailable or returned null — fall back to local resolution
      const localWon = Math.random() < calcWinProbability(selectedDungeon, stats, totalDistance)
      if (localWon) clearDungeon(selectedDungeon.id, selectedDungeon.statRewards)
      setCoOpResult({
        won: localWon,
        winProb: calcWinProbability(selectedDungeon, stats, totalDistance),
        participantCount: participantIds.length,
        statGains: localWon ? selectedDungeon.statRewards as Record<string, number> : {},
      })
    } finally {
      setCoOpLoading(false)
      setSelectedDungeon(null)
    }
  }

  function handleClear() {
    if (!selectedDungeon) return
    clearDungeon(selectedDungeon.id, selectedDungeon.statRewards)
    setShowClearModal(false)
    setSelectedDungeon(null)
  }

  const grouped = RANK_ORDER.reduce<Record<string, DungeonEntry[]>>(
    (acc, rank) => {
      acc[rank] = DUNGEON_ENTRIES.filter((d) => d.rank === rank)
      return acc
    },
    {},
  )

  const playerRankIdx = Math.max(0, RANK_ORDER.indexOf(player?.rank ?? 'F'))
  const availableRanks = RANK_ORDER.slice(0, playerRankIdx + 1)
  const nextTierRank = RANK_ORDER[playerRankIdx + 1] as string | undefined

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Gate Map</Heading>
        <Spacer size="xs" />
        <Label variant="secondary">
          Meet the stat requirements to enter a gate. Cleared gates award permanent stat bonuses.
        </Label>

        <Spacer size="lg" />

        {/* Player stat summary */}
        <SystemWindow title="HUNTER STATUS">
          <View style={styles.hunterRankRow}>
            <Label variant="tertiary" size="xs">CURRENT RANK</Label>
            <View style={[styles.hunterRankPill, { borderColor: DUNGEON_RANK_COLORS[player?.rank ?? 'F'] }]}>
              <Text style={[styles.hunterRankTxt, { color: DUNGEON_RANK_COLORS[player?.rank ?? 'F'] }]}>
                {`RANK ${player?.rank ?? 'F'}`}
              </Text>
            </View>
          </View>
          <Spacer size="xs" />
          {STAT_KEYS.map((key) => {
            const color = palette.base
            return (
              <StatBar key={key} statKey={key} value={stats[key] ?? 0} color={color} />
            )
          })}
          <Spacer size="xs" />
          <View style={styles.distanceRow}>
            <Label variant="tertiary" size="xs">Total Distance</Label>
            <Text style={styles.distanceValue}>{totalDistance.toFixed(1)} km</Text>
          </View>
        </SystemWindow>

        <SectionHeader title="YOUR GATES" color={palette.base} />

        {availableRanks.map((rank) => {
          const dungeons = grouped[rank]
          if (!dungeons || dungeons.length === 0) return null
          const rankColor = DUNGEON_RANK_COLORS[rank]
          return (
            <View key={rank}>
              <View style={[styles.rankHeader, { borderLeftColor: rankColor }]}>
                <Text style={[styles.rankLabel, { color: rankColor }]}>
                  {`RANK ${rank} GATES`}
                </Text>
              </View>
              {dungeons.map((dungeon) => {
                const unlocked = meetsRequirements(dungeon)
                const cleared = clearedIds.includes(dungeon.id)
                return (
                  <DungeonCard
                    key={dungeon.id}
                    dungeon={dungeon}
                    unlocked={unlocked}
                    cleared={cleared}
                    stats={stats}
                    totalDistance={totalDistance}
                    onEnter={() => handleEnterDungeon(dungeon)}
                  />
                )
              })}
              <Spacer size="sm" />
            </View>
          )
        })}

        {nextTierRank && grouped[nextTierRank] && grouped[nextTierRank].length > 0 && (
          <>
            <Spacer size="md" />
            <View style={styles.nextTierHeader}>
              <View style={[styles.nextTierStripe, { backgroundColor: DUNGEON_RANK_COLORS[nextTierRank] }]} />
              <View style={styles.nextTierInfo}>
                <Text style={[styles.nextTierTitle, { color: DUNGEON_RANK_COLORS[nextTierRank] }]}>
                  {`NEXT TIER — RANK ${nextTierRank} GATES`}
                </Text>
                <Text style={styles.nextTierSub}>Raise your stats to unlock these gates</Text>
              </View>
              <View style={[styles.nextTierBadge, { borderColor: DUNGEON_RANK_COLORS[nextTierRank] }]}>
                <Text style={[styles.nextTierBadgeTxt, { color: DUNGEON_RANK_COLORS[nextTierRank] }]}>LOCKED</Text>
              </View>
            </View>
            {grouped[nextTierRank].map((dungeon) => (
              <NextTierCard key={dungeon.id} dungeon={dungeon} stats={stats} totalDistance={totalDistance} />
            ))}
          </>
        )}

        <Spacer size="xl" />
      </ScrollView>

      {/* Win probability modal — C+ gates only */}
      {showWinProb && selectedDungeon && (
        <WinProbModal
          dungeon={selectedDungeon}
          winProb={calcWinProbability(selectedDungeon, stats, totalDistance)}
          hasVoidLens={hasVoidLens}
          onConfirm={handleWinProbConfirm}
          onClose={() => { setShowWinProb(false); setSelectedDungeon(null) }}
        />
      )}

      {/* Co-op member selector */}
      {showCoOp && selectedDungeon && player && (
        <CoOpModal
          dungeon={selectedDungeon}
          partyMembers={partyMembers}
          hostId={player.id}
          onConfirm={handleCoOpConfirm}
          onClose={() => { setShowCoOp(false); setSelectedDungeon(null) }}
        />
      )}

      {/* Co-op loading overlay */}
      {coOpLoading && (
        <Modal transparent visible>
          <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={COLORS.system} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.system, marginTop: SPACING.md, letterSpacing: LETTER_SPACING.wide }}>
              RESOLVING GATE...
            </Text>
          </View>
        </Modal>
      )}

      {/* Co-op result */}
      {coOpResult && (
        <CoOpResultModal
          won={coOpResult.won}
          winProb={coOpResult.winProb}
          participantCount={coOpResult.participantCount}
          statGains={coOpResult.statGains}
          onClose={() => setCoOpResult(null)}
        />
      )}

      {/* Clear confirmation modal */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedDungeon && (
              <SystemWindow
                title="GATE ENTRY CONFIRMED"
                variant={selectedDungeon.rank === 'S' ? 'gold' : selectedDungeon.rank === 'A' || selectedDungeon.rank === 'B' ? 'alert' : 'info'}
              >
                <Text style={styles.modalDungeonName}>{selectedDungeon.name.toUpperCase()}</Text>
                <Spacer size="xs" />
                <Text style={styles.modalFlavor}>{`"${selectedDungeon.flavor}"`}</Text>
                <Divider />
                <Label variant="tertiary" size="xs">Stat Rewards</Label>
                <Spacer size="xs" />
                <View style={styles.rewardGrid}>
                  {Object.entries(selectedDungeon.statRewards).map(([k, v]) => (
                    <View key={k} style={styles.rewardChip}>
                      <Text style={styles.rewardKey}>{k}</Text>
                      <Text style={styles.rewardVal}>{`+${v}`}</Text>
                    </View>
                  ))}
                </View>
                <Spacer size="lg" />
                <View style={styles.modalActions}>
                  <Button
                    label="Clear Gate"
                    variant="system"
                    onPress={handleClear}
                    fullWidth
                  />
                  <Spacer size="sm" />
                  <Button
                    label="Retreat"
                    variant="ghost"
                    onPress={() => { setShowClearModal(false); setSelectedDungeon(null) }}
                    fullWidth
                  />
                </View>
              </SystemWindow>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// DungeonCard
// ---------------------------------------------------------------------------

function DungeonCard({
  dungeon,
  unlocked,
  cleared,
  stats,
  totalDistance,
  onEnter,
}: {
  dungeon: DungeonEntry
  unlocked: boolean
  cleared: boolean
  stats: Record<string, number>
  totalDistance: number
  onEnter: () => void
}) {
  const rankColor = DUNGEON_RANK_COLORS[dungeon.rank]
  const [expanded, setExpanded] = useState(false)

  const missingStats = Object.entries(dungeon.statRequirements).filter(
    ([k, v]) => (stats[k] ?? 0) < (v as number),
  )
  const distanceMet = totalDistance >= dungeon.minDistanceKm

  return (
    <TouchableOpacity
      activeOpacity={unlocked ? 0.8 : 0.95}
      onPress={() => unlocked && !cleared && setExpanded((p) => !p)}
      style={[
        cardStyles.card,
        {
          borderColor: cleared ? rankColor + '60' : unlocked ? rankColor + 'aa' : COLORS.borderLow,
          backgroundColor: cleared ? COLORS.surfaceHigh : unlocked ? COLORS.surface : COLORS.locked,
          opacity: cleared ? 0.6 : 1,
        },
        unlocked && !cleared && { ...(SHADOWS.md as object) },
      ]}
    >
      {/* Top row */}
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.rankStripe, { backgroundColor: rankColor }]} />
        <View style={cardStyles.info}>
          <View style={cardStyles.nameRow}>
            <DungeonRankBadge rank={dungeon.rank} size="sm" />
            <Text style={[
              cardStyles.name,
              { color: cleared ? COLORS.textTertiary : unlocked ? COLORS.textPrimary : COLORS.textTertiary },
            ]}>
              {cleared ? `[CLEARED] ${dungeon.name.toUpperCase()}` : dungeon.name.toUpperCase()}
            </Text>
          </View>
          <Text style={cardStyles.desc} numberOfLines={expanded ? undefined : 1}>
            {dungeon.description}
          </Text>
        </View>
        {/* Lock indicator */}
        {!unlocked && (
          <Text style={cardStyles.lockIcon}>⊘</Text>
        )}
        {cleared && (
          <Text style={[cardStyles.lockIcon, { color: rankColor }]}>✓</Text>
        )}
      </View>

      {/* Requirements (shown when locked) */}
      {!unlocked && !cleared && (
        <View style={cardStyles.reqRow}>
          {!distanceMet && (
            <View style={cardStyles.reqChip}>
              <Text style={cardStyles.reqKey}>DIST</Text>
              <Text style={cardStyles.reqVal}>{totalDistance.toFixed(0)}/{dungeon.minDistanceKm} km</Text>
            </View>
          )}
          {missingStats.slice(0, 4).map(([k, v]) => (
            <View key={k} style={cardStyles.reqChip}>
              <Text style={cardStyles.reqKey}>{k}</Text>
              <Text style={cardStyles.reqVal}>{stats[k] ?? 0}/{v}</Text>
              {STAT_SOURCES[k as StatKey] && (
                <Text style={cardStyles.reqHint}> · {STAT_SOURCES[k as StatKey]}</Text>
              )}
            </View>
          ))}
          {missingStats.length > 4 && (
            <Text style={cardStyles.reqMore}>{`+${missingStats.length - 4} more`}</Text>
          )}
        </View>
      )}

      {/* Expanded: rewards + enter button */}
      {expanded && unlocked && !cleared && (
        <View style={cardStyles.expandedSection}>
          <Text style={[cardStyles.flavorText, { color: rankColor + 'cc' }]}>
            {`"${dungeon.flavor}"`}
          </Text>
          <Spacer size="sm" />
          <View style={cardStyles.rewardRow}>
            {Object.entries(dungeon.statRewards).map(([k, v]) => (
              <View key={k} style={[cardStyles.rewardChip, { borderColor: rankColor + '60' }]}>
                <Text style={[cardStyles.rewardKey, { color: rankColor }]}>{k}</Text>
                <Text style={cardStyles.rewardVal}>{`+${v}`}</Text>
              </View>
            ))}
          </View>
          <Spacer size="md" />
          <TouchableOpacity
            onPress={onEnter}
            style={[cardStyles.enterBtn, { borderColor: rankColor, backgroundColor: rankColor + '18' }]}
            activeOpacity={0.75}
          >
            <Text style={[cardStyles.enterBtnText, { color: rankColor }]}>
              {'◆ ENTER GATE ◆'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// NextTierCard — teaser card for the rank above the player's current rank
// ---------------------------------------------------------------------------

function NextTierCard({ dungeon, stats, totalDistance }: {
  dungeon: DungeonEntry
  stats: Record<string, number>
  totalDistance: number
}) {
  const rankColor = DUNGEON_RANK_COLORS[dungeon.rank]

  const reqs: { key: string; have: number; need: number; suffix: string; source?: string }[] = []
  if (totalDistance < dungeon.minDistanceKm) {
    reqs.push({ key: 'DIST', have: totalDistance, need: dungeon.minDistanceKm, suffix: ' km' })
  }
  for (const [k, v] of Object.entries(dungeon.statRequirements)) {
    reqs.push({ key: k, have: stats[k] ?? 0, need: v as number, suffix: '', source: STAT_SOURCES[k as StatKey] })
  }

  return (
    <View style={[nextStyles.card, { borderColor: rankColor + '35' }]}>
      <View style={nextStyles.topRow}>
        <View style={[nextStyles.rankStripe, { backgroundColor: rankColor + '55' }]} />
        <View style={nextStyles.info}>
          <View style={nextStyles.nameRow}>
            <DungeonRankBadge rank={dungeon.rank} size="sm" />
            <Text style={nextStyles.name} numberOfLines={1}>{dungeon.name.toUpperCase()}</Text>
          </View>
          <Text style={nextStyles.desc} numberOfLines={1}>{dungeon.description}</Text>
        </View>
        <Text style={nextStyles.lockIcon}>⊘</Text>
      </View>

      {reqs.length > 0 && (
        <View style={nextStyles.reqSection}>
          {reqs.map(({ key, have, need, suffix, source }) => {
            const pct = Math.min(100, need > 0 ? (have / need) * 100 : 100)
            return (
              <View key={key} style={nextStyles.reqItem}>
                <View style={nextStyles.reqLabelRow}>
                  <Text style={nextStyles.reqKey}>{key}</Text>
                  <Text style={nextStyles.reqProgress}>{`${have.toFixed(0)} / ${need}${suffix}`}</Text>
                  {have < need && (
                    <Text style={nextStyles.reqNeeded}>{`  +${(need - have).toFixed(0)} needed`}</Text>
                  )}
                </View>
                <View style={nextStyles.reqTrack}>
                  <View style={[nextStyles.reqFill, {
                    width: `${pct}%` as any,
                    backgroundColor: pct >= 100 ? COLORS.success : rankColor + '70',
                  }]} />
                </View>
                {source && <Text style={nextStyles.reqSource}>from: {source}</Text>}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const nextStyles = StyleSheet.create({
  card: {
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.slight,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    opacity: 0.72,
    backgroundColor: COLORS.locked,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.sm },
  rankStripe: { width: 3, alignSelf: 'stretch', borderRadius: 2, minHeight: 40 },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  name: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.sm,
    color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.normal, flex: 1,
  },
  desc: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, lineHeight: FONT_SIZES.xs * 1.6 },
  lockIcon: { fontSize: 18, color: COLORS.borderMid, paddingRight: SPACING.sm },
  reqSection: {
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, paddingTop: SPACING.xs,
    gap: SPACING.xs + 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLow,
  },
  reqItem: { gap: 3 },
  reqLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqKey: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.tight, width: 36,
  },
  reqProgress: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  reqNeeded: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemAlert },
  reqTrack: { height: 3, backgroundColor: COLORS.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  reqFill: { height: 3, borderRadius: 2 },
  reqSource: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, fontStyle: 'italic' },
})

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { padding: SPACING.md },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.xs,
  },
  distanceValue: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  },
  hunterRankRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs,
  },
  hunterRankPill: {
    borderWidth: BORDER.thin, borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  hunterRankTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, letterSpacing: LETTER_SPACING.wide },
  rankHeader: {
    borderLeftWidth: 3,
    paddingLeft: SPACING.sm,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  rankLabel: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.extraWide,
  },
  nextTierHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.sm, paddingVertical: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderMid,
  },
  nextTierStripe: { width: 3, height: 32, borderRadius: 2 },
  nextTierInfo: { flex: 1 },
  nextTierTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, letterSpacing: LETTER_SPACING.extraWide },
  nextTierSub: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, marginTop: 2 },
  nextTierBadge: {
    borderWidth: BORDER.thin, borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2, paddingVertical: 2,
  },
  nextTierBadgeTxt: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContainer: { width: '100%' },
  modalDungeonName: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: SPACING.xs,
  },
  modalFlavor: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: BORDER.thin,
    borderColor: COLORS.systemBorder,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: COLORS.systemDim,
  },
  rewardKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.system,
    letterSpacing: LETTER_SPACING.normal,
  },
  rewardVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
  },
  modalActions: {},

  // Win probability modal
  probSection: { marginVertical: SPACING.sm },
  probLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  probLabel: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.wide,
  },
  probPct: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.lg,
  },
  probTrack: {
    height: 8,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  probFill: {
    height: 8,
    borderRadius: RADIUS.full,
  },
  probHint: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  probWarning: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Co-op modals
  coopBonus: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.wide,
  },
  coopEmpty: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  coopResultLine: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.md,
    letterSpacing: LETTER_SPACING.normal,
    marginBottom: SPACING.xs,
  },
  coopResultSub: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
})

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.slight,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  rankStripe: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    minHeight: 40,
  },
  info: { flex: 1, gap: 4 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.normal,
    flex: 1,
  },
  desc: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    lineHeight: FONT_SIZES.xs * 1.6,
  },
  lockIcon: {
    fontSize: 18,
    color: COLORS.textTertiary,
    paddingRight: SPACING.sm,
  },
  reqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm + 6,
    paddingBottom: SPACING.sm,
  },
  reqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    backgroundColor: COLORS.surfaceHigh,
  },
  reqKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: LETTER_SPACING.tight,
  },
  reqVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
  reqHint: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  reqMore: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    alignSelf: 'center',
  },
  expandedSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLow,
  },
  flavorText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    fontStyle: 'italic',
    lineHeight: FONT_SIZES.xs * 1.6,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    backgroundColor: COLORS.surfaceHigh,
  },
  rewardKey: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.tight,
  },
  rewardVal: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
  },
  enterBtn: {
    borderWidth: BORDER.mid,
    borderRadius: RADIUS.sharp,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  enterBtnText: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.extraWide,
  },
})
