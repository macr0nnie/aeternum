// =============================================================================
// Aeternum — Quest Board Screen
// =============================================================================
// Displays all quests with their completion status. Completing a quest awards
// permanent stat bonuses. Quest conditions are checked against player state.
// =============================================================================

import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  useStore, selectPlayer, selectCompletedQuestIds, selectClearedDungeonIds,
} from '@/store/useStore'
import {
  Heading, Label, Spacer, SystemWindow, SectionHeader,
} from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, LETTER_SPACING, SPACING, BORDER, RADIUS, elementAccent,
} from '@/theme/tokens'
import { QUESTS, type Quest, type QuestCategory, type Element } from '@/types'

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  training: 'Training',
  combat: 'Combat',
  exploration: 'Exploration',
  special: 'Special',
}

const CATEGORY_COLORS: Record<QuestCategory, string> = {
  training: '#3ddc84',
  combat: '#f97316',
  exploration: '#4fa8f8',
  special: '#ffd54f',
}

export default function QuestsScreen() {
  const player = useStore(selectPlayer)
  const completedIds = useStore(selectCompletedQuestIds)
  const clearedDungeonIds = useStore(selectClearedDungeonIds)
  const { completeQuest } = useStore()

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)
  const stats = player?.stats ?? { ATK: 0, SPD: 0, INT: 0, LCK: 0, DEF: 0, END: 0, PER: 0, CHA: 0 }
  const totalDistance = player?.total_distance_km ?? 0

  function isConditionMet(quest: Quest): boolean {
    const { condition } = quest
    switch (condition.type) {
      case 'auto': return true
      case 'distance': return totalDistance >= (condition.km ?? 0)
      case 'stat': {
        const key = condition.statKey
        if (!key) return false
        return (stats[key] ?? 0) >= (condition.statMin ?? 0)
      }
      case 'dungeon_clear':
        return clearedDungeonIds.includes(condition.dungeonId ?? '')
      case 'dungeon_count':
        return clearedDungeonIds.length >= (condition.count ?? 0)
      default: return false
    }
  }

  function conditionLabel(quest: Quest): string {
    const { condition } = quest
    switch (condition.type) {
      case 'auto': return 'Auto-complete'
      case 'distance': return `${totalDistance.toFixed(1)} / ${condition.km} km`
      case 'stat': return `${condition.statKey}: ${stats[condition.statKey!] ?? 0} / ${condition.statMin}`
      case 'dungeon_clear': return 'Clear specific gate'
      case 'dungeon_count': return `${clearedDungeonIds.length} / ${condition.count} gates cleared`
      default: return ''
    }
  }

  // Group quests by category
  const categories: QuestCategory[] = ['special', 'training', 'combat', 'exploration']

  const stats_counts = useMemo(() => {
    const total = QUESTS.length
    const completed = QUESTS.filter((q) => completedIds.includes(q.id)).length
    const available = QUESTS.filter((q) => !completedIds.includes(q.id) && isConditionMet(q)).length
    return { total, completed, available }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIds, clearedDungeonIds, totalDistance, stats])

  function handleClaimQuest(quest: Quest) {
    if (!isConditionMet(quest) || completedIds.includes(quest.id)) return
    completeQuest(quest.id, quest.statRewards)
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Quest Board</Heading>
        <Spacer size="xs" />
        <Label variant="secondary">
          Complete quests to permanently increase your stats.
        </Label>

        <Spacer size="lg" />

        {/* Progress summary */}
        <SystemWindow title="QUEST LOG">
          <View style={styles.summaryRow}>
            <SummaryCell label="Completed" value={stats_counts.completed} color={COLORS.success} />
            <SummaryCell label="Available" value={stats_counts.available} color={COLORS.system} />
            <SummaryCell label="Total" value={stats_counts.total} color={COLORS.textSecondary} />
          </View>
        </SystemWindow>

        {categories.map((cat) => {
          const quests = QUESTS.filter((q) => q.category === cat)
          const catColor = CATEGORY_COLORS[cat]

          return (
            <View key={cat}>
              <SectionHeader title={CATEGORY_LABELS[cat]} color={catColor} />
              {quests.map((quest) => {
                const done = completedIds.includes(quest.id)
                const condMet = isConditionMet(quest)
                const claimable = condMet && !done
                const condStr = conditionLabel(quest)

                return (
                  <QuestRow
                    key={quest.id}
                    quest={quest}
                    done={done}
                    claimable={claimable}
                    conditionLabel={condStr}
                    catColor={catColor}
                    onClaim={() => handleClaimQuest(quest)}
                  />
                )
              })}
            </View>
          )
        })}

        <Spacer size="xl" />
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// SummaryCell
// ---------------------------------------------------------------------------

function SummaryCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label.toUpperCase()}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// QuestRow
// ---------------------------------------------------------------------------

