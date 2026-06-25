import type { Locale, RunResult, WeaknessVector } from '@/game/types'
import {
  evaluateUnlocks,
  ownedPerkIds,
  unlockedModifierIds,
  type Unlock,
} from '@/game/progression'
import { registerUnlocked } from '@/game/modifiers'

const STORAGE_KEY = 'keystorm:progress'

interface PersistedProgress {
  vectors: Record<Locale, WeaknessVector>
  best: Record<Locale, number>
  lastResult: RunResult | null
  /** Ids of every unlock the player has permanently earned across runs. */
  unlocks: string[]
}

function defaultVectors(): Record<Locale, WeaknessVector> {
  return { en: {}, ar: {} }
}

function defaultBest(): Record<Locale, number> {
  return { en: 0, ar: 0 }
}

function loadProgress(): PersistedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedProgress>
      return {
        vectors: { ...defaultVectors(), ...parsed.vectors },
        best: { ...defaultBest(), ...parsed.best },
        lastResult: parsed.lastResult ?? null,
        unlocks: parsed.unlocks ?? [],
      }
    }
  } catch {
    // Corrupt or unavailable storage falls back to defaults.
  }
  return { vectors: defaultVectors(), best: defaultBest(), lastResult: null, unlocks: [] }
}

// JSON round-trip rather than structuredClone: the source is a Vue reactive
// proxy (structuredClone throws on proxies), and the vector is plain JSON data.
function cloneVector(vector: WeaknessVector): WeaknessVector {
  return JSON.parse(JSON.stringify(vector)) as WeaknessVector
}

export const useGameStore = defineStore('game', () => {
  const initial = loadProgress()
  const vectors = ref<Record<Locale, WeaknessVector>>(initial.vectors)
  const best = ref<Record<Locale, number>>(initial.best)
  const lastResult = ref<RunResult | null>(initial.lastResult)
  const unlocks = ref<string[]>(initial.unlocks)
  // Unlocks surfaced by the most recent run, for a one-shot toast on the summary.
  const lastUnlocks = ref<Unlock[]>([])

  // Open the draft pool to whatever the player has already earned before any run
  // is started, so the very first draft of the session offers their unlocks.
  syncDraftPool()

  function persist(): void {
    try {
      const snapshot: PersistedProgress = {
        vectors: vectors.value,
        best: best.value,
        lastResult: lastResult.value,
        unlocks: unlocks.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Persistence is best-effort; ignore quota or privacy-mode failures.
    }
  }

  // Push the unlocked draft modifiers into the modifiers module so rollModifiers
  // can offer them. Keeping this the store's job keeps modifiers.ts side-effect free.
  function syncDraftPool(): void {
    registerUnlocked(unlockedModifierIds(unlocks.value))
  }

  function vectorFor(locale: Locale): WeaknessVector {
    return cloneVector(vectors.value[locale])
  }

  function commitRun(result: RunResult, updatedVector: WeaknessVector): void {
    vectors.value[result.locale] = updatedVector
    best.value[result.locale] = Math.max(best.value[result.locale], result.cleanWpm)
    lastResult.value = result
    grantNewUnlocks(result, updatedVector)
    persist()
  }

  // Weakness mastery is the progression currency: a finished run can permanently
  // unlock new draft modifiers / a loadout perk, surfaced into the next draft.
  function grantNewUnlocks(result: RunResult, updatedVector: WeaknessVector): void {
    const earned = evaluateUnlocks(result, updatedVector, new Set(unlocks.value))
    lastUnlocks.value = earned
    if (earned.length === 0) return
    for (const unlock of earned) unlocks.value.push(unlock.id)
    syncDraftPool()
  }

  // Standing perks the player carries into every run (e.g. start with +1 life).
  function loadoutPerks(): string[] {
    return ownedPerkIds(unlocks.value)
  }

  function resetProgress(): void {
    vectors.value = defaultVectors()
    best.value = defaultBest()
    lastResult.value = null
    unlocks.value = []
    lastUnlocks.value = []
    syncDraftPool()
    persist()
  }

  return {
    vectors,
    best,
    lastResult,
    unlocks,
    lastUnlocks,
    vectorFor,
    commitRun,
    loadoutPerks,
    resetProgress,
  }
})
