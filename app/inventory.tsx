// =============================================================================
// Aeternum — Inventory Screen
// =============================================================================
import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native'
import { useStore, selectPlayer, selectInventory, selectEquipped } from '@/store/useStore'
import { SystemWindow, CornerPanel, SectionHeader, DungeonRankBadge, Label } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, rarityColor } from '@/theme/tokens'
import type { GearItem, Relic, GearSlot, GearLoadout } from '@/types'

// ---------------------------------------------------------------------------
// Stat diff helper
// ---------------------------------------------------------------------------

function statDiff(
  equipped: GearLoadout,
  candidate: GearItem,
  statKey: string,
): number {
  const slot = candidate.slot as keyof Omit<GearLoadout, 'relic'>
  const current = equipped[slot]
  const candidateVal = (candidate.statBonuses as Record<string, number>)[statKey] ?? 0
  const currentVal = current ? ((current.statBonuses as Record<string, number>)[statKey] ?? 0) : 0
  return candidateVal - currentVal
}

function allStatKeys(item: GearItem, compare: GearItem | null): string[] {
  const keys = new Set([
    ...Object.keys(item.statBonuses),
    ...(compare ? Object.keys(compare.statBonuses) : []),
  ])
  return Array.from(keys)
}

// ---------------------------------------------------------------------------
// Rarity colour chip
// ---------------------------------------------------------------------------

const RarityBadge: React.FC<{ rarity: string }> = ({ rarity }) => (
  <View style={[styles.rarityBadge, { borderColor: rarityColor(rarity as any) }]}>
    <Text style={[styles.rarityText, { color: rarityColor(rarity as any) }]}>
      {rarity.toUpperCase()}
    </Text>
  </View>
)

// ---------------------------------------------------------------------------
// Equipment slot card
// ---------------------------------------------------------------------------

const SLOT_LABELS: Record<string, string> = {
  weapon: 'WEAPON',
  armor: 'ARMOR',
  ring: 'RING',
  relic: 'RELIC',
}

interface SlotCardProps {
  slot: GearSlot | 'relic'
  item: GearItem | Relic | null
  onPress: () => void
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, item, onPress }) => (
  <TouchableOpacity style={styles.slotCard} onPress={onPress} activeOpacity={0.75}>
    <Text style={styles.slotLabel}>{SLOT_LABELS[slot]}</Text>
    {item ? (
      <>
        <Text style={[styles.slotItemName, { color: rarityColor((item as any).rarity) }]}>
          {item.name}
        </Text>
        {(item as GearItem).statBonuses && (
          <Text style={styles.slotBonuses}>
            {Object.entries((item as GearItem).statBonuses)
              .map(([k, v]) => `${k} +${v}`)
              .join('  ')}
          </Text>
        )}
        {(item as Relic).passiveEffect && (
          <Text style={styles.slotBonuses} numberOfLines={2}>
            {(item as Relic).passiveEffect}
          </Text>
        )}
      </>
    ) : (
      <Text style={styles.slotEmpty}>— EMPTY —</Text>
    )}
    <Text style={styles.slotTap}>TAP TO CHANGE</Text>
  </TouchableOpacity>
)

// ---------------------------------------------------------------------------
// Gear pick modal
// ---------------------------------------------------------------------------

interface GearPickModalProps {
  slot: GearSlot | 'relic' | null
  inventory: import('@/types').PlayerInventory
  equipped: GearLoadout
  onEquip: (item: GearItem | Relic) => void
  onUnequip: () => void
  onClose: () => void
}

