import type { Locale, RunResult, WeaknessVector } from '@/game/types'

const STORAGE_KEY = 'keystorm:progress'

interface PersistedProgress {
  vectors: Record<Locale, WeaknessVector>
  best: Record<Locale, number>
  lastResult: RunResult | null
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
      }
    }
  } catch {
    // Corrupt or unavailable storage falls back to defaults.
  }
  return { vectors: defaultVectors(), best: defaultBest(), lastResult: null }
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

  function persist(): void {
    try {
      const snapshot: PersistedProgress = {
        vectors: vectors.value,
        best: best.value,
        lastResult: lastResult.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Persistence is best-effort; ignore quota or privacy-mode failures.
    }
  }

  function vectorFor(locale: Locale): WeaknessVector {
    return cloneVector(vectors.value[locale])
  }

  function commitRun(result: RunResult, updatedVector: WeaknessVector): void {
    vectors.value[result.locale] = updatedVector
    best.value[result.locale] = Math.max(best.value[result.locale], result.cleanWpm)
    lastResult.value = result
    persist()
  }

  function resetProgress(): void {
    vectors.value = defaultVectors()
    best.value = defaultBest()
    lastResult.value = null
    persist()
  }

  return { vectors, best, lastResult, vectorFor, commitRun, resetProgress }
})
