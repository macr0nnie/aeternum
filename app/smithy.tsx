// =============================================================================
// Aeternum — Smithy Screen (Forge + Brew)
// =============================================================================
import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native'
import { useStore, selectInventory, selectPlayer } from '@/store/useStore'
import { SystemWindow, CornerPanel, SectionHeader } from '@/components/UI'
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, BORDER, LETTER_SPACING } from '@/theme/tokens'
import { CRAFT_RECIPES, findMaterialById, findConsumableById, findGearById } from '@/data/items'
import type { CraftRecipe, RecipeCategory } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canCraft(recipe: CraftRecipe, materials: Record<string, number>, consumables: Record<string, number>): boolean {
  return recipe.ingredients.every(ing => {
    const have = materials[ing.itemId] ?? consumables[ing.itemId] ?? 0
    return have >= ing.quantity
  })
}

function ingredientLabel(id: string): string {
  const mat = findMaterialById(id)
  if (mat) return mat.name
  const con = findConsumableById(id)
  if (con) return con.name
  return id
}

function outputLabel(recipe: CraftRecipe): string {
  if (recipe.outputType === 'gear') {
    return findGearById(recipe.outputId)?.name ?? recipe.name
  }
  return findConsumableById(recipe.outputId)?.name ?? recipe.name
}

// ---------------------------------------------------------------------------
// Recipe card
// ---------------------------------------------------------------------------

