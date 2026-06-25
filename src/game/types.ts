// ─── Keystorm shared type contract ──────────────────────────────────────────
// Single source of truth for the game's data shapes. Every game module conforms
// to these types. Game modules live under `src/game/*` and are NOT auto-imported
// — import them explicitly via `@/game/...`.

export type Locale = 'en' | 'ar';

export type RunPhase = 'idle' | 'playing' | 'paused' | 'drafting' | 'over';

/** What flavor of word enemy this is — drives spawn telegraph, scoring, pairing. */
export type EnemyKind = 'normal' | 'comment' | 'bracket' | 'lint' | 'tank' | 'conflict' | 'bonus';

/** A marching word enemy. */
export interface Enemy {
  id: number;
  /** Display string already in the target language. */
  word: string;
  /** Count of correctly-typed leading characters (the typed prefix length). */
  typed: number;
  /** Center x in play-field pixels. Decreases as it marches toward the base. */
  x: number;
  /** Lane center y in play-field pixels. */
  y: number;
  /** Leftward march speed in px/sec. */
  speed: number;
  /** Bigrams contained in this word (for stat attribution & spawn weighting). */
  bigrams: string[];
  /** True once the player has committed to typing this enemy (locked target). */
  active: boolean;
  /** Shatter animation progress 0..1 once destroyed; undefined while alive. */
  shatter?: number;
  /** Remaining error-flash time in ms after a mistyped letter; undefined when calm. */
  errorMs?: number;
  /** Variant of this enemy; absent means a plain 'normal' word. */
  kind?: EnemyKind;
  /** Pairs a bracket/conflict partner — both enemies share the same linkId. */
  linkId?: number;
  /** For a merge-conflict word: which side of the conflict block it belongs to,
   *  so the renderer can frame the HEAD block and the incoming branch block as a
   *  real vertical conflict stack. Absent for non-conflict / stack-trace words. */
  conflictSide?: 'head' | 'branch';
  /** Spawn-telegraph countdown in ms; while > 0 the enemy is still announcing itself. */
  spawnFlashMs?: number;
  /** True for a score-reward enemy. */
  bonus?: boolean;
}

/** Live, per-frame run statistics surfaced to the HUD. */
export interface LiveStats {
  grossWpm: number;
  /** gross × accuracy² — sloppy speed is mathematically punished. */
  cleanWpm: number;
  /** First-stroke accuracy, 0..1. */
  accuracy: number;
  /** Current flow combo (even-cadence streak). */
  combo: number;
  maxCombo: number;
  lives: number;
  score: number;
  elapsedMs: number;
  enemiesDestroyed: number;
}

/** Persisted per-bigram first-stroke stat. */
export interface BigramStat {
  attempts: number;
  /** First-stroke errors on this transition. */
  errors: number;
}

/** Map of bigram → stat. Persisted per-locale (Latin and Arabic never mix). */
export type WeaknessVector = Record<string, BigramStat>;

/** Per-bigram before/after comparison used in the post-run card. */
export interface BigramDelta {
  bigram: string;
  errorRateBefore: number;
  errorRateAfter: number;
  attempts: number;
}

/** Final result of a completed run. */
export interface RunResult {
  locale: Locale;
  cleanWpm: number;
  grossWpm: number;
  accuracy: number;
  maxCombo: number;
  score: number;
  durationMs: number;
  enemiesDestroyed: number;
  mostImproved: BigramDelta[];
  weakest: BigramDelta[];
}

/** Physical on-screen keyboard layout used by the heatmap. */
export interface KeyboardLayout {
  locale: Locale;
  /** Rows of base-form key characters, home-row-centric, top→bottom. */
  rows: string[][];
}

/** Events emitted by the engine for juice (audio / screen shake). */
export type GameEvent =
  | { type: 'hit'; combo: number }
  | { type: 'shatter'; enemyId: number }
  | { type: 'miss' }
  | { type: 'breach' }
  | { type: 'spawn'; enemyId: number; kind?: EnemyKind }
  | { type: 'wavecomplete'; wave: number }
  | { type: 'wavestart'; wave: number }
  | { type: 'shield' }
  | { type: 'bossstart'; kind: string }
  | { type: 'bosscleared'; kind: string }
  | { type: 'gameover' };

export interface EngineOptions {
  locale: Locale;
  /** Working copy of the persisted vector; the engine mutates this live. */
  weakness: WeaknessVector;
  /** Play-field width in CSS pixels. */
  width: number;
  /** Play-field height in CSS pixels. */
  height: number;
  /** Starting lives. Default 5. */
  lives?: number;
  onStats?: (stats: LiveStats) => void;
  onEvent?: (event: GameEvent) => void;
}
