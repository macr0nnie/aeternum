// =============================================================================
// Aeternum — Fortress Screen (Sovereign Base)
// Korean RPG status menu: element affinity, defense loadout, passive gardens
// =============================================================================
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  useStore, selectPlayer, selectResources, selectFortress,
  selectMyTerritories, selectCrops, selectUnlockedSkillIds,
} from '@/store/useStore'
import { SystemWindow, SectionHeader, Label, Spacer } from '@/components/UI'
import {
  COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING, elementAccent,
  SHADOWS,
} from '@/theme/tokens'
import {
  fetchPlayerResources, upsertPlayerResources, fetchFortress, upsertFortress,
  fetchMyTerritories, fetchFortressCrops, plantCrop, harvestCrop, removeCrop,
  saveDefenseSlots, fetchPlayerSkills, unlockSkill as serverUnlockSkill,
} from '@/lib/supabase'
import {
  RESOURCE_ICONS, TYPE_MATCHUP_CHART, ELEMENT_LABELS, ALL_SKILLS, BASE_SKILLS,
  CROP_CONFIG,
  type Element, type Territory, type FortressCrop, type CropType,
  type DefenseSlot, type PlayerResources, type Fortress,
} from '@/types'
import type { Element as ElementType } from '@/types'

// =============================================================================
// Resource bar
// =============================================================================

