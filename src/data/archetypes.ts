
import type {
  ArchetypeDefinition, ArchetypeId, ActiveArchetype,
  PlayerTraits, TraitKey, ArchetypeTierDef,
} from '@/types'

export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'pathfinder',
    primaryTraits: ['endurance', 'exploration'],
    description: 'A wanderer who finds purpose in distance and discovery.',
    tiers: [
      { rank: 1, name: 'Pathfinder I',            traitThresholds: { endurance: 15,  exploration: 10  } },
      { rank: 2, name: 'Pathfinder II',           traitThresholds: { endurance: 40,  exploration: 28  } },
      { rank: 3, name: 'Pathfinder III',          traitThresholds: { endurance: 80,  exploration: 55  } },
      { rank: 4, name: 'Trailblazer',             traitThresholds: { endurance: 130, exploration: 90  } },
      { rank: 5, name: 'Warden of the Long Road', traitThresholds: { endurance: 200, exploration: 145 } },
    ],
  },
  {
    id: 'vanguard',
    primaryTraits: ['strength', 'conquest'],
    description: 'A warrior who claims territory through force and persistence.',
    tiers: [
      { rank: 1, name: 'Vanguard I',      traitThresholds: { strength: 15,  conquest: 10  } },
      { rank: 2, name: 'Vanguard II',     traitThresholds: { strength: 40,  conquest: 28  } },
      { rank: 3, name: 'Vanguard III',    traitThresholds: { strength: 80,  conquest: 55  } },
      { rank: 4, name: 'Warlord',         traitThresholds: { strength: 130, conquest: 90  } },
      { rank: 5, name: 'Iron Grandmaster',  traitThresholds: { strength: 200, conquest: 145 } },
    ],
  },
  {
    id: 'quartermaster',
    primaryTraits: ['gathering', 'consistency'],
    description: 'A provider who sustains through steady effort and methodical harvesting.',
    tiers: [
      { rank: 1, name: 'Quartermaster I',   traitThresholds: { gathering: 15,  consistency: 10  } },
      { rank: 2, name: 'Quartermaster II',  traitThresholds: { gathering: 40,  consistency: 28  } },
      { rank: 3, name: 'Quartermaster III', traitThresholds: { gathering: 80,  consistency: 55  } },
      { rank: 4, name: 'Provisioner',       traitThresholds: { gathering: 130, consistency: 90  } },
      { rank: 5, name: 'Lord of Supplies',  traitThresholds: { gathering: 200, consistency: 145 } },
    ],
  },
  {
    id: 'sentinel',
    primaryTraits: ['consistency', 'conquest'],
    description: 'A defender who holds ground through unwavering discipline.',
    tiers: [
      { rank: 1, name: 'Sentinel I',          traitThresholds: { consistency: 15,  conquest: 10  } },
      { rank: 2, name: 'Sentinel II',         traitThresholds: { consistency: 40,  conquest: 28  } },
      { rank: 3, name: 'Sentinel III',        traitThresholds: { consistency: 80,  conquest: 55  } },
      { rank: 4, name: 'Guardian',            traitThresholds: { consistency: 130, conquest: 90  } },
      { rank: 5, name: 'Keeper of the Realm', traitThresholds: { consistency: 200, conquest: 145 } },
    ],
  },
  {
    id: 'cartographer',
    primaryTraits: ['exploration', 'mastery'],
    description: 'A scholar who charts the unknown and masters its secrets.',
    tiers: [
      { rank: 1, name: 'Cartographer I',      traitThresholds: { exploration: 15,  mastery: 10  } },
      { rank: 2, name: 'Cartographer II',     traitThresholds: { exploration: 40,  mastery: 28  } },
      { rank: 3, name: 'Cartographer III',    traitThresholds: { exploration: 80,  mastery: 55  } },
      { rank: 4, name: 'Surveyor',            traitThresholds: { exploration: 130, mastery: 90  } },
      { rank: 5, name: 'Master of the Unseen',traitThresholds: { exploration: 200, mastery: 145 } },
    ],
  },
]

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function highestEarnedRank(arch: ArchetypeDefinition, traits: PlayerTraits): number {
  let highest = 0
  for (const tier of arch.tiers) {
    const met = (Object.entries(tier.traitThresholds) as [TraitKey, number][]).every(
      ([k, v]) => (traits[k] ?? 0) >= v,
    )
    if (met) highest = tier.rank
  }
  return highest
}

// Returns all archetypes the player has earned, sorted by rank desc.
// Multiple archetypes can be active simultaneously at lower tiers.
export function detectAllArchetypes(traits: PlayerTraits): ActiveArchetype[] {
  const results: ActiveArchetype[] = []
  for (const arch of ARCHETYPES) {
    const rank = highestEarnedRank(arch, traits)
    if (rank > 0) results.push({ id: arch.id, rank })
  }
  return results.sort((a, b) => b.rank - a.rank)
}

// Returns the single "primary" archetype — highest rank, tie broken by
// raw trait sum of the two primary traits.
export function detectPrimaryArchetype(traits: PlayerTraits): ActiveArchetype | null {
  return detectAllArchetypes(traits)[0] ?? null
}

export function getArchetypeDef(id: ArchetypeId): ArchetypeDefinition | undefined {
  return ARCHETYPES.find(a => a.id === id)
}

export function getArchetypeTierName(id: ArchetypeId, rank: number): string {
  return getArchetypeDef(id)?.tiers.find(t => t.rank === rank)?.name ?? id
}

export function getNextTier(id: ArchetypeId, currentRank: number): ArchetypeTierDef | null {
  return getArchetypeDef(id)?.tiers.find(t => t.rank === currentRank + 1) ?? null
}
