import type {
  BigramDelta,
  BigramStat,
  WeaknessVector,
} from '@/game/types';

const MIN_ATTEMPTS_FOR_RANKING = 2;
const DEFAULT_WEAK_LIMIT = 8;
const DELTA_LIST_LIMIT = 5;

export function extractBigrams(word: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    bigrams.push(word[i] + word[i + 1]);
  }
  return bigrams;
}

export function errorRate(stat: BigramStat | undefined): number {
  return stat && stat.attempts > 0 ? stat.errors / stat.attempts : 0;
}

export function recordSample(
  vec: WeaknessVector,
  bigram: string,
  correct: boolean,
): void {
  const stat = (vec[bigram] ??= { attempts: 0, errors: 0 });
  stat.attempts++;
  if (!correct) stat.errors++;
}

export function weakBigrams(
  vec: WeaknessVector,
  limit: number = DEFAULT_WEAK_LIMIT,
): string[] {
  return Object.keys(vec)
    .filter((bigram) => vec[bigram].attempts >= MIN_ATTEMPTS_FOR_RANKING)
    .sort((a, b) => compareByErrorRateThenAttempts(vec[a], vec[b]))
    .slice(0, limit);
}

function compareByErrorRateThenAttempts(a: BigramStat, b: BigramStat): number {
  const rateDiff = errorRate(b) - errorRate(a);
  return rateDiff !== 0 ? rateDiff : b.attempts - a.attempts;
}

export function computeDeltas(
  before: WeaknessVector,
  after: WeaknessVector,
): { mostImproved: BigramDelta[]; weakest: BigramDelta[] } {
  const deltas = collectRankedDeltas(before, after);
  return {
    mostImproved: selectMostImproved(deltas),
    weakest: selectWeakest(deltas),
  };
}

function collectRankedDeltas(
  before: WeaknessVector,
  after: WeaknessVector,
): BigramDelta[] {
  return Object.keys(after)
    .filter((bigram) => after[bigram].attempts >= MIN_ATTEMPTS_FOR_RANKING)
    .map((bigram) => ({
      bigram,
      errorRateBefore: errorRate(before[bigram]),
      errorRateAfter: errorRate(after[bigram]),
      attempts: after[bigram].attempts,
    }));
}

function selectMostImproved(deltas: BigramDelta[]): BigramDelta[] {
  return deltas
    .filter((delta) => delta.errorRateAfter < delta.errorRateBefore)
    .sort(
      (a, b) =>
        b.errorRateBefore - b.errorRateAfter -
        (a.errorRateBefore - a.errorRateAfter),
    )
    .slice(0, DELTA_LIST_LIMIT);
}

function selectWeakest(deltas: BigramDelta[]): BigramDelta[] {
  return [...deltas]
    .sort((a, b) => b.errorRateAfter - a.errorRateAfter)
    .slice(0, DELTA_LIST_LIMIT);
}
