// =============================================================================
// Aeternum — Party + Matchmaking Screen
// =============================================================================
// Phase 1 async party system. Players form a party before running; all members
// complete their runs independently; the server resolves rewards when the last
// member syncs.
//
// This screen shows:
//   - Current party composition + member run status
//   - Dungeon tier requirements
//   - Synergy bonuses active for the current party
//   - Placeholder for party creation / join (requires matchmaking backend)
// =============================================================================

import React from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer } from '@/store/useStore'
import { Panel, Heading, Label, Button, RankBadge, Spacer, Divider } from '@/components/UI'
import { COLORS, SPACING, elementAccent } from '@/theme/tokens'
import { DUNGEON_TIERS, ELEMENT_LABELS, type Element, type DungeonTier } from '@/types'

// ---------------------------------------------------------------------------
// Synergy definitions
// ---------------------------------------------------------------------------

interface Synergy {
  label: string
  description: string
  elements?: Element[]
  condition?: string
  bonus: string
}

const SYNERGIES: Synergy[] = [
  {
    label: 'Arcane + Water',
    description: 'Arcane and Water elements in the same party',
    elements: ['arcane', 'water'],
    bonus: '+15% spell damage',
  },
  {
    label: 'Healer Present',
    description: 'A Mending element player is in the party',
    elements: ['mending'],
    bonus: '+20% HP regen',
  },
  {
    label: 'Full Party',
    description: 'All 4 party slots filled',
    condition: '4 members',
    bonus: '+10% all rewards',
  },
]

export default function PartyScreen() {
  const player = useStore(selectPlayer)

  const element = (player?.primary_element as Element | null) ?? null
  const palette = elementAccent(element)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Heading size="xl" element={element}>Party Hub</Heading>
        <Spacer size="xs" />
        <Label variant="secondary">
          Form a party before your run. Members complete runs independently.
        </Label>

        <Spacer size="lg" />

        {/* Current party */}
        <Label variant="tertiary">Current Party</Label>
        <Spacer size="sm" />
        <Panel element={element} elevated padding="md">
          {/* Solo placeholder — real matchmaking would populate from DB */}
          <View style={styles.memberRow}>
            <View style={styles.memberInfo}>
              {player && <RankBadge rank={player.rank} size="sm" />}
              <View>
                <Label variant="primary" size="md">{player?.username ?? 'You'}</Label>
                {element && (
                  <Label variant="secondary" size="xs">{ELEMENT_LABELS[element]}</Label>
                )}
              </View>
            </View>
            <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
          </View>

          <Spacer size="sm" />

          {/* Empty slots */}
          {[2, 3, 4].map((slot) => (
            <View key={slot} style={[styles.memberRow, styles.emptySlot]}>
              <Label variant="tertiary">{`Open Slot ${slot}`}</Label>
              <Label variant="tertiary" size="xs">Waiting</Label>
            </View>
          ))}

          <Spacer size="md" />
          <Button
            label="Invite Player"
            element={element}
            variant="ghost"
            onPress={() => undefined}
            fullWidth
          />
        </Panel>

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Dungeon tiers */}
        <Label variant="tertiary">Dungeon Tiers</Label>
        <Spacer size="sm" />
        {DUNGEON_TIERS.map((tier) => (
          <DungeonTierRow key={tier.rank} tier={tier} element={element} />
        ))}

        <Spacer size="lg" />
        <Divider element={element} />

        {/* Synergy bonuses */}
        <Label variant="tertiary">Party Synergies</Label>
        <Spacer size="sm" />
        {SYNERGIES.map((synergy) => (
          <SynergyRow key={synergy.label} synergy={synergy} />
        ))}

        <Spacer size="lg" />
        <Divider element={element} />

        {/* How async parties work */}
        <Panel variant="transparent" padding="sm">
          <Label variant="tertiary">How Async Parties Work</Label>
          <Spacer size="sm" />
          <Label variant="secondary">
            All party members run independently on their own schedule.
            Once the last member syncs their run, the server resolves
            rewards for everyone simultaneously.
          </Label>
          <Spacer size="sm" />
          <Label variant="secondary">
            Rank A dungeons require 2–4 players. Rank S raids require
            5–8 players. All members must hit the required distance.
          </Label>
        </Panel>

        <Spacer size="xl" />
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Dungeon tier row
// ---------------------------------------------------------------------------

function DungeonTierRow({ tier, element }: { tier: DungeonTier; element: Element | null }) {
  const palette = elementAccent(element)

  return (
    <View style={[styles.dungeonRow, { borderColor: COLORS.borderMid }]}>
      <View style={[styles.dungeonRankStripe, { backgroundColor: palette.mid }]}>
        <Label variant="primary" size="xs">{tier.rank}</Label>
      </View>
      <View style={styles.dungeonContent}>
        <Label variant="primary" size="md">{tier.label}</Label>
        <View style={styles.dungeonMeta}>
          <Label variant="tertiary" size="xs">{`${tier.minDistanceKm} km min`}</Label>
          <Label variant="tertiary" size="xs">
            {tier.minPlayers === tier.maxPlayers
              ? `${tier.minPlayers} players`
              : `${tier.minPlayers}–${tier.maxPlayers} players`}
          </Label>
          <Label variant="rarity" rarity={tier.rewardRarity} size="xs">{tier.rewardRarity}</Label>
        </View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Synergy row
// ---------------------------------------------------------------------------

function SynergyRow({ synergy }: { synergy: Synergy }) {
  return (
    <View style={styles.synergyRow}>
      <View style={styles.flex1}>
        <Label variant="primary" size="sm">{synergy.label}</Label>
        <Label variant="tertiary" size="xs">{synergy.description}</Label>
      </View>
      <Label variant="rarity" rarity="uncommon" size="xs">{synergy.bonus}</Label>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ground,
  },
  scroll: {
    padding: SPACING.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLow,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptySlot: {
    opacity: 0.4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  dungeonRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  dungeonRankStripe: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dungeonContent: {
    flex: 1,
    padding: SPACING.sm,
    gap: 4,
  },
  dungeonMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  synergyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLow,
    gap: SPACING.md,
  },
  flex1: {
    flex: 1,
  },
})