const GearPickModal: React.FC<GearPickModalProps> = ({
  slot, inventory, equipped, onEquip, onUnequip, onClose,
}) => {
  if (!slot) return null

  const isRelic = slot === 'relic'
  const candidates: (GearItem | Relic)[] = isRelic
    ? inventory.relics
    : inventory.gear.filter(g => g.slot === slot)

  const currentEquipped = isRelic ? equipped.relic : equipped[slot as keyof Omit<GearLoadout, 'relic'>]

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <SystemWindow title={`SELECT ${SLOT_LABELS[slot]}`} variant="info">
            {currentEquipped && (
              <TouchableOpacity style={styles.unequipBtn} onPress={onUnequip}>
                <Text style={styles.unequipText}>◆ UNEQUIP CURRENT ◆</Text>
              </TouchableOpacity>
            )}
            {candidates.length === 0 ? (
              <Text style={styles.emptyBag}>No {slot} items in inventory.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {candidates.map((item, idx) => {
                  const isGear = !isRelic && (item as GearItem).statBonuses
                  const diff = isGear
                    ? allStatKeys(item as GearItem, currentEquipped as GearItem | null).map(k => ({
                        key: k,
                        value: statDiff(equipped, item as GearItem, k),
                      }))
                    : []

                  return (
                    <TouchableOpacity
                      key={`${item.id}_${idx}`}
                      style={styles.candidateRow}
                      onPress={() => { onEquip(item); onClose() }}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.candidateHeader}>
                          <Text style={[styles.candidateName, { color: rarityColor((item as any).rarity) }]}>
                            {item.name}
                          </Text>
                          <RarityBadge rarity={(item as any).rarity} />
                        </View>
                        {isGear && diff.length > 0 && (
                          <View style={styles.diffRow}>
                            {diff.map(d => (
                              <Text
                                key={d.key}
                                style={[
                                  styles.diffChip,
                                  { color: d.value > 0 ? COLORS.success : d.value < 0 ? COLORS.error : COLORS.textSecondary },
                                ]}
                              >
                                {d.key} {d.value > 0 ? `+${d.value}` : d.value}
                              </Text>
                            ))}
                          </View>
                        )}
                        {(item as Relic).passiveEffect && (
                          <Text style={styles.relicEffect} numberOfLines={2}>
                            {(item as Relic).passiveEffect}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Bag item row
// ---------------------------------------------------------------------------

interface BagRowProps {
  label: string
  qty: number
  rarity?: string
  sub?: string
}

const BagRow: React.FC<BagRowProps> = ({ label, qty, rarity = 'common', sub }) => (
  <View style={styles.bagRow}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.bagName, { color: rarityColor(rarity as any) }]}>{label}</Text>
      {sub ? <Text style={styles.bagSub}>{sub}</Text> : null}
    </View>
    <Text style={styles.bagQty}>×{qty}</Text>
  </View>
)

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function InventoryScreen() {
  const player = useStore(selectPlayer)
  const inventory = useStore(selectInventory)
  const equipped = useStore(selectEquipped)
  const equipGear = useStore(s => s.equipGear)
  const unequipGear = useStore(s => s.unequipGear)
  const equipRelic = useStore(s => s.equipRelic)
  const unequipRelic = useStore(s => s.unequipRelic)

  const [activeSlot, setActiveSlot] = useState<GearSlot | 'relic' | null>(null)

  const handleEquip = (item: GearItem | Relic) => {
    if (!activeSlot) return
    if (activeSlot === 'relic') equipRelic(item as Relic)
    else equipGear(item as GearItem)
  }

  const handleUnequip = () => {
    if (!activeSlot) return
    if (activeSlot === 'relic') unequipRelic()
    else unequipGear(activeSlot as keyof Omit<GearLoadout, 'relic'>)
    setActiveSlot(null)
  }

  const materialEntries = Object.entries(inventory.materials).filter(([, qty]) => qty > 0)
  const consumableEntries = Object.entries(inventory.consumables).filter(([, qty]) => qty > 0)

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>◆ INVENTORY ◆</Text>
          {player && <Text style={styles.screenSub}>{player.username}</Text>}
        </View>

        {/* Loadout */}
        <SectionHeader title="GEAR LOADOUT" />
        <View style={styles.loadoutGrid}>
          {(['weapon', 'armor', 'ring', 'relic'] as const).map(slot => (
            <SlotCard
              key={slot}
              slot={slot}
              item={slot === 'relic' ? equipped.relic : equipped[slot as keyof Omit<GearLoadout, 'relic'>]}
              onPress={() => setActiveSlot(slot)}
            />
          ))}
        </View>

        {/* Bag — Gear */}
        <SectionHeader title="BAG — GEAR" />
        {inventory.gear.length === 0 ? (
          <Text style={styles.emptyBag}>No gear in bag. Clear gates to earn drops.</Text>
        ) : (
          <CornerPanel>
            {inventory.gear.map((g, i) => (
              <TouchableOpacity
                key={g.instanceId ?? `${g.id}_${i}`}
                style={styles.bagRow}
                onPress={() => setActiveSlot(g.slot as GearSlot)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bagName, { color: rarityColor(g.rarity) }]}>{g.name}</Text>
                  <Text style={styles.bagSub}>
                    {Object.entries(g.statBonuses).map(([k, v]) => `${k} +${v}`).join('  ')}
                  </Text>
                </View>
                <RarityBadge rarity={g.rarity} />
              </TouchableOpacity>
            ))}
          </CornerPanel>
        )}

        {/* Relics in bag */}
        {inventory.relics.length > 0 && (
          <>
            <SectionHeader title="BAG — RELICS" />
            <CornerPanel>
              {inventory.relics.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.bagRow}
                  onPress={() => setActiveSlot('relic')}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bagName, { color: rarityColor(r.rarity) }]}>{r.name}</Text>
                    <Text style={styles.bagSub} numberOfLines={2}>{r.passiveEffect}</Text>
                  </View>
                  <RarityBadge rarity={r.rarity} />
                </TouchableOpacity>
              ))}
            </CornerPanel>
          </>
        )}

        {/* Materials */}
        {materialEntries.length > 0 && (
          <>
            <SectionHeader title="MATERIALS" />
            <CornerPanel>
              {materialEntries.map(([id, qty]) => (
                <BagRow key={id} label={id.replace('mat_', '').replace(/_/g, ' ').toUpperCase()} qty={qty} />
              ))}
            </CornerPanel>
          </>
        )}

        {/* Consumables */}
        {consumableEntries.length > 0 && (
          <>
            <SectionHeader title="CONSUMABLES" />
            <CornerPanel>
              {consumableEntries.map(([id, qty]) => (
                <BagRow key={id} label={id.replace('con_', '').replace(/_/g, ' ').toUpperCase()} qty={qty} />
              ))}
            </CornerPanel>
          </>
        )}

        {materialEntries.length === 0 && consumableEntries.length === 0 && (
          <Text style={styles.emptyBag}>Clear gates to earn materials and consumables.</Text>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <GearPickModal
        slot={activeSlot}
        inventory={inventory}
        equipped={equipped}
        onEquip={handleEquip}
        onUnequip={handleUnequip}
        onClose={() => setActiveSlot(null)}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xl },

  header: { alignItems: 'center', marginBottom: SPACING.lg },
  screenTitle: {
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.xl,
    color: COLORS.systemGold,
    letterSpacing: LETTER_SPACING.widest,
  },
  screenSub: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    letterSpacing: LETTER_SPACING.wide,
  },

  loadoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  slotCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.thin,
    borderColor: COLORS.systemBorder,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    minHeight: 90,
  },
  slotLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.system,
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: 4,
  },
  slotItemName: {
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.sm,
    marginBottom: 2,
  },
  slotBonuses: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  slotEmpty: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  slotTap: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textTertiary,
    marginTop: 6,
    letterSpacing: LETTER_SPACING.wide,
  },

  bagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLow,
  },
  bagName: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  bagSub: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bagQty: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.systemGold,
    minWidth: 30,
    textAlign: 'right',
  },

  emptyBag: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginVertical: SPACING.md,
    fontStyle: 'italic',
  },

  rarityBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rarityText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: LETTER_SPACING.wide,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: '92%', maxHeight: '85%' },
  candidateRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLow,
    paddingVertical: SPACING.sm,
  },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  candidateName: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    flex: 1,
  },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  diffChip: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  relicEffect: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  unequipBtn: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.thin,
    borderBottomColor: COLORS.systemAlert,
    marginBottom: SPACING.sm,
  },
  unequipText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.systemAlert,
    textAlign: 'center',
    letterSpacing: LETTER_SPACING.wide,
  },
  closeBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: LETTER_SPACING.wide,
  },
})
