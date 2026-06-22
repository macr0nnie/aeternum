// =============================================================================
// Aeternum — RewardPopup
// Dismissible, click-through reward screen shown after dungeon clears / runs
// =============================================================================
import { useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import {
  COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, SHADOWS,
} from '@/theme/tokens'
import { RARITY_COLORS, RARITY_LABELS, type DroppedReward } from '@/types'
import { Icon } from '@/components/UI'

// =============================================================================
// Single reward card
// =============================================================================

function RewardCard({ reward }: { reward: DroppedReward }) {
  const borderColor = RARITY_COLORS[reward.rarity]
  const kindLabel: Record<DroppedReward['kind'], string> = {
    gear:       'EQUIPMENT',
    relic:      'RELIC',
    consumable: 'CONSUMABLE',
    material:   'MATERIAL',
    resource:   'RESOURCE',
    stat_gain:  'STAT GAIN',
    skill:      'PLAYER SKILL',
    base_skill: 'BASE SKILL',
  }

  return (
    <View style={[card.wrap, { borderColor }]}>
      {/* Rarity glow header */}
      <View style={[card.rarityBar, { backgroundColor: borderColor + '30', borderBottomColor: borderColor + '60' }]}>
        <Text style={[card.rarityTxt, { color: borderColor }]}>{RARITY_LABELS[reward.rarity]}</Text>
        <Text style={[card.kindTxt, { color: borderColor + 'cc' }]}>{kindLabel[reward.kind]}</Text>
      </View>

      {/* Icon */}
      <View style={card.iconWrap}>
        <Text style={card.icon}>{reward.icon}</Text>
      </View>

      {/* Name */}
      <Text style={card.name}>{reward.name}</Text>

      {/* Quantity badge */}
      {reward.quantity !== undefined && reward.quantity > 1 && (
        <View style={card.qtyBadge}>
          <Text style={card.qtyTxt}>×{reward.quantity}</Text>
        </View>
      )}

      {/* Description */}
      <Text style={card.desc}>{reward.description}</Text>

      {/* Stat gains breakdown */}
      {reward.statGains && Object.keys(reward.statGains).length > 0 && (
        <View style={card.statRow}>
          {Object.entries(reward.statGains).map(([k, v]) => (
            <View key={k} style={card.statChip}>
              <Text style={card.statKey}>{k}</Text>
              <Text style={card.statVal}>{`+${v}`}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const card = StyleSheet.create({
  wrap: {
    borderWidth: 2, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    overflow: 'hidden', marginBottom: SPACING.lg,
    ...(SHADOWS.md as object),
  },
  rarityBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
  },
  rarityTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, letterSpacing: LETTER_SPACING.extraWide },
  kindTxt: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
  iconWrap: { alignItems: 'center', paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  icon: { fontSize: 72 },
  name: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary, textAlign: 'center',
    letterSpacing: LETTER_SPACING.wide,
    paddingHorizontal: SPACING.md,
  },
  qtyBadge: {
    alignSelf: 'center', marginTop: SPACING.xs,
    backgroundColor: COLORS.surfaceHigh, borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  qtyTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  desc: {
    fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: FONT_SIZES.sm * 1.6, marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
  },
  statRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg,
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: BORDER.thin, borderColor: COLORS.systemBorder,
    borderRadius: RADIUS.sharp, paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: COLORS.systemDim,
  },
  statKey: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, color: COLORS.system, letterSpacing: LETTER_SPACING.normal },
  statVal: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.success, fontWeight: '700' },
})

// =============================================================================
// Popup
// =============================================================================

interface RewardPopupProps {
  rewards: DroppedReward[]
  title?: string
  onClose: () => void
}

export function RewardPopup({ rewards, title = 'REWARDS', onClose }: RewardPopupProps) {
  const [index, setIndex] = useState(0)
  if (rewards.length === 0) return null

  const current = rewards[index]!  // bounds guaranteed by index state
  const isLast = index === rewards.length - 1

  function handleNext() {
    if (isLast) {
      onClose()
    } else {
      setIndex(i => i + 1)
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={popup.overlay}>
        {/* Header */}
        <View style={popup.header}>
          <Text style={popup.title}>{title}</Text>
          <Text style={popup.counter}>{index + 1} / {rewards.length}</Text>
        </View>

        {/* Scrollable card area (handles large descriptions) */}
        <ScrollView
          contentContainerStyle={popup.cardContainer}
          showsVerticalScrollIndicator={false}
        >
          <RewardCard reward={current} />
        </ScrollView>

        {/* Progress dots */}
        {rewards.length > 1 && (
          <View style={popup.dots}>
            {rewards.map((_, i) => (
              <View
                key={i}
                style={[popup.dot, i === index && popup.dotActive, i < index && popup.dotDone]}
              />
            ))}
          </View>
        )}

        {/* Action button */}
        <TouchableOpacity style={popup.nextBtn} onPress={handleNext} activeOpacity={0.8}>
          <Text style={popup.nextTxt}><Icon name={isLast ? 'check' : 'play'} size={15} color={COLORS.system} />  {isLast ? 'CLAIM ALL' : 'NEXT'}</Text>
        </TouchableOpacity>

        {/* Skip all */}
        {!isLast && (
          <TouchableOpacity style={popup.skipBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={popup.skipTxt}>SKIP ALL</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  )
}

const popup = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary, letterSpacing: LETTER_SPACING.extraWide,
  },
  counter: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textTertiary },
  cardContainer: { flexGrow: 1, justifyContent: 'center' },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    marginBottom: SPACING.md,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.borderMid,
  },
  dotActive: { backgroundColor: COLORS.system, width: 18 },
  dotDone: { backgroundColor: COLORS.textTertiary },
  nextBtn: {
    backgroundColor: COLORS.systemDim, borderWidth: BORDER.mid,
    borderColor: COLORS.system, borderRadius: RADIUS.slight,
    paddingVertical: SPACING.md, alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  nextTxt: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.md,
    color: COLORS.system, letterSpacing: LETTER_SPACING.extraWide,
  },
  skipBtn: { alignItems: 'center', paddingVertical: SPACING.xs },
  skipTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
})
