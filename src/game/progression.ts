// ─── Meta-progression: weakness mastery → permanent unlocks ──────────────────
// The weakness vector the player builds across runs is the progression currency.
// A run that proves real improvement (a bigram whose error rate fell hard) or
// sustained mastery (a low-error, well-practised bigram cluster) permanently
// unlocks a build modifier or loadout perk that the next run's draft can offer.
//
// Every rule here is a PURE function of the finished RunResult plus the merged
// weakness vector — no I/O, no randomness — so unlock evaluation is deterministic
// and replayable. The store owns persistence and pool wiring.

import type { BigramDelta, RunResult, WeaknessVector } from '@/game/types';
import { errorRate } from '@/game/bigrams';

/** A perpetual perk applied at the start of every future run, not drafted. */
export interface LoadoutPerk {
  id: string;
  /** Player-facing line shown on the unlock toast / loadout screen. */
  label: string;
}

/** What a single unlock makes available next run. */
export interface Unlock {
  id: string;
  /** Human-readable reason the player earned it (shown once, on unlock). */
  reason: string;
  /** A draft modifier id surfaced into the pool, or a standing loadout perk. */
  grants: { kind: 'modifier'; modifierId: string } | { kind: 'perk'; perkId: string };
}

// Mastery = enough reps to trust the number, and a low first-stroke error rate.
const MASTERY_MIN_ATTEMPTS = 6;
const MASTERY_MAX_ERROR_RATE = 0.1;
const MASTERY_CLUSTER_SIZE = 4;

// A "breakthrough" is a single bigram whose error rate fell by at least this much
// in one run — proof the drill worked, not just noise.
const BREAKTHROUGH_DROP = 0.4;

// Skill gates: clean WPM and accuracy thresholds that gate the stronger unlocks.
const STEADY_HANDS_ACCURACY = 0.97;
const FAST_FINGERS_CLEAN_WPM = 60;
const MARKSMAN_MAX_COMBO = 40;

/**
 * Every unlock the game can grant, keyed by id. The condition reads only the
 * finished run and the post-run merged vector, so the same inputs always yield
 * the same unlocks.
 */
const UNLOCK_RULES: readonly {
  unlock: Unlock;
  isEarned: (result: RunResult, vector: WeaknessVector) => boolean;
}[] = [
  {
    unlock: {
      id: 'breakthrough',
      reason: 'A weak bigram dropped 40% error in one run',
      grants: { kind: 'modifier', modifierId: 'muscle-memory' },
    },
    isEarned: (result) => hasBreakthrough(result.mostImproved),
  },
  {
    unlock: {
      id: 'mastery-cluster',
      reason: 'Four bigrams mastered with low error',
      grants: { kind: 'modifier', modifierId: 'pair-programmer' },
    },
    isEarned: (_result, vector) => masteredCount(vector) >= MASTERY_CLUSTER_SIZE,
  },
  {
    unlock: {
      id: 'steady-hands',
      reason: 'Finished a run at 97% accuracy',
      grants: { kind: 'perk', perkId: 'extra-life' },
    },
    isEarned: (result) => result.accuracy >= STEADY_HANDS_ACCURACY,
  },
  {
    unlock: {
      id: 'fast-fingers',
      reason: 'Cleared 60 clean WPM in a run',
      grants: { kind: 'modifier', modifierId: 'tab-completion' },
    },
    isEarned: (result) => result.cleanWpm >= FAST_FINGERS_CLEAN_WPM,
  },
  {
    unlock: {
      id: 'marksman',
      reason: 'Held a 40-flow combo',
      grants: { kind: 'modifier', modifierId: 'linter-clean' },
    },
    isEarned: (result) => result.maxCombo >= MARKSMAN_MAX_COMBO,
  },
];

function hasBreakthrough(mostImproved: BigramDelta[]): boolean {
  return mostImproved.some(
    (delta) => delta.errorRateBefore - delta.errorRateAfter >= BREAKTHROUGH_DROP,
  );
}

function masteredCount(vector: WeaknessVector): number {
  let count = 0;
  for (const bigram of Object.keys(vector)) {
    const stat = vector[bigram];
    if (stat.attempts >= MASTERY_MIN_ATTEMPTS && errorRate(stat) <= MASTERY_MAX_ERROR_RATE) {
      count += 1;
    }
  }
  return count;
}

/**
 * Return the ids of every unlock the finished run newly earns and that the player
 * does not already own. Deterministic: same run + vector + owned set ⇒ same ids.
 */
export function evaluateUnlocks(
  result: RunResult,
  vector: WeaknessVector,
  owned: ReadonlySet<string>,
): Unlock[] {
  const earned: Unlock[] = [];
  for (const rule of UNLOCK_RULES) {
    if (owned.has(rule.unlock.id)) continue;
    if (rule.isEarned(result, vector)) earned.push(rule.unlock);
  }
  return earned;
}

/** Resolve owned unlock ids into the draft-modifier ids they surface. */
export function unlockedModifierIds(ownedUnlockIds: Iterable<string>): string[] {
  return resolveGrants(ownedUnlockIds, 'modifier').map(
    (grant) => (grant as { modifierId: string }).modifierId,
  );
}

/** Resolve owned unlock ids into the standing loadout perks they grant. */
export function ownedPerkIds(ownedUnlockIds: Iterable<string>): string[] {
  return resolveGrants(ownedUnlockIds, 'perk').map(
    (grant) => (grant as { perkId: string }).perkId,
  );
}

function resolveGrants(
  ownedUnlockIds: Iterable<string>,
  kind: 'modifier' | 'perk',
): Unlock['grants'][] {
  const owned = new Set(ownedUnlockIds);
  const grants: Unlock['grants'][] = [];
  for (const rule of UNLOCK_RULES) {
    if (owned.has(rule.unlock.id) && rule.unlock.grants.kind === kind) {
      grants.push(rule.unlock.grants);
    }
  }
  return grants;
}
