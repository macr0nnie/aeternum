// =============================================================================
// Aeternum — Hunter Screen
// Unified scroll: Stats · Loadout · Skills · Bag  |  Craft (toggle)
// =============================================================================
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStore, selectPlayer, selectInventory, selectEquipped } from '@/store/useStore'
import {
  SystemWindow, CornerPanel, SectionHeader, StatBar, DungeonRankBadge,
  Label, Spacer,
} from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER,
  LETTER_SPACING, elementAccent, rarityColor,
} from '@/theme/tokens'
import { CRAFT_RECIPES, findMaterialById, findConsumableById, findGearById } from '@/data/items'
import {
  detectAllArchetypes, getNextTier, getArchetypeDef,
} from '@/data/archetypes'
import type { GearItem, Relic, GearLoadout, CraftRecipe, RecipeCategory, Element } from '@/types'
import {
  STAT_KEYS, STAT_SOURCES, ELEMENT_LABELS, ELEMENT_EMOJI,
  TRAIT_KEYS, TRAIT_LABELS, TRAIT_ICONS,
  PLAYER_SKILLS, type PlayerSkill, type TraitKey,
} from '@/types'
import { selectResources, selectUnlockedSkillIds, selectTraits } from '@/store/useStore'

const ARCHETYPE_ICONS: Record<string, string> = {
  pathfinder:    '🏔',
  vanguard:      '⚔️',
  quartermaster: '📦',
  sentinel:      '🛡️',
  cartographer:  '🗺️',
}

// =============================================================================
// Shared helpers
// =============================================================================

function canCraft(recipe: CraftRecipe, materials: Record<string, number>, consumables: Record<string, number>): boolean {
  return recipe.ingredients.every(ing => (materials[ing.itemId] ?? consumables[ing.itemId] ?? 0) >= ing.quantity)
}

function ingredientLabel(id: string): string {
  return findMaterialById(id)?.name ?? findConsumableById(id)?.name ?? id
}

// =============================================================================
// Stat diff helper
// =============================================================================

function gearStatDiff(equipped: GearLoadout, candidate: GearItem): Array<{ key: string; delta: number }> {
  const slot = candidate.slot as keyof Omit<GearLoadout, 'relic'>
  const current = equipped[slot]
  const keys = new Set([...Object.keys(candidate.statBonuses), ...(current ? Object.keys(current.statBonuses) : [])])
  return Array.from(keys).map(k => ({
    key: k,
    delta: ((candidate.statBonuses as Record<string, number>)[k] ?? 0) - ((current?.statBonuses as Record<string, number> | undefined)?.[k] ?? 0),
  }))
}

// =============================================================================
// Gear pick modal
// =============================================================================

interface GearPickModalProps {
  slot: keyof GearLoadout | null
  inventory: import('@/types').PlayerInventory
  equipped: GearLoadout
  onEquip: (item: GearItem | Relic) => void
  onUnequip: () => void
  onClose: () => void
}

