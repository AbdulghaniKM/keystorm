// ─── Run modifiers ───────────────────────────────────────────────────────────
// The contents of the between-wave "command palette" draft. Each modifier is a
// real-looking VS Code setting/command whose effect tweaks the run's tuning (or
// state). Type-only import of GameEngine keeps this dependency one-directional.

import type { GameEngine } from '@/game/engine';

// Rarity drives both how often a modifier appears in a draft and how it reads in
// the palette. Higher weight = more common; the rare boss-reward tier is gated to
// a separate offer so it never dilutes the ordinary draw.
export type ModifierRarity = 'common' | 'uncommon' | 'rare';

// Relative draw weights per rarity. A common modifier is ~3x as likely as an
// uncommon one within the same pool.
const RARITY_WEIGHT: Record<ModifierRarity, number> = {
  common: 6,
  uncommon: 2,
  rare: 1,
};

export interface RunModifier {
  id: string;
  /** The fake VS Code setting/command shown as the palette row title. */
  label: string;
  /** Player-facing description of the real effect. */
  detail: string;
  /** Fake category / keybinding hint shown on the right of the row. */
  hint: string;
  /** lucide icon name. */
  icon: string;
  /** Draw rarity; also gates the build-defining boss-reward tier. */
  rarity: ModifierRarity;
  /** True when the same pick may be offered and applied more than once a run. */
  stackable: boolean;
  /**
   * True for meta-progression rewards: excluded from every draft until the player
   * unlocks them across runs (the store registers unlocked ids before play).
   */
  locked?: boolean;
  apply: (engine: GameEngine) => void;
}

