import type {
  Enemy,
  EngineOptions,
  GameEvent,
  LiveStats,
  Locale,
  RunPhase,
  RunResult,
  WeaknessVector,
} from '@/game/types';
import { computeDeltas, extractBigrams, recordSample, weakBigrams } from '@/game/bigrams';
import { selectWord } from '@/game/words';
import { cleanWpm, firstStrokeAccuracy, grossWpm } from '@/game/scoring';
import { rollModifiers, type RunModifier } from '@/game/modifiers';

const DEFAULT_LIVES = 3;

const SPAWN_INTERVAL_START_MS = 2200;
const SPAWN_INTERVAL_FLOOR_MS = 600;
const SPAWN_RAMP_DURATION_MS = 90000;
// WPM pressure is a nudge, not a cliff: a small per-WPM shave so a fast player
// keeps facing more words even after the time ramp bottoms out at the floor.
const SPAWN_WPM_PRESSURE_MS = 7;
const SPAWN_WPM_PRESSURE_CAP = 60;

const SPEED_START_PX_PER_SEC = 22;
const SPEED_MAX_PX_PER_SEC = 70;
const SPEED_RAMP_DURATION_MS = 120000;

const BASE_LINE_FRACTION = 0.08;
const SPAWN_MARGIN_FRACTION = 0.12;
const LANE_COUNT = 6;
const LANE_OVERLAP_GUARD_PX = 60;

const SHATTER_DURATION_MS = 220;
const ERROR_FLASH_MS = 200;
const SCORE_PER_SHATTER = 10;
const SCORE_PER_COMBO = 2;

// Combo breaks only on a real hesitation (interval longer than this × the rolling
// average) or a miss — accelerating never breaks it. Score caps the combo bonus
// so an unbroken streak can't run away.
const FLOW_PAUSE_RATIO = 2.4;
const COMBO_SCORE_CAP = 30;
const FLOW_INTERVAL_SMOOTHING = 0.3;
const DEFAULT_WEAK_WORD_BIAS = 0.45;

/** Mutable per-run balance levers — defaults below, mutated by run modifiers. */
export interface RunTuning {
  spawnIntervalStartMs: number;
  spawnIntervalFloorMs: number;
  spawnWpmPressureMs: number;
  speedStartPxPerSec: number;
  speedMaxPxPerSec: number;
  startLives: number;
  scorePerCombo: number;
  comboScoreCap: number;
  flowPauseRatio: number;
  weakWordBias: number;
  weakWordScoreBonus: number;
}

const WAVE_BASE_QUOTA = 8;
const WAVE_QUOTA_PER_WAVE = 2;
const DRAFT_OFFER_COUNT = 3;
const MAX_LIVES = 9;

function defaultTuning(): RunTuning {
  return {
    spawnIntervalStartMs: SPAWN_INTERVAL_START_MS,
    spawnIntervalFloorMs: SPAWN_INTERVAL_FLOOR_MS,
    spawnWpmPressureMs: SPAWN_WPM_PRESSURE_MS,
    speedStartPxPerSec: SPEED_START_PX_PER_SEC,
    speedMaxPxPerSec: SPEED_MAX_PX_PER_SEC,
    startLives: DEFAULT_LIVES,
    scorePerCombo: SCORE_PER_COMBO,
    comboScoreCap: COMBO_SCORE_CAP,
    flowPauseRatio: FLOW_PAUSE_RATIO,
    weakWordBias: DEFAULT_WEAK_WORD_BIAS,
    weakWordScoreBonus: 0,
  };
}

/**
 * Core Keystorm run simulation. Framework-agnostic: ticks via `update(dtMs)`,
 * consumes keystrokes via `handleChar`, and surfaces stats + juice events
 * through the option callbacks. The learning engine attributes every first
 * stroke to a bigram in the live weakness vector.
 */
export class GameEngine {
  enemies: Enemy[] = [];
  stats: LiveStats;
  phase: RunPhase = 'idle';
  readonly weakness: WeaknessVector;
  readonly tuning: RunTuning = defaultTuning();

