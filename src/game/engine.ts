import type {
  Enemy,
  EngineOptions,
  EnemyKind,
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
import { rollBossRewards, rollModifiers, type RunModifier } from '@/game/modifiers';
import { fontPxFor, gutterWidthFor, laneCenters } from '@/game/layout';

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

// Flow shield: a high combo absorbs one breach instead of costing a life, then
// the combo resets so the protection must be earned again.
const BREACH_SHIELD_COMBO = 25;

// Wave arc — each wave opens with a felt breather, then pressure climbs toward
// the clear. The calm cooldown suppresses every spawn at wave start; the rising
// term tightens the spawn interval and nudges speed as the wave nears quota.
const WAVE_CALM_OPEN_MS = 1500;
const WAVE_PROGRESS_SPAWN_TIGHTEN = 0.2;
const WAVE_PROGRESS_SPEED_NUDGE = 0.12;

// Telegraph: a freshly spawned enemy pulses its lane for this long before the
// word is in play, giving the eye a beat to find the new threat.
const SPAWN_TELEGRAPH_MS = 350;

// Overflow pressure: when too many words pile up near the base line the field is
// in a fightable death-spiral, so every word speeds up a little per backlogged
// word. The critical zone is the inner fraction of the gutter-to-base run, and
// the multiplier is hard-capped so a backlog never becomes an instant loss.
const OVERFLOW_CRITICAL_FRACTION = 4;
const OVERFLOW_SPEED_PER_ENEMY = 0.06;
// However many multipliers stack (overflow × hot lane × wave nudge), no single
// word may exceed this multiple of the current base speed. Without it the late
// game produces near-unreactable spikes that turn a fightable spiral into sudden
// death; the cap keeps every threat's reaction distance honest.
const MAX_COMBINED_SPEED_FACTOR = 2;

// Hot lane: one lane is periodically marked dangerous for a short window; its
// words march faster, and the renderer reddens that row's line number. The lane
// stays cool for the gap, then a fresh lane heats up.
const HOT_LANE_ACTIVE_MS = 4000;
const HOT_LANE_GAP_MS = 6000;
const HOT_LANE_SPEED_MULTIPLIER = 1.35;
const HOT_LANE_SPAWN_BIAS = 0.35;

// Word archetypes — the depth multiplier. Each kind reads as ordinary editor
// activity (a comment, a bracket pair, a lint squiggle, a long identifier) but
// carries distinct speed and on-clear/on-breach behavior so targeting becomes a
// real decision. The plain letters always live in enemy.word; kind is metadata
// the renderer decorates — never bake punctuation/markers into the typed word.
const COMMENT_SPEED_FACTOR = 0.62;
const LINT_SPEED_FACTOR = 1.45;
const TANK_SPEED_FACTOR = 0.55;
const BONUS_SPEED_FACTOR = 1.15;
// A comment that breaches spits out replacement words instead of (only) costing
// a life on its own — ignoring it has a cost, but the punishment stays fair.
const COMMENT_BREACH_SPAWN_COUNT = 2;
// A 'tank' is the formalized long-word threat: words at or past this length are
// eligible to be tagged as tanks (long identifiers / TODO-style lines).
const TANK_MIN_WORD_LENGTH = 7;
// When one half of a bracket pair is cleared, its surviving partner accelerates
// until it too is cleared — punishing target-switching indecision.
const BRACKET_PARTNER_SPEEDUP = 1.5;
// A cleared bonus word rewards extra score: the decoy is a temptation that pays
// off if you can afford the detour under pressure.
const BONUS_SCORE_REWARD = 40;

// Boss / climax waves — every Nth wave is a scripted encounter that reads as a
// dramatic but ordinary editor event (an unresolved merge conflict, a thrown
// stack trace). The boss spawns its whole cast at once, suppresses normal
// spawning, and resolves when every conflict word is cleared; then the run flows
// into the usual between-wave draft. Every target stays a PLAIN typeable token —
// the renderer paints the <<<<<<< / ======= / >>>>>>> markers and trace frames.
const BOSS_WAVE_INTERVAL = 5;
// Conflict words advance slowly: the drama is the standoff, not a speed rush, so
// the player has room to resolve the two sides in order under steady pressure.
const BOSS_CONFLICT_SPEED_FACTOR = 0.5;
// Conflict columns start further back than a normal spawn so the stacked rows
// read as a wall the player works through, not an instant breach.
const BOSS_SPAWN_BACK_FACTOR = 1.35;
// Clearing a boss conflict word is worth more than a plain shatter — resolving
// the encounter is the wave's whole point.
const BOSS_CONFLICT_SCORE_REWARD = 25;

// Plain typeable tokens for the merge-conflict encounter. The renderer decorates
// the two link sides as `<<<<<<< HEAD` … `=======` … `>>>>>>> branch`; the
// player only ever types these letters, never the markers or whitespace.
const MERGE_HEAD_TOKENS = ['head', 'keep', 'ours', 'merge', 'stash'];
const MERGE_BRANCH_TOKENS = ['branch', 'theirs', 'resolve', 'rebase', 'patch'];
// Plain tokens for the stack-trace encounter — a column cleared top-down, read
// by the renderer as `at frame (file:line)` trace lines under a thrown error.
const STACK_TRACE_TOKENS = ['error', 'throws', 'caused', 'trace', 'frame', 'caller', 'invoke'];

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
  /** Combo at or above which the next breach is absorbed without losing a life. */
  breachShieldCombo: number;
  /** Hard ceiling on the overflow speed multiplier so a backlog stays fightable. */
  overflowSpeedCap: number;
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
    breachShieldCombo: BREACH_SHIELD_COMBO,
    overflowSpeedCap: 1.6,
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
  /** Centers (y px) of the currently-hot lane(s) so the renderer can redden the
   *  matching row's line number. Empty while every lane is cool. Reused in place
   *  each tick to keep per-frame allocation at zero. */
  hotLaneYs: number[] = [];
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
  private nextLinkId = 0;
  private calmOpenCooldownMs = 0;

  private lastStrokeTime = -1;
  private averageStrokeIntervalMs = 0;

  // Hot-lane cycle: a single lane is dangerous for ACTIVE_MS, then all lanes are
  // cool for GAP_MS before a fresh one heats up. hotLaneY is the live hot center
  // (NaN while cool); hotLaneTimerMs counts down the current phase.
  private hotLaneY = Number.NaN;
  private hotLaneTimerMs = HOT_LANE_GAP_MS;

  // Boss encounter: a scripted climax inside the normal 'playing' phase (no new
  // RunPhase). While bossActive the engine suppresses normal spawning and waits
  // for every conflict word to clear before opening the between-wave draft.
  private bossActive = false;
  private bossKind = '';

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
    this.calmOpenCooldownMs = 0;
    this.nextEnemyId = 0;
    this.nextLinkId = 0;
    this.lastStrokeTime = -1;
    this.averageStrokeIntervalMs = 0;
    this.hotLaneY = Number.NaN;
    this.hotLaneTimerMs = HOT_LANE_GAP_MS;
    this.hotLaneYs.length = 0;
    this.bossActive = false;
    this.bossKind = '';
    this.waveIndex = 1;
    this.destroyedThisWave = 0;
    this.offered = [];
    this.phase = 'playing';
    this.beginWave();
    this.publishStats();
  }

  // Open a wave with a calm breather: spawning is suppressed for the cooldown so
  // the field is briefly empty, letting the player exhale before pressure climbs.
  // Every Nth wave instead opens a scripted boss encounter.
  private beginWave(): void {
    this.spawnAccumulatorMs = 0;
    this.lastStrokeTime = -1;
    this.calmOpenCooldownMs = WAVE_CALM_OPEN_MS;
    this.bossActive = false;
    this.emit({ type: 'wavestart', wave: this.waveIndex });
    if (this.isBossWave()) this.beginBoss();
  }

  private isBossWave(): boolean {
    return this.waveIndex % BOSS_WAVE_INTERVAL === 0;
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
    this.phase = 'playing';
    this.beginWave();
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
    this.advanceHotLane(dtMs);
    this.advanceSpawning(dtMs);
    this.marchEnemies(dtMs);
    this.advanceShatters(dtMs);
    this.advanceErrorFlashes(dtMs);
    this.advanceSpawnFlashes(dtMs);
    this.publishStats();
  }

  handleChar(char: string): void {
    if (this.phase !== 'playing' || char.length === 0) return;
    const target = this.findActiveEnemy() ?? this.lockMostUrgent(char);
    if (!target) {
      this.registerStrayKey();
      return;
    }
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
    // The boss spawns its whole scripted cast up front; no drip spawning runs
    // until the encounter is resolved and the field flows into the next wave.
    if (this.bossActive) return;
    if (this.calmOpenCooldownMs > 0) {
      this.calmOpenCooldownMs -= dtMs;
      return;
    }
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
    // Local wave arc: the interval tightens as the wave nears its quota, so
    // pressure rises within each wave and resets when the next one opens calm.
    const waveTighten = 1 - WAVE_PROGRESS_SPAWN_TIGHTEN * this.waveProgress();
    return Math.max(spawnIntervalFloorMs, (timeRamped - wpmPressure) * waveTighten);
  }

  private currentSpeedPxPerSec(): number {
    const { speedStartPxPerSec, speedMaxPxPerSec } = this.tuning;
    const progress = clamp01(this.elapsedMs / SPEED_RAMP_DURATION_MS);
    const timeRamped = speedStartPxPerSec + (speedMaxPxPerSec - speedStartPxPerSec) * progress;
    // Words march a touch faster as the wave's end approaches, layered on top of
    // the global time ramp and reset each wave for the build-then-release arc.
    return timeRamped * (1 + WAVE_PROGRESS_SPEED_NUDGE * this.waveProgress());
  }

  // How far into its quota the current wave is, 0 at the calm open and 1 at the
  // clear. Drives the local rising-pressure terms; resets when a wave begins.
  private waveProgress(): number {
    return clamp01(this.destroyedThisWave / this.waveTarget());
  }

  private currentGrossWpm(): number {
    return grossWpm(this.correctStrokes, this.elapsedMs);
  }

  private spawnEnemy(): void {
    const kind = this.chooseEnemyKind();
    if (kind === 'bracket') {
      this.spawnBracketPair();
      return;
    }
    this.spawnSingle(kind);
  }

  // Spawn one word of the given kind into an open lane, telegraphed and clamped
  // behind any leader so it can't overtake. The plain letters are the only thing
  // the player types; kind drives speed and the renderer's decoration.
  private spawnSingle(kind: EnemyKind, linkId?: number): Enemy | undefined {
    const word = this.selectWordForKind(kind);
    if (word.length === 0) return undefined;
    const halfWidth = this.approxWordWidthPx(word) / 2;
    const laneY = this.pickLaneY(halfWidth, kind);
    const desiredSpeed = this.currentSpeedPxPerSec() * this.kindSpeedFactor(kind, word.length);
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      word,
      typed: 0,
      x: this.width,
      y: laneY,
      speed: this.laneClampedSpeed(laneY, desiredSpeed),
      bigrams: extractBigrams(word),
      active: false,
      spawnFlashMs: SPAWN_TELEGRAPH_MS,
      kind,
    };
    if (linkId !== undefined) enemy.linkId = linkId;
    if (kind === 'bonus') enemy.bonus = true;
    this.enemies.push(enemy);
    this.emit({ type: 'spawn', enemyId: enemy.id, kind });
    return enemy;
  }

  // A bracket is two words sharing a linkId. Clearing one accelerates the other
  // (see onBracketPartnerCleared), so the player must commit to both halves and
  // can't safely abandon the survivor — target-switching is the test here.
  private spawnBracketPair(): void {
    const linkId = this.nextLinkId++;
    const opener = this.spawnSingle('bracket', linkId);
    if (opener) this.spawnSingle('bracket', linkId);
  }

  // Begin a scripted boss: alternate the two encounter scripts by boss number so
  // a run sees both, telegraph it with the calm open, and spawn the whole cast at
  // once. The encounter resolves in onBossConflictCleared when no conflict word
  // remains, which then opens the normal between-wave draft.
  private beginBoss(): void {
    this.bossActive = true;
    const bossNumber = this.waveIndex / BOSS_WAVE_INTERVAL;
    this.bossKind = bossNumber % 2 === 1 ? 'merge' : 'stacktrace';
    this.emit({ type: 'bossstart', kind: this.bossKind });
    if (this.bossKind === 'merge') this.spawnMergeConflict();
    else this.spawnStackTrace();
  }

  // Merge conflict: a real VERTICAL conflict stack sharing one linkId — the HEAD
  // side occupies a contiguous block of upper lanes, the incoming branch side the
  // lanes directly below it. The renderer frames the whole stack as
  // `<<<<<<< HEAD` / head content / `=======` / branch content / `>>>>>>> branch`;
  // the player resolves by clearing the plain tokens. Both blocks share one
  // arrival front so the conflict closes in as a single wall, and both advance
  // slowly so the standoff — not speed — is the drama. Lane budget is split
  // evenly so the encounter fits short and tall panes alike.
  private spawnMergeConflict(): void {
    const linkId = this.nextLinkId++;
    const lanes = laneCenters(this.width, this.height);
    const perSide = Math.max(1, Math.floor(lanes.length / 2));
    const headRows = Math.min(perSide, MERGE_HEAD_TOKENS.length);
    const branchRows = Math.min(lanes.length - headRows, MERGE_BRANCH_TOKENS.length);
    for (let row = 0; row < headRows; row++) {
      this.spawnConflictWord(MERGE_HEAD_TOKENS[row], lanes[row], linkId, 0, 'head');
    }
    for (let row = 0; row < branchRows; row++) {
      this.spawnConflictWord(MERGE_BRANCH_TOKENS[row], lanes[headRows + row], linkId, 0, 'branch');
    }
  }

  // Stack trace: a single column of linked frames cleared top-down, framed by the
  // renderer as `at frame (file:line)` lines beneath a thrown error.
  private spawnStackTrace(): void {
    const linkId = this.nextLinkId++;
    const lanes = laneCenters(this.width, this.height);
    const rows = Math.min(lanes.length, STACK_TRACE_TOKENS.length);
    for (let row = 0; row < rows; row++) {
      this.spawnConflictWord(STACK_TRACE_TOKENS[row], lanes[row], linkId, 0);
    }
  }

  // Place one conflict token in a lane, started further back than a normal spawn
  // (plus a per-column rank so stacked columns don't overlap at spawn) so the
  // encounter reads as a wall to work through. Linked by linkId so the renderer
  // can group an encounter's words; the typed letters are plain.
  private spawnConflictWord(
    word: string,
    laneY: number,
    linkId: number,
    columnRank: number,
    side?: 'head' | 'branch',
  ): void {
    const desiredSpeed = this.currentSpeedPxPerSec() * BOSS_CONFLICT_SPEED_FACTOR;
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      word,
      typed: 0,
      x: this.bossSpawnX(word, columnRank),
      y: laneY,
      speed: this.laneClampedSpeed(laneY, desiredSpeed),
      bigrams: extractBigrams(word),
      active: false,
      spawnFlashMs: SPAWN_TELEGRAPH_MS,
      kind: 'conflict',
      linkId,
    };
    if (side !== undefined) enemy.conflictSide = side;
    this.enemies.push(enemy);
    this.emit({ type: 'spawn', enemyId: enemy.id, kind: 'conflict' });
  }

  // Start conflict words past the right edge so a column reads as an approaching
  // wall; later columns start a further word-width back so stacked sides don't
  // overlap. Anchor-aware so the offset is to the correct side in RTL.
  private bossSpawnX(word: string, columnRank: number): number {
    const wordWidth = this.approxWordWidthPx(word);
    const back = wordWidth * BOSS_SPAWN_BACK_FACTOR + wordWidth * columnRank;
    return this.locale === 'ar' ? this.width - back : this.width + back;
  }

  // A boss is resolved once every conflict word is cleared. Emit bosscleared and
  // fall through to the normal wave-complete flow so the draft still opens. The
  // optional ignore covers the breach path, where marchEnemies has not yet
  // dropped the breaching word from the live list.
  private onBossConflictCleared(ignore?: Enemy): void {
    if (!this.bossActive) return;
    if (this.hasLiveConflictWord(ignore)) return;
    this.bossActive = false;
    this.emit({ type: 'bosscleared', kind: this.bossKind });
    this.completeWave();
  }

  private hasLiveConflictWord(ignore?: Enemy): boolean {
    return this.enemies.some(
      (enemy) =>
        enemy !== ignore && enemy.kind === 'conflict' && enemy.shatter === undefined,
    );
  }

  // Pick this enemy's variant with per-wave weighting: early waves are almost all
  // plain words, and each archetype's share grows as the run deepens so variety —
  // and the decisions it forces — ramps in rather than overwhelming wave one.
  private chooseEnemyKind(): EnemyKind {
    const wave = this.waveIndex;
    let lint = 0;
    let comment = 0;
    let bracket = 0;
    let tank = 0;
    let bonus = 0;
    if (wave >= 2) tank = Math.min(0.18, 0.06 * (wave - 1));
    if (wave >= 2) comment = Math.min(0.16, 0.05 * (wave - 1));
    if (wave >= 3) lint = Math.min(0.16, 0.04 * (wave - 2));
    if (wave >= 3) bracket = Math.min(0.14, 0.04 * (wave - 2));
    if (wave >= 4) bonus = Math.min(0.08, 0.02 * (wave - 3));
    return this.rollKind(lint, comment, bracket, tank, bonus);
  }

  // Roll a kind from its weight; the remaining probability mass is 'normal'.
  // Tank is only granted to a genuinely long word so it reads as a real long
  // identifier rather than an arbitrarily slow short word.
  private rollKind(
    lint: number,
    comment: number,
    bracket: number,
    tank: number,
    bonus: number,
  ): EnemyKind {
    let roll = Math.random();
    if ((roll -= lint) < 0) return 'lint';
    if ((roll -= comment) < 0) return 'comment';
    if ((roll -= bracket) < 0) return 'bracket';
    if ((roll -= bonus) < 0) return 'bonus';
    if ((roll -= tank) < 0) return 'tank';
    return 'normal';
  }

  // Tanks must be long words; resample until the picker yields one long enough to
  // justify the tank framing, then fall back to whatever came last to stay cheap.
  private selectWordForKind(kind: EnemyKind): string {
    const word = selectWord(this.locale, this.weakness, Math.random, this.tuning.weakWordBias);
    if (kind !== 'tank' || word.length >= TANK_MIN_WORD_LENGTH) return word;
    const longer = selectWord(this.locale, this.weakness, Math.random, this.tuning.weakWordBias);
    return longer.length >= word.length ? longer : word;
  }

  // Per-kind march speed: comments crawl (easy to ignore — that's the trap),
  // lints rush as must-kill threats, tanks are slow heavies, bonuses drift a
  // touch quick as fleeting temptations. Normal words keep the length ramp.
  private kindSpeedFactor(kind: EnemyKind, length: number): number {
    switch (kind) {
      case 'comment':
        return COMMENT_SPEED_FACTOR;
      case 'lint':
        return LINT_SPEED_FACTOR;
      case 'tank':
        return TANK_SPEED_FACTOR;
      case 'bonus':
        return BONUS_SPEED_FACTOR;
      default:
        return lengthSpeedFactor(length);
    }
  }

  // Rough on-screen word width in px (the engine has no canvas). Uses the shared
  // field geometry's font sizing with a monospace advance estimate so spacing
  // math stays in lock-step with what the renderer paints.
  private approxWordWidthPx(word: string): number {
    return word.length * fontPxFor(this.width) * 0.62;
  }

  // Center x of a live enemy's word, accounting for the LTR/RTL text anchor.
  private enemyCenterX(enemy: Enemy): number {
    const half = this.approxWordWidthPx(enemy.word) / 2;
    return this.locale === 'ar' ? enemy.x - half : enemy.x + half;
  }

  private pickLaneY(halfWidth: number, kind: EnemyKind): number {
    const lanes = laneCenters(this.width, this.height);
    const open = lanes.filter((laneY) => this.laneHasRoom(laneY, halfWidth));
    const pool = open.length > 0 ? open : lanes;
    return this.biasedTowardHotLane(pool, halfWidth, kind);
  }

  // Give the hot lane meaning at spawn too: when it is live and has room, route a
  // word there with HOT_LANE_SPAWN_BIAS probability so the dangerous row actually
  // sees more traffic. Lints are exempt — a fast lint on a fast lane is an unfair
  // double speed-up — so they always take a uniform pick from the pool.
  private biasedTowardHotLane(pool: number[], halfWidth: number, kind: EnemyKind): number {
    if (
      kind !== 'lint' &&
      !Number.isNaN(this.hotLaneY) &&
      Math.random() < HOT_LANE_SPAWN_BIAS &&
      this.laneHasRoom(this.hotLaneY, halfWidth)
    ) {
      return this.hotLaneY;
    }
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

  // Advance every live word, compacting the list in place (no per-frame array
  // allocation) and dropping finished shatters in the same pass. At most ONE word
  // breaches per tick — the front-most arrival — so a cluster crossing the base
  // line together can't burn the shield then cash several lives in a single
  // silent frame; the rest stay live to be fought (or breach next tick), keeping
  // the death-spiral fightable instead of sudden death.
  private marchEnemies(dtMs: number): void {
    const distance = dtMs / 1000;
    const baseLine = gutterWidthFor(this.width);
    const overflowMultiplier = this.overflowSpeedMultiplier(baseLine);
    const speedCeiling = this.currentSpeedPxPerSec() * MAX_COMBINED_SPEED_FACTOR;
    let writeIndex = 0;
    let breacher: Enemy | undefined;
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) {
        if (enemy.shatter < 1) this.enemies[writeIndex++] = enemy;
        continue;
      }
      enemy.x -= this.marchStep(enemy, overflowMultiplier, speedCeiling, distance);
      if (enemy.x <= baseLine && this.isFrontMostBreacher(enemy, breacher)) {
        breacher = enemy;
      }
      this.enemies[writeIndex++] = enemy;
    }
    this.enemies.length = writeIndex;
    if (breacher) this.breachFrontMost(breacher);
  }

  // The per-tick leftward step for one word: its base speed scaled by the overflow
  // backlog and a live hot lane, then clamped so no stack of multipliers exceeds
  // the combined speed ceiling — fast threats keep a fair reaction distance.
  private marchStep(
    enemy: Enemy,
    overflowMultiplier: number,
    speedCeiling: number,
    distance: number,
  ): number {
    const laneMultiplier = this.isHotLane(enemy.y) ? HOT_LANE_SPEED_MULTIPLIER : 1;
    const effective = Math.min(enemy.speed * overflowMultiplier * laneMultiplier, speedCeiling);
    return effective * distance;
  }

  // The front-most breacher is the one whose leading edge sits nearest the base —
  // the word that has pressed furthest in, so it is the fair one to resolve first.
  private isFrontMostBreacher(enemy: Enemy, current: Enemy | undefined): boolean {
    return current === undefined || this.leadingEdgeX(enemy) < this.leadingEdgeX(current);
  }

  // Resolve the single breaching word, then drop it from the compacted list. A
  // breach can end the run or resolve a boss mid-tick (which clears the field and
  // changes phase) — leave the list alone in that case.
  private breachFrontMost(enemy: Enemy): void {
    this.breach(enemy);
    if (this.phase !== 'playing') return;
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  // Backlog pressure: count live words whose leading edge has crossed into the
  // critical zone just outside the base line, and turn that count into a mild,
  // capped speed multiplier. A crowded field thus accelerates into a visible —
  // but still fightable — death-spiral rather than ending the run outright.
  private overflowSpeedMultiplier(baseLine: number): number {
    const criticalEdge = baseLine + baseLine * OVERFLOW_CRITICAL_FRACTION;
    let backlog = 0;
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) continue;
      if (this.leadingEdgeX(enemy) <= criticalEdge) backlog++;
    }
    const raw = 1 + backlog * OVERFLOW_SPEED_PER_ENEMY;
    return Math.min(raw, this.tuning.overflowSpeedCap);
  }

  // Advance the hot-lane cycle: cool lanes count down to a fresh heat-up, a hot
  // lane counts down to cooling off. Publishes the live hot center into the
  // reused hotLaneYs buffer so the renderer can redden that row's line number.
  private advanceHotLane(dtMs: number): void {
    this.hotLaneTimerMs -= dtMs;
    if (this.hotLaneTimerMs > 0) return;
    if (Number.isNaN(this.hotLaneY)) this.igniteHotLane();
    else this.coolHotLane();
  }

  private igniteHotLane(): void {
    const lanes = laneCenters(this.width, this.height);
    this.hotLaneY = lanes[Math.floor(Math.random() * lanes.length)];
    this.hotLaneTimerMs = HOT_LANE_ACTIVE_MS;
    this.hotLaneYs.length = 0;
    this.hotLaneYs.push(this.hotLaneY);
  }

  private coolHotLane(): void {
    this.hotLaneY = Number.NaN;
    this.hotLaneTimerMs = HOT_LANE_GAP_MS;
    this.hotLaneYs.length = 0;
  }

  private isHotLane(laneY: number): boolean {
    return !Number.isNaN(this.hotLaneY) && Math.abs(laneY - this.hotLaneY) <= 1;
  }

  private breach(enemy: Enemy): void {
    // A shield-absorbed breach still resolves the boss: the conflict word leaves
    // the field either way, so the absorbed path must run the same resolution as
    // a life-costing breach or an absorbed last conflict would soft-lock the run.
    if (this.tryAbsorbBreach()) {
      this.resolveBossOnConflictBreach(enemy);
      return;
    }
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'over';
      this.emit({ type: 'gameover' });
      return;
    }
    this.emit({ type: 'breach' });
    this.applyBreachKindEffect(enemy);
    this.resolveBossOnConflictBreach(enemy);
  }

  // If the breaching word was the boss's last conflict, the encounter is still
  // resolved (the player survived the wall) — let the boss flow into the draft.
  // The breaching enemy is excluded since marchEnemies has not yet dropped it.
  private resolveBossOnConflictBreach(enemy: Enemy): void {
    if (this.bossActive && enemy.kind === 'conflict') this.onBossConflictCleared(enemy);
  }

  // An ignored comment that reaches the base doesn't just cost the life — it
  // replaces itself with a couple of plain words, so letting comments pile up
  // compounds the backlog. Only fires on a real (non-fatal) breach, keeping it
  // fair: a run-ending breach never also dumps extra threats on the field.
  private applyBreachKindEffect(enemy: Enemy): void {
    if (enemy.kind !== 'comment') return;
    for (let spawned = 0; spawned < COMMENT_BREACH_SPAWN_COUNT; spawned++) {
      this.spawnSingle('normal');
    }
  }

  // A breach earned by a strong flow streak costs the combo instead of a life.
  // The combo must be rebuilt before the shield is available again.
  private tryAbsorbBreach(): boolean {
    if (this.combo < this.tuning.breachShieldCombo) return false;
    this.combo = 0;
    this.emit({ type: 'shield' });
    return true;
  }

  private advanceShatters(dtMs: number): void {
    for (const enemy of this.enemies) {
      if (enemy.shatter === undefined) continue;
      enemy.shatter = Math.min(1, enemy.shatter + dtMs / SHATTER_DURATION_MS);
    }
  }

  private findActiveEnemy(): Enemy | undefined {
    return this.enemies.find(
      (enemy) => enemy.active && enemy.shatter === undefined,
    );
  }

  // Lock the candidate word whose leading edge sits closest to the base line —
  // the most urgent breach threat — rather than merely the front-most by raw x.
  // Once locked the word keeps the focus (handleChar prefers findActiveEnemy),
  // so the player must commit to it or abandon it via Backspace; there is no
  // mid-word auto-switching. This makes "finish the long word vs. bail to stop a
  // breach" a deliberate choice.
  private lockMostUrgent(char: string): Enemy | undefined {
    const baseLine = gutterWidthFor(this.width);
    let mostUrgent: Enemy | undefined;
    let smallestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      if (enemy.shatter !== undefined) continue;
      if (enemy.word[enemy.typed] !== char) continue;
      const distance = this.leadingEdgeX(enemy) - baseLine;
      if (distance < smallestDistance) {
        smallestDistance = distance;
        mostUrgent = enemy;
      }
    }
    if (mostUrgent) mostUrgent.active = true;
    return mostUrgent;
  }

  // The word's leading edge — the side nearest the base line. Words march left in
  // both writing directions, so the leading edge is always the left edge: the
  // anchor-aware center minus half the word's painted width.
  private leadingEdgeX(enemy: Enemy): number {
    return this.enemyCenterX(enemy) - this.approxWordWidthPx(enemy.word) / 2;
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

  // A keystroke that matches no live word — a genuine wrong letter. It breaks the
  // combo and sounds the error buzz, but is left out of the accuracy stats and
  // the learning vector (there is no target bigram to attribute it to).
  private registerStrayKey(): void {
    this.combo = 0;
    this.emit({ type: 'miss' });
  }

  private advanceErrorFlashes(dtMs: number): void {
    for (const enemy of this.enemies) {
      if (enemy.errorMs === undefined) continue;
      enemy.errorMs -= dtMs;
      if (enemy.errorMs <= 0) enemy.errorMs = undefined;
    }
  }

  // Count the spawn-telegraph pulse down to nothing; the renderer flashes the
  // lane while it lasts so a new word announces itself before it advances.
  private advanceSpawnFlashes(dtMs: number): void {
    for (const enemy of this.enemies) {
      if (enemy.spawnFlashMs === undefined) continue;
      enemy.spawnFlashMs -= dtMs;
      if (enemy.spawnFlashMs <= 0) enemy.spawnFlashMs = undefined;
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
    this.score += SCORE_PER_SHATTER + comboBonus + this.weakWordBonus(enemy) + this.kindScoreBonus(enemy);
    this.emit({ type: 'shatter', enemyId: enemy.id });
    this.applyShatterKindEffect(enemy);
    // A boss resolves on clearing its last conflict word, not on a quota count;
    // normal waves complete when the destroyed quota is met.
    if (this.bossActive) this.onBossConflictCleared();
    else if (this.destroyedThisWave >= this.waveTarget()) this.completeWave();
  }

  // Clearing a bonus decoy pays the temptation off in score; resolving a boss
  // conflict word pays the climax off. Every other kind adds nothing here (their
  // cost/reward lives in speed and on-breach effects).
  private kindScoreBonus(enemy: Enemy): number {
    if (enemy.kind === 'bonus') return BONUS_SCORE_REWARD;
    if (enemy.kind === 'conflict') return BOSS_CONFLICT_SCORE_REWARD;
    return 0;
  }

  // Clearing one half of a bracket pair makes the surviving partner bolt for the
  // base, so a half-finished pair is a liability — you must commit to both.
  private applyShatterKindEffect(enemy: Enemy): void {
    if (enemy.kind !== 'bracket' || enemy.linkId === undefined) return;
    this.acceleratePartner(enemy.linkId);
  }

  private acceleratePartner(linkId: number): void {
    for (const partner of this.enemies) {
      if (partner.shatter !== undefined) continue;
      if (partner.linkId !== linkId) continue;
      partner.speed *= BRACKET_PARTNER_SPEEDUP;
    }
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
    this.offered = this.rollDraftOffer();
    this.emit({ type: 'wavecomplete', wave: this.waveIndex });
    this.publishStats();
  }

  // Beating a boss pays out the build-defining rare tier: lead the offer with a
  // boss reward, backfilling from the ordinary roll when the rare pool is dry so
  // the draft always presents a full set. Non-boss waves draft as usual.
  private rollDraftOffer(): RunModifier[] {
    if (!this.isBossWave()) return rollModifiers(DRAFT_OFFER_COUNT);
    const rewards = rollBossRewards(1);
    return rewards.concat(rollModifiers(DRAFT_OFFER_COUNT - rewards.length));
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