export const MODIFIERS: readonly RunModifier[] = [
  {
    id: 'smooth-caret',
    label: 'editor.cursorSmoothCaretAnimation',
    detail: 'Words advance 15% slower',
    hint: 'Preferences',
    icon: 'icon-[lucide--gauge]',
    rarity: 'common',
    stackable: true,
    apply: (engine) => {
      engine.tuning.speedStartPxPerSec *= 0.85;
      engine.tuning.speedMaxPxPerSec *= 0.85;
    },
  },
  {
    id: 'auto-save',
    label: 'files.autoSave: afterDelay',
    detail: 'Restore 1 life',
    hint: 'Preferences',
    icon: 'icon-[lucide--heart-pulse]',
    rarity: 'common',
    stackable: true,
    apply: (engine) => engine.addLives(1),
  },
  {
    id: 'smooth-scrolling',
    label: 'editor.smoothScrolling',
    detail: 'Combo survives longer pauses',
    hint: 'Preferences',
    icon: 'icon-[lucide--waves]',
    rarity: 'common',
    stackable: true,
    apply: (engine) => {
      engine.tuning.flowPauseRatio += 0.8;
    },
  },
  {
    id: 'autofetch',
    label: 'git.autofetch',
    detail: 'Combo is worth more score',
    hint: 'Preferences',
    icon: 'icon-[lucide--trending-up]',
    rarity: 'common',
    stackable: true,
    apply: (engine) => {
      engine.tuning.scorePerCombo += 2;
      engine.tuning.comboScoreCap += 15;
    },
  },
  {
    id: 'zen-mode',
    label: 'workbench.action.toggleZenMode',
    detail: 'Drill your weak keys for bonus score',
    hint: 'View',
    icon: 'icon-[lucide--crosshair]',
    rarity: 'uncommon',
    stackable: false,
    apply: (engine) => {
      engine.tuning.weakWordBias = 0.7;
      engine.tuning.weakWordScoreBonus += 8;
    },
  },
  {
    id: 'word-wrap',
    label: 'editor.wordWrap: off',
    detail: 'Fewer words spawn, slightly more score',
    hint: 'Preferences',
    icon: 'icon-[lucide--wrap-text]',
    rarity: 'common',
    stackable: true,
    apply: (engine) => {
      engine.tuning.spawnIntervalStartMs += 400;
      engine.tuning.spawnIntervalFloorMs += 150;
      engine.tuning.scorePerCombo += 1;
    },
  },

  // ── Trade-off picks: a strong upside paid for with a real downside. ──────────
  {
    id: 'optimize-build',
    label: 'typescript.tsserver.experimental.optimize',
    detail: '2x combo score, but words advance 25% faster',
    hint: 'Workspace',
    icon: 'icon-[lucide--zap]',
    rarity: 'uncommon',
    stackable: true,
    apply: (engine) => {
      engine.tuning.scorePerCombo *= 2;
      engine.tuning.comboScoreCap *= 2;
      engine.tuning.speedStartPxPerSec *= 1.25;
      engine.tuning.speedMaxPxPerSec *= 1.25;
    },
  },
  {
    id: 'verbose-logging',
    label: 'editor.logLevel: trace',
    detail: 'Words advance 20% slower, but -1 max life',
    hint: 'Workspace',
    icon: 'icon-[lucide--file-text]',
    rarity: 'uncommon',
    stackable: false,
    apply: (engine) => {
      engine.tuning.speedStartPxPerSec *= 0.8;
      engine.tuning.speedMaxPxPerSec *= 0.8;
      engine.addLives(-1);
    },
  },
  {
    id: 'hardened',
    label: 'security.workspace.trust.hardened',
    detail: 'Shield triggers at a lower combo, but combo scores less',
    hint: 'Workspace',
    icon: 'icon-[lucide--shield]',
    rarity: 'uncommon',
    stackable: true,
    apply: (engine) => {
      engine.tuning.breachShieldCombo = Math.max(8, engine.tuning.breachShieldCombo - 6);
      engine.tuning.scorePerCombo = Math.max(1, engine.tuning.scorePerCombo - 1);
    },
  },
  {
    id: 'hotfix',
    label: 'git.rebaseWhenSync',
    detail: 'Words spawn faster, but the backlog hits a higher speed ceiling',
    hint: 'Workspace',
    icon: 'icon-[lucide--flame]',
    rarity: 'uncommon',
    stackable: true,
    apply: (engine) => {
      engine.tuning.spawnIntervalStartMs = Math.max(
        engine.tuning.spawnIntervalFloorMs,
        engine.tuning.spawnIntervalStartMs - 300,
      );
      engine.tuning.overflowSpeedCap += 0.4;
    },
  },
  {
    id: 'incremental-build',
    label: 'typescript.tsc.incremental',
    detail: 'Restore 1 life, but combo decays after shorter pauses',
    hint: 'Workspace',
    icon: 'icon-[lucide--timer]',
    rarity: 'uncommon',
    stackable: false,
    apply: (engine) => {
      engine.addLives(1);
      engine.tuning.flowPauseRatio = Math.max(0.5, engine.tuning.flowPauseRatio - 0.5);
    },
  },

  // ── Rare boss-reward tier: build-defining, offered only after a boss wave. ────
  {
    id: 'copilot-autopilot',
    label: 'github.copilot.advanced.autopilot',
    detail: 'Backlog can no longer accelerate words, but they all start faster',
    hint: 'Boss reward',
    icon: 'icon-[lucide--bot]',
    rarity: 'rare',
    stackable: false,
    apply: (engine) => {
      engine.tuning.overflowSpeedCap = 1;
      engine.tuning.speedStartPxPerSec *= 1.2;
      engine.tuning.speedMaxPxPerSec *= 1.2;
    },
  },
  {
    id: 'release-pipeline',
    label: 'workbench.action.release.pipeline',
    detail: 'Triple combo score and a free shield, but only 1 life',
    hint: 'Boss reward',
    icon: 'icon-[lucide--rocket]',
    rarity: 'rare',
    stackable: false,
    apply: (engine) => {
      engine.tuning.scorePerCombo *= 3;
      engine.tuning.comboScoreCap *= 2;
      engine.tuning.breachShieldCombo = Math.max(5, engine.tuning.breachShieldCombo - 12);
    },
  },

  // ── Unlockable tier: earned through weakness mastery across runs, then offered
  // in ordinary drafts like any other pick (see src/game/progression.ts). ──────
  {
    id: 'muscle-memory',
    label: 'editor.suggest.preview',
    detail: 'Combo survives much longer pauses and scores more',
    hint: 'Unlocked',
    icon: 'icon-[lucide--brain]',
    rarity: 'uncommon',
    stackable: true,
    locked: true,
    apply: (engine) => {
      engine.tuning.flowPauseRatio += 1.2;
      engine.tuning.scorePerCombo += 2;
    },
  },
  {
    id: 'pair-programmer',
    label: 'liveshare.autoShareServers',
    detail: 'Start every run with +1 life',
    hint: 'Unlocked',
    icon: 'icon-[lucide--users]',
    rarity: 'uncommon',
    stackable: true,
    locked: true,
    apply: (engine) => engine.addLives(1),
  },
  {
    id: 'tab-completion',
    label: 'editor.tabCompletion: on',
    detail: 'Drill weak keys for a large score bonus',
    hint: 'Unlocked',
    icon: 'icon-[lucide--keyboard]',
    rarity: 'uncommon',
    stackable: false,
    locked: true,
    apply: (engine) => {
      engine.tuning.weakWordBias = 0.6;
      engine.tuning.weakWordScoreBonus += 14;
    },
  },
  {
    id: 'linter-clean',
    label: 'eslint.run: onType',
    detail: 'Shield triggers sooner and combo scores more',
    hint: 'Unlocked',
    icon: 'icon-[lucide--badge-check]',
    rarity: 'uncommon',
    stackable: true,
    locked: true,
    apply: (engine) => {
      engine.tuning.breachShieldCombo = Math.max(8, engine.tuning.breachShieldCombo - 8);
      engine.tuning.scorePerCombo += 1;
    },
  },
];