  private readonly locale: Locale;
  private readonly before: WeaknessVector;
  private readonly onStats?: (stats: LiveStats) => void;
  private readonly onEvent?: (event: GameEvent) => void;

  private width: number;
  private height: number;

  private lives: number;
  private score = 0;
  private elapsedMs = 0;
  private correctStrokes = 0;
  private totalStrokes = 0;
  private combo = 0;
  private maxCombo = 0;
  private enemiesDestroyed = 0;

  private waveIndex = 1;
  private destroyedThisWave = 0;
  private offered: RunModifier[] = [];

  private spawnAccumulatorMs = 0;
  private nextEnemyId = 0;

  private lastStrokeTime = -1;
  private averageStrokeIntervalMs = 0;

  constructor(opts: EngineOptions) {
    this.locale = opts.locale;
    this.width = opts.width;
    this.height = opts.height;
    if (opts.lives !== undefined) this.tuning.startLives = opts.lives;
    this.lives = this.tuning.startLives;
    this.onStats = opts.onStats;
    this.onEvent = opts.onEvent;

    this.weakness = cloneVector(opts.weakness);
    this.before = cloneVector(opts.weakness);
    this.stats = this.buildStats();
  }

  start(): void {
    this.enemies = [];
    this.lives = this.tuning.startLives;
    this.score = 0;
    this.elapsedMs = 0;
    this.correctStrokes = 0;
    this.totalStrokes = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.enemiesDestroyed = 0;
    this.spawnAccumulatorMs = 0;
    this.nextEnemyId = 0;
    this.lastStrokeTime = -1;
    this.averageStrokeIntervalMs = 0;
    this.waveIndex = 1;
    this.destroyedThisWave = 0;
    this.offered = [];
    this.phase = 'playing';
    this.spawnEnemy();
    this.publishStats();
  }

  get wave(): number {
    return this.waveIndex;
  }

  /** The 3 modifiers offered in the current between-wave draft. */
  offers(): RunModifier[] {
    return this.offered;
  }

  /** Apply a drafted modifier and resume into the next wave. */
  chooseModifier(id: string): void {
    if (this.phase !== 'drafting') return;
    const modifier = this.offered.find((candidate) => candidate.id === id);
    if (!modifier) return;
    modifier.apply(this);
    this.offered = [];
    this.waveIndex++;
    this.destroyedThisWave = 0;
    this.spawnAccumulatorMs = 0;
    this.lastStrokeTime = -1;
    this.phase = 'playing';
    this.spawnEnemy();
    this.publishStats();
  }

  /** Grant lives (capped), used by life-restoring modifiers. */
  addLives(count: number): void {
    this.lives = Math.min(this.lives + count, MAX_LIVES);
    this.publishStats();
  }

  /** Freeze the simulation without ending the run (Esc / lost focus). */
  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  /** Resume a paused run. */
  resume(): void {
    if (this.phase === 'paused') this.phase = 'playing';
  }

  get isPaused(): boolean {
    return this.phase === 'paused';
  }

  update(dtMs: number): void {
    if (this.phase !== 'playing') return;
    this.elapsedMs += dtMs;
    this.advanceSpawning(dtMs);
    this.marchEnemies(dtMs);
    this.advanceShatters(dtMs);
    this.advanceErrorFlashes(dtMs);
    this.cullFinishedShatters();
    this.publishStats();
  }

  handleChar(char: string): void {
    if (this.phase !== 'playing' || char.length === 0) return;
    const target = this.findActiveEnemy() ?? this.commitFrontMost(char);
    if (!target) return;
    this.applyStroke(target, char);
  }

  /** Backspace: wipe typed progress on the locked word so it can be restarted. */
  clearActiveWord(): void {
    if (this.phase !== 'playing') return;
    const target = this.findActiveEnemy();
    if (!target) return;
    target.typed = 0;
    target.active = false;
  }