function GearPickModal({ slot, inventory, equipped, onEquip, onUnequip, onClose }: GearPickModalProps) {
  if (!slot) return null
  const isRelic = slot === 'relic'
  const candidates = isRelic
    ? inventory.relics
    : inventory.gear.filter(g => g.slot === slot)
  const current = isRelic ? equipped.relic : equipped[slot as keyof Omit<GearLoadout, 'relic'>]

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <SystemWindow title={`◆ SELECT ${slot.toUpperCase()} ◆`} variant="info">
            {current && (
              <TouchableOpacity style={modal.unequip} onPress={() => { onUnequip(); onClose() }}>
                <Text style={modal.unequipTxt}>◈ UNEQUIP CURRENT</Text>
              </TouchableOpacity>
            )}
            <ScrollView style={{ maxHeight: 340 }}>
              {candidates.length === 0 ? (
                <Text style={modal.empty}>No {slot} items in bag.</Text>
              ) : candidates.map((item, i) => {
                const isGear = !isRelic
                const diffs = isGear ? gearStatDiff(equipped, item as GearItem) : []
                return (
                  <TouchableOpacity
                    key={`${item.id}_${i}`}
                    style={modal.candidateRow}
                    onPress={() => { onEquip(item); onClose() }}
                    activeOpacity={0.75}
                  >
                    <View style={modal.candidateHeader}>
                      <Text style={[modal.candidateName, { color: rarityColor((item as any).rarity) }]}>{item.name}</Text>
                      <View style={[modal.rarityBadge, { borderColor: rarityColor((item as any).rarity) }]}>
                        <Text style={[modal.rarityTxt, { color: rarityColor((item as any).rarity) }]}>
                          {(item as any).rarity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {isGear && diffs.length > 0 && (
                      <View style={modal.diffs}>
                        {diffs.map(d => (
                          <Text key={d.key} style={[modal.diff, { color: d.delta > 0 ? COLORS.success : d.delta < 0 ? COLORS.error : COLORS.textSecondary }]}>
                            {d.key} {d.delta > 0 ? `+${d.delta}` : d.delta}
                          </Text>
                        ))}
                      </View>
                    )}
                    {(item as Relic).passiveEffect && (
                      <Text style={modal.passive} numberOfLines={2}>{(item as Relic).passiveEffect}</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <Text style={modal.closeTxt}>CLOSE</Text>
            </TouchableOpacity>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  box: { width: '92%', maxHeight: '88%' },
  unequip: { paddingVertical: SPACING.sm, borderBottomWidth: BORDER.thin, borderBottomColor: COLORS.systemAlert, marginBottom: SPACING.sm },
  unequipTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemAlert, textAlign: 'center', letterSpacing: LETTER_SPACING.wide },
  candidateRow: { paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLow },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  candidateName: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, flex: 1 },
  rarityBadge: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  rarityTxt: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  diffs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  diff: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  passive: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  empty: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', marginVertical: SPACING.md },
  closeBtn: { marginTop: SPACING.md, paddingVertical: SPACING.sm, borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sm, alignItems: 'center' },
  closeTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
})

// =============================================================================
// Craft result modal
// =============================================================================

function CraftResultModal({ recipe, onClose }: { recipe: CraftRecipe | null; onClose: () => void }) {
  if (!recipe) return null
  const name = recipe.outputType === 'gear'
    ? findGearById(recipe.outputId)?.name ?? recipe.name
    : findConsumableById(recipe.outputId)?.name ?? recipe.name
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={[modal.box, { maxHeight: '60%' }]}>
          <SystemWindow title="◆ CRAFT COMPLETE ◆" variant="gold">
            <Text style={craft.resultName}>{name}</Text>
            {recipe.outputQuantity > 1 && <Text style={craft.resultQty}>×{recipe.outputQuantity} obtained</Text>}
            <Text style={craft.resultFlavor}>"{recipe.flavor}"</Text>
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <Text style={modal.closeTxt}>CLOSE</Text>
            </TouchableOpacity>
          </SystemWindow>
        </View>
      </View>
    </Modal>
  )
}

// =============================================================================
// Recipe card (owns expanded state — must be its own component for hooks)
// =============================================================================

interface RecipeCardProps {
  recipe: CraftRecipe
  inventory: import('@/types').PlayerInventory
  onCraft: (recipe: CraftRecipe) => void
}

function RecipeCard({ recipe, inventory, onCraft }: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const craftable = canCraft(recipe, inventory.materials, inventory.consumables)
  return (
    <TouchableOpacity
      style={[styles.recipeCard, !craftable && { opacity: 0.65 }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      <View style={[styles.recipeStripe, { backgroundColor: craftable ? COLORS.success : COLORS.textTertiary }]} />
      <View style={styles.recipeBody}>
        <Text style={[styles.recipeName, { color: craftable ? COLORS.textPrimary : COLORS.textSecondary }]}>{recipe.name}</Text>
        <Text style={styles.recipeOutput}>
          → {recipe.outputType === 'gear' ? findGearById(recipe.outputId)?.name : findConsumableById(recipe.outputId)?.name ?? recipe.name}
          {recipe.outputQuantity > 1 ? ` ×${recipe.outputQuantity}` : ''}
        </Text>
        {expanded && (
          <View style={{ marginTop: SPACING.xs }}>
            {recipe.ingredients.map(ing => (
              <Text key={ing.itemId} style={styles.ingredient}>• {ingredientLabel(ing.itemId)} ×{ing.quantity}</Text>
            ))}
            {recipe.flavor ? <Text style={styles.flavor}>"{recipe.flavor}"</Text> : null}
          </View>
        )}
        {craftable ? (
          <TouchableOpacity style={styles.craftBtn} onPress={() => onCraft(recipe)} activeOpacity={0.75}>
            <Text style={styles.craftBtnTxt}>◆ CRAFT ◆</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.ingredientMissing}>
            Need: {recipe.ingredients.map(ing => `${ingredientLabel(ing.itemId)} ×${ing.quantity}`).join(', ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// =============================================================================
// Main screen
// =============================================================================

export default function HunterScreen() {
  const player = useStore(selectPlayer)
  const inventory = useStore(selectInventory)
  const equipped = useStore(selectEquipped)
  const resources = useStore(selectResources)
  const unlockedSkillIds = useStore(selectUnlockedSkillIds)
  const traits = useStore(selectTraits)
  const { spendResources } = useStore()

  const activeArchetypes = detectAllArchetypes(traits)
  const primaryArchetype = activeArchetypes[0] ?? null
  const equipGear = useStore(s => s.equipGear)
  const unequipGear = useStore(s => s.unequipGear)
  const equipRelic = useStore(s => s.equipRelic)
  const unequipRelic = useStore(s => s.unequipRelic)
  const addGearToInventory = useStore(s => s.addGearToInventory)
  const addConsumable = useStore(s => s.addConsumable)
  const addMaterial = useStore(s => s.addMaterial)

  const [showCraft, setShowCraft] = useState(false)
  const [gearSlot, setGearSlot] = useState<keyof GearLoadout | null>(null)
  const [craftTab, setCraftTab] = useState<RecipeCategory>('forge')
  const [lastCrafted, setLastCrafted] = useState<CraftRecipe | null>(null)

  const element = player?.primary_element as Element | null
  const palette = elementAccent(element)
  const stats = (player?.stats ?? {}) as Record<string, number>

  const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S']
  const rankIdx = RANK_ORDER.indexOf(player?.rank ?? 'F')
  const recipes = CRAFT_RECIPES.filter(r => {
    if (r.category !== craftTab) return false
    if (!r.requiredRank) return true
    return rankIdx >= RANK_ORDER.indexOf(r.requiredRank)
  })

  function handleEquip(item: GearItem | Relic) {
    if (!gearSlot) return
    if (gearSlot === 'relic') equipRelic(item as Relic)
    else equipGear(item as GearItem)
  }

  function handleUnequip() {
    if (!gearSlot) return
    if (gearSlot === 'relic') unequipRelic()
    else unequipGear(gearSlot as keyof Omit<GearLoadout, 'relic'>)
    setGearSlot(null)
  }

  function handleCraft(recipe: CraftRecipe) {
    for (const ing of recipe.ingredients) {
      if (inventory.materials[ing.itemId] !== undefined) addMaterial(ing.itemId, -ing.quantity)
      else addConsumable(ing.itemId, -ing.quantity)
    }
    if (recipe.outputType === 'gear') {
      const gear = findGearById(recipe.outputId)
      if (gear) for (let i = 0; i < recipe.outputQuantity; i++) addGearToInventory(gear)
    } else {
      addConsumable(recipe.outputId, recipe.outputQuantity)
    }
    setLastCrafted(recipe)
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {player && <DungeonRankBadge rank={player.rank} size="sm" />}
          <View style={{ marginLeft: SPACING.sm }}>
            <Text style={styles.username}>{player?.username ?? '—'}</Text>
            <Text style={[styles.element, { color: palette.base }]}>
              {element ? ELEMENT_LABELS[element] : 'Unawakened'} · {player?.title ?? ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.distance}>{(player?.total_distance_km ?? 0).toFixed(1)} km</Text>
          <TouchableOpacity
            style={[styles.craftToggleBtn, showCraft && styles.craftToggleBtnActive]}
            onPress={() => setShowCraft(s => !s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.craftToggleTxt, showCraft && styles.craftToggleTxtActive]}>
              {showCraft ? '← PROFILE' : '⚔ CRAFT'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {!showCraft ? (
          <>
            {/* ── IDENTITY ── */}
            <SectionHeader title="IDENTITY" />
            {primaryArchetype ? (() => {
              const def = getArchetypeDef(primaryArchetype.id)
              const tierName = def?.tiers.find(t => t.rank === primaryArchetype.rank)?.name ?? primaryArchetype.id
              const nextTier = getNextTier(primaryArchetype.id, primaryArchetype.rank)
              return (
                <View style={identity.card}>
                  <View style={identity.cardHeader}>
                    <Text style={identity.archIcon}>{ARCHETYPE_ICONS[primaryArchetype.id] ?? '◆'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[identity.tierName, { color: palette.bright }]}>{tierName.toUpperCase()}</Text>
                      <Text style={identity.tierRank}>TIER {primaryArchetype.rank} / 5</Text>
                    </View>
                    {activeArchetypes.length > 1 && (
                      <View style={identity.multiTag}>
                        <Text style={identity.multiTagTxt}>+{activeArchetypes.length - 1} MORE</Text>
                      </View>
                    )}
                  </View>
                  {def && <Text style={identity.desc}>{def.description}</Text>}
                  {nextTier && (
                    <View style={identity.nextBlock}>
                      <Text style={identity.nextLabel}>NEXT: {nextTier.name.toUpperCase()}</Text>
                      {(Object.entries(nextTier.traitThresholds) as [string, number][]).map(([k, needed]) => {
                        const have = traits[k as TraitKey] ?? 0
                        const pct = Math.min(1, have / needed)
                        return (
                          <View key={k} style={identity.progressRow}>
                            <Text style={identity.progressLabel}>{TRAIT_ICONS[k as keyof typeof TRAIT_ICONS]} {TRAIT_LABELS[k as keyof typeof TRAIT_LABELS]} {have}/{needed}</Text>
                            <View style={identity.progressTrack}>
                              <View style={[identity.progressFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: palette.base }]} />
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )}
                  {!nextTier && primaryArchetype.rank === 5 && (
                    <Text style={[identity.nextLabel, { color: palette.bright, marginTop: SPACING.xs }]}>◆ MAX TIER REACHED ◆</Text>
                  )}
                </View>
              )
            })() : null}

            <Spacer size="xs" />

            {/* ── TRAITS ── */}
            <SectionHeader title="BEHAVIORAL TRAITS" />
            <View style={identity.traitGrid}>
              {TRAIT_KEYS.map(k => {
                const val = traits[k] ?? 0
                const active = val > 0
                return (
                  <View key={k} style={[identity.traitChip, active && { borderColor: palette.base + '60', backgroundColor: palette.dim }]}>
                    <Text style={identity.traitIcon}>{TRAIT_ICONS[k]}</Text>
                    <Text style={[identity.traitName, { color: active ? palette.bright : COLORS.textTertiary }]}>
                      {TRAIT_LABELS[k].toUpperCase()}
                    </Text>
                    <Text style={[identity.traitVal, { color: active ? palette.base : COLORS.textTertiary }]}>
                      {val}
                    </Text>
                  </View>
                )
              })}
            </View>

            <Spacer size="sm" />

            {/* ── STATS ── */}
            <SystemWindow title="HUNTER STATUS">
              {STAT_KEYS.map(k => (
                <View key={k}>
                  <StatBar statKey={k} value={stats[k] ?? 0} color={palette.base} />
                  <Text style={styles.statSource}>from: {STAT_SOURCES[k]}</Text>
                </View>
              ))}
              <Spacer size="xs" />
              <View style={styles.statRow}>
                <Label variant="tertiary" size="xs">Total power</Label>
                <Text style={[styles.powerVal, { color: palette.bright }]}>
                  {STAT_KEYS.reduce((s, k) => s + (stats[k] ?? 0), 0)}
                </Text>
              </View>
            </SystemWindow>

            <Spacer size="sm" />

            {/* ── LOADOUT ── */}
            <SectionHeader title="EQUIPPED GEAR" />
            <View style={styles.slotGrid}>
              {(['weapon', 'armor', 'ring', 'relic'] as const).map(slot => {
                const item = slot === 'relic' ? equipped.relic : equipped[slot as keyof Omit<GearLoadout, 'relic'>]
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotCard, item && { borderColor: rarityColor((item as any).rarity) }]}
                    onPress={() => setGearSlot(slot)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.slotLabel}>{slot.toUpperCase()}</Text>
                    {item ? (
                      <>
                        <Text style={[styles.slotName, { color: rarityColor((item as any).rarity) }]} numberOfLines={1}>{item.name}</Text>
                        {(item as GearItem).statBonuses && (
                          <Text style={styles.slotBonuses} numberOfLines={1}>
                            {Object.entries((item as GearItem).statBonuses).map(([k, v]) => `${k}+${v}`).join(' ')}
                          </Text>
                        )}
                        {(item as Relic).passiveEffect && (
                          <Text style={styles.slotBonuses} numberOfLines={2}>{(item as Relic).passiveEffect}</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.slotEmpty}>— EMPTY —</Text>
                    )}
                    <Text style={styles.slotCta}>TAP TO CHANGE</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Spacer size="sm" />

            {/* ── SKILLS ── */}
            <SectionHeader title="SKILLS" />
            <View style={styles.skillsManaRow}>
              <Text style={styles.skillsManaLabel}>💧 MANA</Text>
              <Text style={styles.skillsManaVal}>{resources.mana}</Text>
            </View>
            <Spacer size="xs" />
            {PLAYER_SKILLS.filter(s => unlockedSkillIds.includes(s.id)).map((skill: PlayerSkill) => {
              const elColor = skill.element
                ? elementAccent(skill.element as Element).base
                : COLORS.textTertiary
              const isActive = skill.activation === 'active'
              const canUse = isActive && (skill.manaCost ?? 0) <= resources.mana
              return (
                <View
                  key={skill.id}
                  style={[
                    styles.skillCard,
                    { borderColor: elColor + '80' },
                    isActive && { backgroundColor: elColor + '0d' },
                  ]}
                >
                  <View style={[styles.skillStripe, { backgroundColor: isActive ? elColor : COLORS.borderMid }]} />
                  <View style={styles.skillBody}>
                    <View style={styles.skillHeader}>
                      <Text style={styles.skillIcon}>{skill.icon}</Text>
                      <View style={styles.skillTitleGroup}>
                        <Text style={[styles.skillName, { color: elColor }]}>{skill.name}</Text>
                        <View style={styles.skillBadgeRow}>
                          <View style={[styles.actBadge, {
                            borderColor: isActive ? elColor : COLORS.borderMid,
                            backgroundColor: isActive ? elColor + '20' : COLORS.surfaceHigh,
                          }]}>
                            <Text style={[styles.actBadgeTxt, { color: isActive ? elColor : COLORS.textTertiary }]}>
                              {isActive ? '▶ ACTIVE' : '◈ PASSIVE'}
                            </Text>
                          </View>
                          {skill.element && (
                            <View style={[styles.elBadge, { borderColor: elColor + '60' }]}>
                              <Text style={styles.elBadgeTxt}>
                                {ELEMENT_EMOJI[skill.element as Element]} {ELEMENT_LABELS[skill.element as Element].toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.skillDesc}>{skill.description}</Text>
                    <Text style={[styles.skillEffect, { color: COLORS.success }]}>{skill.effect}</Text>
                    {isActive && (
                      <View style={styles.skillFooter}>
                        <Text style={styles.skillManaCost}>💧 {skill.manaCost ?? 0} mana</Text>
                        <TouchableOpacity
                          style={[styles.useBtn, !canUse && { opacity: 0.4 }]}
                          disabled={!canUse}
                          onPress={() => { if (canUse) spendResources({ mana: skill.manaCost ?? 0 }) }}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.useBtnTxt}>▶ USE</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}

            <Spacer size="sm" />

            {/* ── BAG ── */}
            <SectionHeader title="GEAR" />
            {inventory.gear.length === 0 ? (
              <Text style={styles.emptyNote}>No gear yet. Clear gates to earn drops.</Text>
            ) : (
              <CornerPanel>
                {inventory.gear.map((g, i) => (
                  <TouchableOpacity
                    key={g.instanceId ?? `${g.id}_${i}`}
                    style={styles.bagRow}
                    onPress={() => setGearSlot(g.slot as keyof GearLoadout)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bagName, { color: rarityColor(g.rarity) }]}>{g.name}</Text>
                      <Text style={styles.bagSub}>{Object.entries(g.statBonuses).map(([k, v]) => `${k} +${v}`).join('  ')}</Text>
                    </View>
                    <View style={[styles.rarityBadge, { borderColor: rarityColor(g.rarity) }]}>
                      <Text style={[styles.rarityTxt, { color: rarityColor(g.rarity) }]}>{g.rarity.toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </CornerPanel>
            )}

            {inventory.relics.length > 0 && (
              <>
                <SectionHeader title="RELICS" />
                <CornerPanel>
                  {inventory.relics.map(r => (
                    <TouchableOpacity key={r.id} style={styles.bagRow} onPress={() => setGearSlot('relic')} activeOpacity={0.75}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bagName, { color: rarityColor(r.rarity) }]}>{r.name}</Text>
                        <Text style={styles.bagSub} numberOfLines={2}>{r.passiveEffect}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </CornerPanel>
              </>
            )}

            {Object.keys(inventory.materials).length > 0 && (
              <>
                <SectionHeader title="MATERIALS" />
                <CornerPanel>
                  <View style={styles.chipGrid}>
                    {Object.entries(inventory.materials).filter(([, q]) => q > 0).map(([id, qty]) => (
                      <View key={id} style={styles.matChip}>
                        <Text style={styles.matName}>{ingredientLabel(id)}</Text>
                        <Text style={styles.matQty}>×{qty}</Text>
                      </View>
                    ))}
                  </View>
                </CornerPanel>
              </>
            )}

            {Object.keys(inventory.consumables).length > 0 && (
              <>
                <SectionHeader title="CONSUMABLES" />
                <CornerPanel>
                  <View style={styles.chipGrid}>
                    {Object.entries(inventory.consumables).filter(([, q]) => q > 0).map(([id, qty]) => (
                      <View key={id} style={styles.matChip}>
                        <Text style={styles.matName}>{ingredientLabel(id)}</Text>
                        <Text style={styles.matQty}>×{qty}</Text>
                      </View>
                    ))}
                  </View>
                </CornerPanel>
              </>
            )}

            {inventory.gear.length === 0 && Object.keys(inventory.materials).length === 0 && (
              <Text style={styles.emptyNote}>Your bag is empty. Clear gates to earn loot and materials.</Text>
            )}
          </>
        ) : (
          <>
            {/* ── CRAFT ── */}
            <View style={styles.craftTabs}>
              {(['forge', 'brew'] as RecipeCategory[]).map(ct => (
                <TouchableOpacity
                  key={ct}
                  style={[styles.craftTab, craftTab === ct && styles.craftTabActive]}
                  onPress={() => setCraftTab(ct)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.craftTabTxt, craftTab === ct && styles.craftTabTxtActive]}>
                    {ct === 'forge' ? '⚔  FORGE' : '⚗  BREW'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {Object.keys(inventory.materials).length > 0 && (
              <View style={styles.chipGrid}>
                {Object.entries(inventory.materials).filter(([, q]) => q > 0).map(([id, qty]) => (
                  <View key={id} style={styles.matChip}>
                    <Text style={styles.matName}>{ingredientLabel(id)}</Text>
                    <Text style={styles.matQty}>×{qty}</Text>
                  </View>
                ))}
              </View>
            )}

            <SectionHeader title={craftTab === 'forge' ? 'FORGE RECIPES' : 'BREW RECIPES'} />
            {recipes.length === 0 ? (
              <Text style={styles.emptyNote}>No {craftTab} recipes available at your rank.</Text>
            ) : recipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} inventory={inventory} onCraft={handleCraft} />
            ))}
          </>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <GearPickModal
        slot={gearSlot}
        inventory={inventory}
        equipped={equipped}
        onEquip={handleEquip}
        onUnequip={handleUnequip}
        onClose={() => setGearSlot(null)}
      />
      <CraftResultModal recipe={lastCrafted} onClose={() => setLastCrafted(null)} />
    </SafeAreaView>
  )
}

// =============================================================================
// Styles
// =============================================================================

const identity = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  archIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  tierName: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.md, letterSpacing: LETTER_SPACING.normal },
  tierRank: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, marginTop: 2 },
  multiTag: {
    borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  multiTagTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
  desc: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 17, marginBottom: SPACING.sm },
  nextBlock: { gap: SPACING.xs, paddingTop: SPACING.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLow },
  nextLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
  progressRow: { gap: 4 },
  progressLabel: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  progressTrack: { height: 4, backgroundColor: COLORS.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  emptyCard: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderLow,
    borderRadius: RADIUS.slight, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm,
  },
  emptyTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide, marginBottom: SPACING.xs },
  emptyDesc: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 17 },
  traitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  traitChip: {
    width: '31%', backgroundColor: COLORS.surface, borderWidth: BORDER.thin,
    borderColor: COLORS.borderLow, borderRadius: RADIUS.slight,
    padding: SPACING.sm, alignItems: 'center', gap: 2,
  },
  traitIcon: { fontSize: 18 },
  traitName: { fontFamily: FONTS.mono, fontSize: 8, letterSpacing: LETTER_SPACING.wide, textAlign: 'center' },
  traitVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, fontWeight: '700' },
})

const craft = StyleSheet.create({
  resultName: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.lg, color: COLORS.systemGold, textAlign: 'center', marginBottom: 4 },
  resultQty: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 4 },
  resultFlavor: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, fontStyle: 'italic', textAlign: 'center', marginBottom: SPACING.md },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs,
    borderBottomWidth: BORDER.thin, borderBottomColor: COLORS.borderLow,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { alignItems: 'flex-end', gap: SPACING.xs },
  username: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  element: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, marginTop: 2 },
  distance: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  craftToggleBtn: {
    borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  craftToggleBtnActive: { borderColor: COLORS.systemGold, backgroundColor: COLORS.systemGoldDim },
  craftToggleTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
  craftToggleTxtActive: { color: COLORS.systemGold },

  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Stats
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  powerVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg },
  statSource: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, marginTop: -2, marginBottom: SPACING.xs, marginLeft: 2, letterSpacing: LETTER_SPACING.normal },

  // Loadout grid
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  slotCard: {
    width: '47.5%', backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight, padding: SPACING.sm, minHeight: 90,
  },
  slotLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.system, letterSpacing: LETTER_SPACING.wide, marginBottom: 4 },
  slotName: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, marginBottom: 2 },
  slotBonuses: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textSecondary, lineHeight: 14 },
  slotEmpty: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, fontStyle: 'italic', marginTop: 4 },
  slotCta: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textTertiary, marginTop: 6, letterSpacing: LETTER_SPACING.wide },

  // Bag
  bagRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLow,
  },
  bagName: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  bagSub: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  rarityBadge: { borderWidth: 1, borderRadius: RADIUS.xs, paddingHorizontal: 5, paddingVertical: 2 },
  rarityTxt: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  matChip: {
    backgroundColor: COLORS.surfaceHigh, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 4,
    flexDirection: 'row', gap: 4, alignItems: 'center',
  },
  matName: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  matQty: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, fontWeight: '700' },
  emptyNote: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, textAlign: 'center', marginVertical: SPACING.md, fontStyle: 'italic' },

  // Skills
  skillsManaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: '#60a5fa40',
    borderRadius: RADIUS.slight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  skillsManaLabel: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: '#60a5fa', letterSpacing: LETTER_SPACING.wide },
  skillsManaVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: '#60a5fa' },
  skillCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderWidth: BORDER.thin, borderRadius: RADIUS.slight,
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  skillStripe: { width: 4 },
  skillBody: { flex: 1, padding: SPACING.sm, gap: 4 },
  skillHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  skillIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  skillTitleGroup: { flex: 1, gap: 4 },
  skillName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, letterSpacing: LETTER_SPACING.normal },
  skillBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  actBadge: {
    borderWidth: 1, borderRadius: RADIUS.sharp,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  actBadgeTxt: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  elBadge: {
    borderWidth: 1, borderRadius: RADIUS.sharp,
    paddingHorizontal: 5, paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  elBadgeTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textSecondary },
  lockedBadge: {
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: RADIUS.sharp,
    paddingHorizontal: 5, paddingVertical: 2, backgroundColor: COLORS.surfaceHigh,
  },
  lockedTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
  skillDesc: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 16 },
  skillEffect: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, letterSpacing: LETTER_SPACING.normal },
  skillFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  skillManaCost: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: '#60a5fa' },
  useBtn: {
    backgroundColor: '#1e3a5f', borderWidth: BORDER.thin, borderColor: '#60a5fa',
    borderRadius: RADIUS.sharp, paddingHorizontal: SPACING.md, paddingVertical: 4,
  },
  useBtnTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, color: '#60a5fa', letterSpacing: LETTER_SPACING.wide },

  // Craft sub-tabs
  craftTabs: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  craftTab: { flex: 1, paddingVertical: SPACING.sm, borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.sm, alignItems: 'center' },
  craftTabActive: { borderColor: COLORS.systemGold, backgroundColor: COLORS.systemGoldDim },
  craftTabTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, letterSpacing: LETTER_SPACING.wide },
  craftTabTxtActive: { color: COLORS.systemGold },

  // Recipe cards
  recipeCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid, borderRadius: RADIUS.slight, marginBottom: SPACING.sm, overflow: 'hidden' },
  recipeStripe: { width: 4 },
  recipeBody: { flex: 1, padding: SPACING.sm },
  recipeName: { fontFamily: FONTS.heading, fontSize: FONT_SIZES.sm, marginBottom: 2 },
  recipeOutput: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  ingredient: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 18 },
  flavor: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, fontStyle: 'italic', marginTop: 4 },
  ingredientMissing: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, fontStyle: 'italic', marginTop: SPACING.xs },
  craftBtn: { marginTop: SPACING.xs, backgroundColor: COLORS.systemGoldDim, borderWidth: BORDER.thin, borderColor: COLORS.systemGold, borderRadius: RADIUS.xs, paddingVertical: 6, alignItems: 'center' },
  craftBtnTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.systemGold, letterSpacing: LETTER_SPACING.wide },
})