function ResourceBar() {
  const resources = useStore(selectResources)
  const types = (['iron', 'crystal', 'mana', 'herbs', 'gold'] as const)
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
// Element weakness row
// =============================================================================

const ELEMENT_EMOJI: Record<string, string> = {
  fire: '🔥', water: '💧', nature: '🌿', arcane: '🔮',
  shadow: '🌑', frost: '❄', earth: '⛰', harvest: '🌾',
  forge: '⚒', mending: '✨',
}

function ElementStatus({ element }: { element: Element | null }) {
  if (!element) {
    return (
      <View style={el.row}>
        <Label variant="tertiary" size="xs">ELEMENT</Label>
        <Text style={el.none}>— Not assigned</Text>
      </View>
    )
  }
  const matchup = TYPE_MATCHUP_CHART[element]
  const weakTo = Object.entries(matchup)
    .filter(([, v]) => v === 2)
    .map(([k]) => k as Element)
  const resistTo = Object.entries(matchup)
    .filter(([, v]) => v === 0.5)
    .map(([k]) => k as Element)

  return (
    <View style={el.container}>
      <View style={el.row}>
        <Label variant="tertiary" size="xs">ELEMENT</Label>
        <View style={[el.badge, { borderColor: elementAccent(element).base, backgroundColor: elementAccent(element).dim }]}>
          <Text style={el.badgeIcon}>{ELEMENT_EMOJI[element] ?? '◆'}</Text>
          <Text style={[el.badgeTxt, { color: elementAccent(element).base }]}>{ELEMENT_LABELS[element].toUpperCase()}</Text>
        </View>
      </View>
      {weakTo.length > 0 && (
        <View style={el.row}>
          <Label variant="tertiary" size="xs">WEAK TO</Label>
          <View style={el.tagRow}>
            {weakTo.map(e => (
              <View key={e} style={[el.weakTag, { borderColor: COLORS.systemAlert + '80' }]}>
                <Text style={el.weakTxt}>{ELEMENT_EMOJI[e] ?? ''} {ELEMENT_LABELS[e].toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {resistTo.length > 0 && (
        <View style={el.row}>
          <Label variant="tertiary" size="xs">RESISTS</Label>
          <View style={el.tagRow}>
            {resistTo.slice(0, 3).map(e => (
              <View key={e} style={[el.resistTag, { borderColor: COLORS.success + '60' }]}>
                <Text style={el.resistTxt}>{ELEMENT_EMOJI[e] ?? ''} {ELEMENT_LABELS[e].toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

const el = StyleSheet.create({
  container: { gap: SPACING.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  none: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: BORDER.thin, borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  badgeIcon: { fontSize: 14 },
  badgeTxt: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xs, letterSpacing: LETTER_SPACING.wide },
  tagRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  weakTag: {
    borderWidth: BORDER.thin, borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2, paddingVertical: 2,
    backgroundColor: COLORS.error + '10',
  },
  weakTxt: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.systemAlert },
  resistTag: {
    borderWidth: BORDER.thin, borderRadius: RADIUS.sharp,
    paddingHorizontal: SPACING.xs + 2, paddingVertical: 2,
    backgroundColor: COLORS.success + '10',
  },
  resistTxt: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.success },
})

// =============================================================================
// Defense slot grid
// =============================================================================

const SLOT_COUNT = 5

interface DefenseSlotGridProps {
  slots: DefenseSlot[]
  unlockedSkillIds: string[]
  onSlotPress: (index: number) => void
}

function DefenseSlotGrid({ slots, unlockedSkillIds, onSlotPress }: DefenseSlotGridProps) {
  const filledMap = new Map(slots.map(s => [s.slot_index, s.skill_id]))
  return (
    <View style={ds.grid}>
      {Array.from({ length: SLOT_COUNT }, (_, i) => {
        const skillId = filledMap.get(i) ?? null
        const skill = skillId ? ALL_SKILLS.find(s => s.id === skillId) : null
        return (
          <TouchableOpacity key={i} style={[ds.slot, skill && ds.slotFilled]} onPress={() => onSlotPress(i)} activeOpacity={0.75}>
            {skill ? (
              <>
                <Text style={ds.slotIcon}>{skill.icon}</Text>
                <Text style={ds.slotName} numberOfLines={2}>{skill.name}</Text>
                <Text style={ds.slotEffect} numberOfLines={1}>{skill.effect}</Text>
              </>
            ) : (
              <>
                <Text style={ds.emptyIcon}>⊕</Text>
                <Text style={ds.emptyLabel}>SLOT {i + 1}</Text>
                {unlockedSkillIds.length === 0 && <Text style={ds.emptyHint}>Clear dungeons</Text>}
              </>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const ds = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  slot: {
    width: '30%', minHeight: 90, flexGrow: 1,
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid, borderRadius: RADIUS.slight,
    alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xs, gap: 3,
  },
  slotFilled: { borderColor: COLORS.system + '80', backgroundColor: COLORS.systemDim },
  slotIcon: { fontSize: 24 },
  slotName: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textPrimary, textAlign: 'center', letterSpacing: LETTER_SPACING.normal },
  slotEffect: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textTertiary, textAlign: 'center' },
  emptyIcon: { fontSize: 20, color: COLORS.borderMid },
  emptyLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
  emptyHint: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textTertiary, fontStyle: 'italic', textAlign: 'center' },
})

// =============================================================================
// Gardens (crop slots)
// =============================================================================

function cropReadyMs(crop: FortressCrop): number {
  const cfg = CROP_CONFIG[crop.crop_type as CropType]
  const base = crop.last_harvested_at ? new Date(crop.last_harvested_at).getTime() : new Date(crop.planted_at).getTime()
  return base + cfg.cooldownHours * 3_600_000 - Date.now()
}

function cropLabel(crop: FortressCrop): string {
  const ms = cropReadyMs(crop)
  if (ms <= 0) return 'READY!'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const CROP_TYPES: CropType[] = ['herb_garden', 'iron_mine', 'mana_pool', 'crystal_vein', 'gold_deposit']

interface GardenSlotsProps {
  crops: FortressCrop[]
  onHarvest: (crop: FortressCrop) => void
  onPlant: (slotIndex: number) => void
  onRemove: (crop: FortressCrop) => void
}

const GARDEN_SLOTS = 4

function GardenSlots({ crops, onHarvest, onPlant, onRemove }: GardenSlotsProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const cropMap = new Map(crops.map(c => [c.slot_index, c]))

  return (
    <View style={gd.grid}>
      {Array.from({ length: GARDEN_SLOTS }, (_, i) => {
        const crop = cropMap.get(i)
        const cfg = crop ? CROP_CONFIG[crop.crop_type as CropType] : null
        const ready = crop ? cropReadyMs(crop) <= 0 : false
        return (
          <View key={i} style={[gd.slot, ready && gd.slotReady]}>
            {crop && cfg ? (
              <>
                <Text style={gd.cropIcon}>{cfg.icon}</Text>
                <Text style={gd.cropName}>{cfg.label}</Text>
                <Text style={[gd.cropTimer, ready && { color: COLORS.success }]}>{cropLabel(crop)}</Text>
                <View style={gd.cropActions}>
                  {ready && (
                    <TouchableOpacity style={gd.harvestBtn} onPress={() => onHarvest(crop)} activeOpacity={0.75}>
                      <Text style={gd.harvestTxt}>HARVEST</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => onRemove(crop)} activeOpacity={0.75}>
                    <Text style={gd.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={gd.emptyInner} onPress={() => onPlant(i)} activeOpacity={0.75}>
                <Text style={gd.emptyIcon}>⊕</Text>
                <Text style={gd.emptyLabel}>PLANT</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      })}
    </View>
  )
}

const gd = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  slot: {
    width: '47%', flexGrow: 1, minHeight: 100,
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid, borderRadius: RADIUS.slight,
    alignItems: 'center', justifyContent: 'center', padding: SPACING.sm, gap: 4,
  },
  slotReady: { borderColor: COLORS.success + '80', backgroundColor: COLORS.success + '08' },
  cropIcon: { fontSize: 28 },
  cropName: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textPrimary, textAlign: 'center', letterSpacing: LETTER_SPACING.normal },
  cropTimer: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, fontWeight: '700' },
  cropActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  harvestBtn: {
    backgroundColor: COLORS.success + '20', borderWidth: BORDER.thin, borderColor: COLORS.success,
    borderRadius: RADIUS.sharp, paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  harvestTxt: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.success, letterSpacing: LETTER_SPACING.wide },
  removeBtn: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.textTertiary, paddingHorizontal: 4 },
  emptyInner: { alignItems: 'center', gap: 4 },
  emptyIcon: { fontSize: 22, color: COLORS.borderMid },
  emptyLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
})

// =============================================================================
// Territory item
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLow,
  },
  flag: {
    width: 36, height: 36, backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.xs, alignItems: 'center', justifyContent: 'center',
  },
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
  const crops = useStore(selectCrops)
  const unlockedSkillIds = useStore(selectUnlockedSkillIds)
  const { setResources, setFortress, setMyTerritories, setCrops, addResource, unlockSkill } = useStore()

  const [refreshing, setRefreshing] = useState(false)
  const [slotModal, setSlotModal] = useState<number | null>(null)    // which slot is being edited
  const [plantModal, setPlantModal] = useState<number | null>(null)  // which garden slot to plant

  const element = (player?.primary_element ?? fortress.element) as ElementType | null
  const palette = elementAccent(element)

  const load = useCallback(async () => {
    if (!player) return
    const [resData, fortData, terrData, cropsData, skillsData] = await Promise.all([
      fetchPlayerResources(player.id),
      fetchFortress(player.id),
      fetchMyTerritories(player.id),
      fetchFortressCrops(player.id),
      fetchPlayerSkills(player.id),
    ])
    if (resData.data) {
      const r = resData.data
      setResources({ influence: r.influence ?? 0, iron: r.iron ?? 0, crystal: r.crystal ?? 0, mana: r.mana_res ?? 0, herbs: r.herbs ?? 0, gold: r.gold_res ?? 0 })
    }
    if (fortData.data) setFortress({
      level: fortData.data.level,
      barracks_level: fortData.data.barracks_level ?? 0,
      walls_level: fortData.data.walls_level ?? 0,
      forge_level: fortData.data.forge_level ?? 0,
      element: (fortData.data.element as ElementType | null) ?? null,
      defense_slots: (fortData.data.defense_slots as import('@/types').DefenseSlot[]) ?? [],
    })
    if (terrData.data) setMyTerritories(terrData.data as Territory[])
    if (cropsData.data) setCrops(cropsData.data as FortressCrop[])
    if (skillsData.data) {
      for (const row of skillsData.data) unlockSkill(row.skill_id)
    }
  }, [player, setResources, setFortress, setMyTerritories, setCrops, unlockSkill])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false)
  }, [load])

  // Defense slot management
  async function handleEquipSkill(slotIndex: number, skillId: string) {
    if (!player) return
    const next: DefenseSlot[] = [
      ...fortress.defense_slots.filter(s => s.slot_index !== slotIndex),
      { slot_index: slotIndex, skill_id: skillId },
    ]
    setFortress({ ...fortress, defense_slots: next })
    setSlotModal(null)
    await saveDefenseSlots(player.id, next)
  }

  async function handleRemoveSkill(slotIndex: number) {
    if (!player) return
    const next = fortress.defense_slots.filter(s => s.slot_index !== slotIndex)
    setFortress({ ...fortress, defense_slots: next })
    setSlotModal(null)
    await saveDefenseSlots(player.id, next)
  }

  // Crop management
  async function handlePlantCrop(slotIndex: number, cropType: CropType) {
    if (!player) return
    setPlantModal(null)
    await plantCrop(player.id, slotIndex, cropType)
    const { data } = await fetchFortressCrops(player.id)
    if (data) setCrops(data as FortressCrop[])
  }

  async function handleHarvestCrop(crop: FortressCrop) {
    if (!player) return
    const cfg = CROP_CONFIG[crop.crop_type as CropType]
    const { data } = await harvestCrop(crop.id)
    if (data) {
      addResource(cfg.resource, cfg.yieldAmount)
      setCrops(crops.map(c => c.id === crop.id ? (data as FortressCrop) : c))
      // Persist new resource totals
      const fresh = useStore.getState().resources
      await upsertPlayerResources(player.id, {
        influence: fresh.influence, iron: fresh.iron, crystal: fresh.crystal,
        mana_res: fresh.mana, herbs: fresh.herbs, gold_res: fresh.gold,
      })
    }
  }

  async function handleRemoveCrop(crop: FortressCrop) {
    if (!player) return
    await removeCrop(player.id, crop.slot_index)
    setCrops(crops.filter(c => c.id !== crop.id))
  }

  // The slot being pressed — derive what's equipped
  const activeSlotSkillId = slotModal !== null
    ? (fortress.defense_slots.find(s => s.slot_index === slotModal)?.skill_id ?? null)
    : null
  const unlockedBaseSkills = BASE_SKILLS.filter(s => unlockedSkillIds.includes(s.id))

  // Defense rating (rough sum of base skill count × 20)
  const defRating = fortress.defense_slots.filter(s => s.skill_id).length * 20 +
    myTerritories.length * 5

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.base} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.base }]}>◆ SOVEREIGN BASE ◆</Text>
          <Text style={styles.sub}>{player?.username ?? '—'} · Level {fortress.level}</Text>
        </View>

        {/* Resource bar */}
        <ResourceBar />

        {/* ── Base Status panel ── */}
        <SystemWindow title="BASE STATUS">
          <ElementStatus element={element} />
          <Spacer size="sm" />
          <View style={styles.statusRow}>
            <Label variant="tertiary" size="xs">DEF RATING</Label>
            <View style={styles.defBar}>
              <View style={[styles.defFill, { width: `${Math.min(100, defRating)}%` as any, backgroundColor: palette.base }]} />
            </View>
            <Text style={[styles.defVal, { color: palette.base }]}>{defRating}</Text>
          </View>
          <View style={styles.statusRow}>
            <Label variant="tertiary" size="xs">TERRITORIES</Label>
            <Text style={styles.statusVal}>{myTerritories.length}</Text>
          </View>
          <View style={styles.statusRow}>
            <Label variant="tertiary" size="xs">RANK</Label>
            <Text style={styles.statusVal}>{player?.rank ?? 'F'}</Text>
          </View>
        </SystemWindow>

        {/* ── Defense Loadout ── */}
        <SectionHeader title="DEFENSE LOADOUT" color={palette.base} />
        {unlockedBaseSkills.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintTxt}>
              No base skills unlocked yet. Clear dungeons and sync runs to receive base skill rewards.
            </Text>
          </View>
        )}
        <DefenseSlotGrid
          slots={fortress.defense_slots}
          unlockedSkillIds={unlockedSkillIds}
          onSlotPress={(i) => setSlotModal(i)}
        />

        {/* ── Gardens ── */}
        <Spacer size="md" />
        <SectionHeader title="GARDENS" color={palette.base} />
        <GardenSlots
          crops={crops}
          onHarvest={handleHarvestCrop}
          onPlant={(i) => setPlantModal(i)}
          onRemove={handleRemoveCrop}
        />

        {/* ── Territories ── */}
        <Spacer size="md" />
        <SectionHeader title={`TERRITORIES (${myTerritories.length})`} />
        {myTerritories.length === 0 ? (
          <SystemWindow title="NO TERRITORIES" variant="info">
            <Text style={styles.emptyHintTxt}>
              Go to the World map and claim your first territory.
              Costs ◆ 50 Influence.
            </Text>
          </SystemWindow>
        ) : (
          <View style={styles.terrList}>
            {myTerritories.map(t => <TerritoryItem key={t.id} territory={t} />)}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* ── Defense slot modal ── */}
      <Modal visible={slotModal !== null} transparent animationType="fade" onRequestClose={() => setSlotModal(null)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <SystemWindow title={`DEFENSE SLOT ${(slotModal ?? 0) + 1}`} variant="info">
              {activeSlotSkillId && (
                <>
                  {(() => {
                    const skill = ALL_SKILLS.find(s => s.id === activeSlotSkillId)
                    if (!skill) return null
                    return (
                      <View style={modal.equippedRow}>
                        <Text style={modal.equippedIcon}>{skill.icon}</Text>
                        <View style={modal.equippedInfo}>
                          <Text style={modal.equippedName}>{skill.name}</Text>
                          <Text style={modal.equippedEffect}>{skill.effect}</Text>
                        </View>
                      </View>
                    )
                  })()}
                  <TouchableOpacity
                    style={modal.removeBtn}
                    onPress={() => slotModal !== null && handleRemoveSkill(slotModal)}
                    activeOpacity={0.75}
                  >
                    <Text style={modal.removeTxt}>✕  REMOVE SKILL</Text>
                  </TouchableOpacity>
                  <Spacer size="sm" />
                </>
              )}
              {unlockedBaseSkills.length === 0 ? (
                <Text style={modal.noSkills}>No base skills unlocked yet.</Text>
              ) : (
                <>
                  <Label variant="tertiary" size="xs">SELECT A SKILL TO EQUIP</Label>
                  <Spacer size="xs" />
                  {unlockedBaseSkills.map(skill => (
                    <TouchableOpacity
                      key={skill.id}
                      style={[modal.skillRow, skill.id === activeSlotSkillId && modal.skillRowActive]}
                      onPress={() => slotModal !== null && handleEquipSkill(slotModal, skill.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={modal.skillIcon}>{skill.icon}</Text>
                      <View style={modal.skillInfo}>
                        <Text style={modal.skillName}>{skill.name}</Text>
                        <Text style={modal.skillEffect}>{skill.effect}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <Spacer size="sm" />
              <TouchableOpacity style={modal.closeBtn} onPress={() => setSlotModal(null)} activeOpacity={0.75}>
                <Text style={modal.closeTxt}>CLOSE</Text>
              </TouchableOpacity>
            </SystemWindow>
          </View>
        </View>
      </Modal>

      {/* ── Plant crop modal ── */}
      <Modal visible={plantModal !== null} transparent animationType="fade" onRequestClose={() => setPlantModal(null)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <SystemWindow title="SELECT CROP" variant="info">
              <Label variant="tertiary" size="xs">{`CHOOSE WHAT TO PLANT IN SLOT ${(plantModal ?? 0) + 1}`}</Label>
              <Spacer size="sm" />
              {CROP_TYPES.map(ct => {
                const cfg = CROP_CONFIG[ct]
                return (
                  <TouchableOpacity
                    key={ct}
                    style={modal.skillRow}
                    onPress={() => plantModal !== null && handlePlantCrop(plantModal, ct)}
                    activeOpacity={0.75}
                  >
                    <Text style={modal.skillIcon}>{cfg.icon}</Text>
                    <View style={modal.skillInfo}>
                      <Text style={modal.skillName}>{cfg.label}</Text>
                      <Text style={modal.skillEffect}>
                        +{cfg.yieldAmount} {cfg.resource} every {cfg.cooldownHours}h
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
              <Spacer size="sm" />
              <TouchableOpacity style={modal.closeBtn} onPress={() => setPlantModal(null)} activeOpacity={0.75}>
                <Text style={modal.closeTxt}>CANCEL</Text>
              </TouchableOpacity>
            </SystemWindow>
          </View>
        </View>
      </Modal>
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
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: 4,
  },
  defBar: {
    flex: 1, height: 4, backgroundColor: COLORS.surfaceHigh,
    borderRadius: 2, overflow: 'hidden',
  },
  defFill: { height: 4, borderRadius: 2 },
  defVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, width: 36, textAlign: 'right' },
  statusVal: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  emptyHint: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderLow,
    borderRadius: RADIUS.slight, padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  emptyHintTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, lineHeight: 18 },
  terrList: {
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.slight, paddingHorizontal: SPACING.sm,
  },
})

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  sheet: { width: '100%' },
  equippedRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.systemDim, borderWidth: BORDER.thin,
    borderColor: COLORS.systemBorder, borderRadius: RADIUS.slight,
    padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  equippedIcon: { fontSize: 28 },
  equippedInfo: { flex: 1 },
  equippedName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  equippedEffect: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.system, marginTop: 2 },
  removeBtn: {
    borderWidth: BORDER.thin, borderColor: COLORS.error + '60', borderRadius: RADIUS.sharp,
    paddingVertical: SPACING.xs, alignItems: 'center',
  },
  removeTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.error, letterSpacing: LETTER_SPACING.wide },
  noSkills: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, lineHeight: 18 },
  skillRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm, marginBottom: SPACING.xs,
    backgroundColor: COLORS.surface, borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid, borderRadius: RADIUS.slight,
  },
  skillRowActive: { borderColor: COLORS.system, backgroundColor: COLORS.systemDim },
  skillIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  skillInfo: { flex: 1 },
  skillName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  skillEffect: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  closeBtn: {
    borderWidth: BORDER.thin, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sharp, paddingVertical: SPACING.sm, alignItems: 'center',
  },
  closeTxt: { fontFamily: FONTS.mono, fontSize: FONT_SIZES.xs, color: COLORS.textTertiary, letterSpacing: LETTER_SPACING.wide },
})