  result(): RunResult {
    const accuracy = firstStrokeAccuracy(this.correctStrokes, this.totalStrokes);
    const gross = grossWpm(this.correctStrokes, this.elapsedMs);
    const { mostImproved, weakest } = computeDeltas(this.before, this.weakness);
    return {
      locale: this.locale,
      cleanWpm: cleanWpm(gross, accuracy),
      grossWpm: gross,
      accuracy,
      maxCombo: this.maxCombo,
      score: this.score,
      durationMs: this.elapsedMs,
      enemiesDestroyed: this.enemiesDestroyed,
      mostImproved,
      weakest,
    };
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  private advanceSpawning(dtMs: number): void {
    this.spawnAccumulatorMs += dtMs;
    const interval = this.currentSpawnIntervalMs();
    if (this.spawnAccumulatorMs >= interval) {
      this.spawnAccumulatorMs -= interval;
      this.spawnEnemy();
    }
  }

  private currentSpawnIntervalMs(): number {
    const { spawnIntervalStartMs, spawnIntervalFloorMs, spawnWpmPressureMs } = this.tuning;
    const timeProgress = clamp01(this.elapsedMs / SPAWN_RAMP_DURATION_MS);
    const timeRamped =
      spawnIntervalStartMs - (spawnIntervalStartMs - spawnIntervalFloorMs) * timeProgress;
    // Pressure tracks GROSS wpm (raw hand speed) — sloppy typing no longer buys an
    // easier game, and the term stays meaningful after the time ramp bottoms out.
    const wpmPressure =
      Math.min(this.currentGrossWpm(), SPAWN_WPM_PRESSURE_CAP) * spawnWpmPressureMs;
    return Math.max(spawnIntervalFloorMs, timeRamped - wpmPressure);
  }

  private currentSpeedPxPerSec(): number {
    const { speedStartPxPerSec, speedMaxPxPerSec } = this.tuning;
    const progress = clamp01(this.elapsedMs / SPEED_RAMP_DURATION_MS);
    return speedStartPxPerSec + (speedMaxPxPerSec - speedStartPxPerSec) * progress;
  }

  private currentGrossWpm(): number {
    return grossWpm(this.correctStrokes, this.elapsedMs);
  }

  private spawnEnemy(): void {
    const word = selectWord(this.locale, this.weakness, Math.random, this.tuning.weakWordBias);
    if (word.length === 0) return;
    const halfWidth = this.approxWordWidthPx(word) / 2;
    const laneY = this.pickLaneY(halfWidth);
    const desiredSpeed = this.currentSpeedPxPerSec() * lengthSpeedFactor(word.length);
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      word,
      typed: 0,
      x: this.width,
      y: laneY,
      speed: this.laneClampedSpeed(laneY, desiredSpeed),
      bigrams: extractBigrams(word),
      active: false,
    };
    this.enemies.push(enemy);
    this.emit({ type: 'spawn', enemyId: enemy.id });
  }

  // Rough on-screen word width in px (the engine has no canvas). Mirrors the
  // renderer's width-based font sizing with a monospace advance estimate.
  private approxWordWidthPx(word: string): number {
    const fontPx = Math.max(18, Math.min(28, Math.round(this.width / 38)));
    return word.length * fontPx * 0.62;
  }

  // Center x of a live enemy's word, accounting for the LTR/RTL text anchor.
  private enemyCenterX(enemy: Enemy): number {
    const half = this.approxWordWidthPx(enemy.word) / 2;
    return this.locale === 'ar' ? enemy.x - half : enemy.x + half;
  }