interface RecipeCardProps {
  recipe: CraftRecipe
  craftable: boolean
  onCraft: () => void
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, craftable, onCraft }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <TouchableOpacity
      style={[styles.card, !craftable && styles.cardLocked]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      {/* Left rank stripe */}
      <View style={[styles.stripe, { backgroundColor: craftable ? COLORS.success : COLORS.textTertiary }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.recipeName, { color: craftable ? COLORS.textPrimary : COLORS.textSecondary }]}>
            {recipe.name}
          </Text>
          {recipe.requiredRank && (
            <View style={styles.rankChip}>
              <Text style={styles.rankChipText}>RANK {recipe.requiredRank}+</Text>
            </View>
          )}
        </View>

        <Text style={styles.outputLine}>
          → {outputLabel(recipe)}
          {recipe.outputQuantity > 1 ? ` ×${recipe.outputQuantity}` : ''}
        </Text>

        {expanded && (
          <View style={styles.ingredients}>
            {recipe.ingredients.map(ing => (
              <Text key={ing.itemId} style={styles.ingredient}>
                • {ingredientLabel(ing.itemId)} ×{ing.quantity}
              </Text>
            ))}
            {recipe.flavor && (
              <Text style={styles.flavor}>"{recipe.flavor}"</Text>
            )}
          </View>
        )}

        {craftable ? (
          <TouchableOpacity style={styles.craftBtn} onPress={(e) => { e.stopPropagation?.(); onCraft() }} activeOpacity={0.75}>
            <Text style={styles.craftBtnText}>◆ CRAFT ◆</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.missingRow}>
            <Text style={styles.missingText}>
              {recipe.ingredients
                .map(ing => `${ingredientLabel(ing.itemId)} ×${ing.quantity}`)
                .join(', ')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Craft result modal
// ---------------------------------------------------------------------------

interface CraftResultProps {
  recipe: CraftRecipe | null
  onClose: () => void
}

const CraftResultModal: React.FC<CraftResultProps> = ({ recipe, onClose }) => {
  if (!recipe) return null
  const label = outputLabel(recipe)
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <SystemWindow title="◆ CRAFT COMPLETE ◆" variant="gold">
            <Text style={styles.resultItem}>{label}</Text>
            {recipe.outputQuantity > 1 && (
              <Text style={styles.resultQty}>×{recipe.outputQuantity} obtained</Text>
            )}
            <Text style={styles.resultFlavor}>"{recipe.flavor}"</Text>
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
// Main screen
// ---------------------------------------------------------------------------

const TABS: { key: RecipeCategory; label: string }[] = [
  { key: 'forge', label: '⚔  FORGE' },
  { key: 'brew',  label: '⚗  BREW' },
]

export default function SmithyScreen() {
  const player = useStore(selectPlayer)
  const inventory = useStore(selectInventory)
  const addGearToInventory = useStore(s => s.addGearToInventory)
  const addConsumable = useStore(s => s.addConsumable)
  const addMaterial = useStore(s => s.addMaterial)

  const [tab, setTab] = useState<RecipeCategory>('forge')
  const [lastCrafted, setLastCrafted] = useState<CraftRecipe | null>(null)

  const playerRank = player?.rank ?? 'F'

  const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S']
  const rankIdx = RANK_ORDER.indexOf(playerRank)

  const recipes = CRAFT_RECIPES.filter(r => {
    if (r.category !== tab) return false
    if (!r.requiredRank) return true
    return rankIdx >= RANK_ORDER.indexOf(r.requiredRank)
  })

  function handleCraft(recipe: CraftRecipe) {
    for (const ing of recipe.ingredients) {
      if (inventory.materials[ing.itemId] !== undefined) {
        addMaterial(ing.itemId, -ing.quantity)
      } else {
        addConsumable(ing.itemId, -ing.quantity)
      }
    }

    if (recipe.outputType === 'gear') {
      const gear = findGearById(recipe.outputId)
      if (gear) {
        for (let i = 0; i < recipe.outputQuantity; i++) addGearToInventory(gear)
      }
    } else {
      addConsumable(recipe.outputId, recipe.outputQuantity)
    }

    setLastCrafted(recipe)
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>◆ SMITHY ◆</Text>
          <Text style={styles.screenSub}>FORGE · BREW · CRAFT</Text>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Material summary */}
        <SectionHeader title="YOUR MATERIALS" />
        {Object.keys(inventory.materials).length === 0 ? (
          <Text style={styles.emptyNote}>No materials yet. Clear gates to earn cores and fragments.</Text>
        ) : (
          <CornerPanel>
            <View style={styles.matGrid}>
              {Object.entries(inventory.materials)
                .filter(([, qty]) => qty > 0)
                .map(([id, qty]) => (
                  <View key={id} style={styles.matChip}>
                    <Text style={styles.matName}>{ingredientLabel(id)}</Text>
                    <Text style={styles.matQty}>×{qty}</Text>
                  </View>
                ))}
            </View>
          </CornerPanel>
        )}

        {/* Recipes */}
        <SectionHeader title={tab === 'forge' ? 'FORGE RECIPES' : 'BREW RECIPES'} />
        {recipes.length === 0 ? (
          <Text style={styles.emptyNote}>No {tab} recipes available at your rank.</Text>
        ) : (
          recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              craftable={canCraft(recipe, inventory.materials, inventory.consumables)}
              onCraft={() => handleCraft(recipe)}
            />
          ))
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <CraftResultModal recipe={lastCrafted} onClose={() => setLastCrafted(null)} />
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

  tabBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderColor: COLORS.systemGold,
    backgroundColor: COLORS.systemGoldDim,
  },
  tabText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    letterSpacing: LETTER_SPACING.wide,
  },
  tabTextActive: { color: COLORS.systemGold },

  matGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  matChip: {
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  matName: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  matQty: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.systemGold,
    fontWeight: '700',
  },

  emptyNote: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginVertical: SPACING.md,
    fontStyle: 'italic',
  },

  // Recipe card
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.thin,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  cardLocked: { opacity: 0.7 },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  recipeName: {
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  rankChip: {
    borderWidth: BORDER.thin,
    borderColor: COLORS.system,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rankChipText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.system,
    letterSpacing: LETTER_SPACING.wide,
  },
  outputLine: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  ingredients: { marginBottom: SPACING.xs },
  ingredient: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  flavor: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  craftBtn: {
    backgroundColor: COLORS.systemGoldDim,
    borderWidth: BORDER.thin,
    borderColor: COLORS.systemGold,
    borderRadius: RADIUS.xs,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  craftBtnText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.systemGold,
    letterSpacing: LETTER_SPACING.wide,
  },
  missingRow: { marginTop: SPACING.xs },
  missingText: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: '85%' },
  resultItem: {
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.lg,
    color: COLORS.systemGold,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultQty: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultFlavor: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  closeBtn: {
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