// Meta-progression hands these ids to the engine's draft pool before a run; a
// locked modifier stays out of every draw until its id is registered here. The
// set is module-level mutable state because the engine calls rollModifiers with
// no caller-supplied pool — the store is the single writer (registerUnlocked).
const unlockedModifierIds = new Set<string>();

/** Register the modifier ids the player has unlocked so drafts may offer them. */
export function registerUnlocked(modifierIds: Iterable<string>): void {
  unlockedModifierIds.clear();
  for (const id of modifierIds) unlockedModifierIds.add(id);
}

/** A modifier is draftable when it is not locked, or its lock has been opened. */
function isDraftable(modifier: RunModifier): boolean {
  return !modifier.locked || unlockedModifierIds.has(modifier.id);
}

/** Pick one modifier from `pool` weighted by rarity, removing it from `pool`. */
function takeWeighted(pool: RunModifier[], rng: () => number): RunModifier {
  let totalWeight = 0;
  for (const modifier of pool) totalWeight += RARITY_WEIGHT[modifier.rarity];
  let target = rng() * totalWeight;
  for (let index = 0; index < pool.length; index += 1) {
    target -= RARITY_WEIGHT[pool[index].rarity];
    if (target < 0) return pool.splice(index, 1)[0];
  }
  return pool.splice(pool.length - 1, 1)[0];
}

/**
 * Draw `count` distinct modifiers for an ordinary between-wave offer, weighted by
 * rarity (no repeats within one offer). The build-defining rare tier is excluded
 * here so it only appears as a boss reward.
 */
export function rollModifiers(count: number, rng: () => number = Math.random): RunModifier[] {
  const pool = MODIFIERS.filter((modifier) => modifier.rarity !== 'rare' && isDraftable(modifier));
  const chosen: RunModifier[] = [];
  while (chosen.length < count && pool.length > 0) {
    chosen.push(takeWeighted(pool, rng));
  }
  return chosen;
}

/**
 * Draw `count` distinct boss-reward modifiers — the rare, build-defining tier —
 * for the post-boss draft. Falls back to nothing extra when the rare pool runs
 * dry so the caller can backfill from the ordinary roll.
 */
export function rollBossRewards(count: number, rng: () => number = Math.random): RunModifier[] {
  const pool = MODIFIERS.filter((modifier) => modifier.rarity === 'rare' && isDraftable(modifier));
  const chosen: RunModifier[] = [];
  while (chosen.length < count && pool.length > 0) {
    chosen.push(takeWeighted(pool, rng));
  }
  return chosen;
}