  private pickLaneY(halfWidth: number): number {
    const laneHeight = this.height / LANE_COUNT;
    const lanes = Array.from(
      { length: LANE_COUNT },
      (_, lane) => laneHeight * lane + laneHeight / 2,
    );
    const open = lanes.filter((laneY) => this.laneHasRoom(laneY, halfWidth));
    const pool = open.length > 0 ? open : lanes;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // A lane has room when the incoming word's footprint clears every live word in
  // it by at least the guard gap — measured edge-to-edge, so wide words can't
  // spawn overlapping a word already in the lane.
  private laneHasRoom(laneY: number, halfWidth: number): boolean {
    const newCenter = this.locale === 'ar' ? this.width - halfWidth : this.width + halfWidth;
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) continue;
      if (Math.abs(enemy.y - laneY) > 1) continue;
      const gap =
        Math.abs(newCenter - this.enemyCenterX(enemy)) -
        halfWidth -
        this.approxWordWidthPx(enemy.word) / 2;
      if (gap < LANE_OVERLAP_GUARD_PX) return false;
    }
    return true;
  }

  // Cap the incoming word's speed to the word directly ahead of it in the lane so
  // a faster trailing word can never catch and overlap a slower leader.
  private laneClampedSpeed(laneY: number, desired: number): number {
    let aheadX = Number.NEGATIVE_INFINITY;
    let aheadSpeed = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) continue;
      if (Math.abs(enemy.y - laneY) > 1) continue;
      if (enemy.x > aheadX) {
        aheadX = enemy.x;
        aheadSpeed = enemy.speed;
      }
    }
    return Math.min(desired, aheadSpeed);
  }

  private marchEnemies(dtMs: number): void {
    const distance = dtMs / 1000;
    const baseLine = this.width * BASE_LINE_FRACTION;
    const survivors: Enemy[] = [];
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) {
        survivors.push(enemy);
        continue;
      }
      enemy.x -= enemy.speed * distance;
      if (enemy.x <= baseLine) this.breach();
      else survivors.push(enemy);
    }
    this.enemies = survivors;
  }

  private breach(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'over';
      this.emit({ type: 'gameover' });
      return;
    }
    this.emit({ type: 'breach' });
  }

  private advanceShatters(dtMs: number): void {
    for (const enemy of this.enemies) {
      if (enemy.shatter === undefined) continue;
      enemy.shatter = Math.min(1, enemy.shatter + dtMs / SHATTER_DURATION_MS);
    }
  }

  private cullFinishedShatters(): void {
    this.enemies = this.enemies.filter(
      (enemy) => enemy.shatter === undefined || enemy.shatter < 1,
    );
  }

  private findActiveEnemy(): Enemy | undefined {
    return this.enemies.find(
      (enemy) => enemy.active && enemy.shatter === undefined,
    );
  }

  private commitFrontMost(char: string): Enemy | undefined {
    let frontMost: Enemy | undefined;
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) continue;
      if (enemy.word[enemy.typed] !== char) continue;
      if (!frontMost || enemy.x < frontMost.x) frontMost = enemy;
    }
    if (frontMost) frontMost.active = true;
    return frontMost;
  }

  private applyStroke(enemy: Enemy, char: string): void {
    const expected = enemy.word[enemy.typed];
    this.totalStrokes++;
    if (char === expected) {
      this.acceptStroke(enemy);
    } else {
      this.rejectStroke(enemy, expected);
    }
  }

  private acceptStroke(enemy: Enemy): void {
    this.correctStrokes++;
    this.recordBigram(enemy, enemy.word[enemy.typed], true);
    enemy.typed++;
    this.updateFlowCombo();
    this.emit({ type: 'hit', combo: this.combo });
    if (enemy.typed === enemy.word.length) this.shatter(enemy);
  }

  private rejectStroke(enemy: Enemy, expected: string): void {
    this.recordBigram(enemy, expected, false);
    this.combo = 0;
    enemy.errorMs = ERROR_FLASH_MS;
    this.emit({ type: 'miss' });
  }

  private advanceErrorFlashes(dtMs: number): void {
    for (const enemy of this.enemies) {
      if (enemy.errorMs === undefined) continue;
      enemy.errorMs -= dtMs;
      if (enemy.errorMs <= 0) enemy.errorMs = undefined;
    }
  }

  private recordBigram(enemy: Enemy, currentChar: string, correct: boolean): void {
    if (enemy.typed < 1) return;
    const bigram = enemy.word[enemy.typed - 1] + currentChar;
    recordSample(this.weakness, bigram, correct);
  }

  private updateFlowCombo(): void {
    const now = this.elapsedMs;
    if (this.lastStrokeTime < 0) {
      this.lastStrokeTime = now;
      this.combo++;
      this.trackMaxCombo();
      return;
    }
    const interval = now - this.lastStrokeTime;
    this.lastStrokeTime = now;
    // Going faster never breaks the streak — only a real hesitation does (a miss
    // also breaks it, handled in rejectStroke). This rewards acceleration.
    if (this.hesitated(interval)) this.combo = 0;
    else this.combo++;
    this.absorbInterval(interval);
    this.trackMaxCombo();
  }

  private hesitated(interval: number): boolean {
    if (this.averageStrokeIntervalMs <= 0) return false;
    return interval > this.averageStrokeIntervalMs * this.tuning.flowPauseRatio;
  }

  private absorbInterval(interval: number): void {
    if (this.averageStrokeIntervalMs <= 0) {
      this.averageStrokeIntervalMs = interval;
      return;
    }
    this.averageStrokeIntervalMs =
      this.averageStrokeIntervalMs * (1 - FLOW_INTERVAL_SMOOTHING) +
      interval * FLOW_INTERVAL_SMOOTHING;
  }

  private trackMaxCombo(): void {
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
  }

  private shatter(enemy: Enemy): void {
    enemy.shatter = 0;
    enemy.active = false;
    this.enemiesDestroyed++;
    this.destroyedThisWave++;
    const comboBonus = Math.min(this.combo, this.tuning.comboScoreCap) * this.tuning.scorePerCombo;
    this.score += SCORE_PER_SHATTER + comboBonus + this.weakWordBonus(enemy);
    this.emit({ type: 'shatter', enemyId: enemy.id });
    if (this.destroyedThisWave >= this.waveTarget()) this.completeWave();
  }

  private weakWordBonus(enemy: Enemy): number {
    if (this.tuning.weakWordScoreBonus <= 0) return 0;
    const weakSet = new Set(weakBigrams(this.weakness));
    return enemy.bigrams.some((bigram) => weakSet.has(bigram))
      ? this.tuning.weakWordScoreBonus
      : 0;
  }

  private waveTarget(): number {
    return WAVE_BASE_QUOTA + this.waveIndex * WAVE_QUOTA_PER_WAVE;
  }

  // Clear the field and open the command-palette draft; the loop freezes because
  // update() early-returns while the phase is not 'playing'.
  private completeWave(): void {
    this.phase = 'drafting';
    this.enemies = [];
    this.destroyedThisWave = 0;
    this.offered = rollModifiers(DRAFT_OFFER_COUNT);
    this.emit({ type: 'wavecomplete', wave: this.waveIndex });
    this.publishStats();
  }

  private publishStats(): void {
    this.stats = this.buildStats();
    this.onStats?.(this.stats);
  }

  private buildStats(): LiveStats {
    const accuracy = firstStrokeAccuracy(this.correctStrokes, this.totalStrokes);
    const gross = grossWpm(this.correctStrokes, this.elapsedMs);
    return {
      grossWpm: gross,
      cleanWpm: cleanWpm(gross, accuracy),
      accuracy,
      combo: this.combo,
      maxCombo: this.maxCombo,
      lives: this.lives,
      score: this.score,
      elapsedMs: this.elapsedMs,
      enemiesDestroyed: this.enemiesDestroyed,
    };
  }

  private emit(event: GameEvent): void {
    this.onEvent?.(event);
  }
}

function cloneVector(vec: WeaknessVector): WeaknessVector {
  const clone: WeaknessVector = {};
  for (const bigram of Object.keys(vec)) {
    clone[bigram] = { attempts: vec[bigram].attempts, errors: vec[bigram].errors };
  }
  return clone;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// Longer words advance slower so they stay readable, but they linger as bigger
// threats — clearing the long "edit" early is the triage skill the genre rewards.
function lengthSpeedFactor(length: number): number {
  const factor = 1 - (length - 5) * 0.03;
  return Math.max(0.7, Math.min(1, factor));
}