function QuestRow({
  quest,
  done,
  claimable,
  conditionLabel: condStr,
  catColor,
  onClaim,
}: {
  quest: Quest
  done: boolean
  claimable: boolean
  conditionLabel: string
  catColor: string
  onClaim: () => void
}) {
  const borderColor = done
    ? COLORS.borderLow
    : claimable
      ? catColor
      : COLORS.borderMid

  const bgColor = done
    ? COLORS.locked
    : claimable
      ? catColor + '12'
      : COLORS.surface

  return (
    <View style={[qStyles.card, { borderColor, backgroundColor: bgColor, opacity: done ? 0.5 : 1 }]}>
      {/* Left rank stripe */}
      <View style={[qStyles.stripe, { backgroundColor: done ? COLORS.borderLow : catColor }]} />

      <View style={qStyles.body}>
        {/* Title row */}
        <View style={qStyles.titleRow}>
          <Text style={[qStyles.title, { color: done ? COLORS.textTertiary : COLORS.textPrimary }]}>
            {done ? `[COMPLETE] ${quest.title.toUpperCase()}` : quest.title.toUpperCase()}
          </Text>
          {claimable && !done && (
            <Text style={[qStyles.claimTag, { color: catColor }]}>CLAIM</Text>
          )}
        </View>

        {/* Description */}
        <Text style={qStyles.desc}>{quest.description}</Text>

        {/* Condition progress */}
        {!done && (
          <Text style={[qStyles.condition, { color: claimable ? catColor : COLORS.textTertiary }]}>
            {claimable ? '✓ ' : '○ '}{condStr}
          </Text>
        )}

        {/* Rewards */}
        <View style={qStyles.rewardsRow}>
          {Object.entries(quest.statRewards).map(([k, v]) => (
            <View key={k} style={qStyles.rewardChip}>
              <Text style={[qStyles.rewardKey, { color: done ? COLORS.textTertiary : catColor }]}>{k}</Text>
              <Text style={[qStyles.rewardVal, { color: done ? COLORS.textTertiary : COLORS.success }]}>{`+${v}`}</Text>
            </View>
          ))}
        </View>

        {/* Flavor */}
        {!done && (
          <Text style={qStyles.flavor}>{`"${quest.flavor}"`}</Text>
        )}

        {/* Claim button */}
        {claimable && (
          <TouchableOpacity
            onPress={onClaim}
            activeOpacity={0.75}
            style={[qStyles.claimBtn, { borderColor: catColor, backgroundColor: catColor + '18' }]}
          >
            <Text style={[qStyles.claimBtnText, { color: catColor }]}>
              {'◆ CLAIM REWARD ◆'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { padding: SPACING.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCell: {
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: LETTER_SPACING.wide,
  },
})

const qStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.slight,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  stripe: {
    width: 3,
    minHeight: 40,
  },
  body: {
    flex: 1,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.sm,
    letterSpacing: LETTER_SPACING.normal,
    flex: 1,
  },
  claimTag: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.wide,
  },
  desc: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZES.xs * 1.5,
  },
  condition: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 2,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
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
  },
  flavor: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  claimBtn: {
    borderWidth: BORDER.thin,
    borderRadius: RADIUS.sharp,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  claimBtnText: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.xs,
    letterSpacing: LETTER_SPACING.extraWide,
  },
})
