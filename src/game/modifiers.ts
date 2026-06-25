// ─── Run modifiers ───────────────────────────────────────────────────────────
// The contents of the between-wave "command palette" draft. Each modifier is a
// real-looking VS Code setting/command whose effect tweaks the run's tuning (or
// state). Type-only import of GameEngine keeps this dependency one-directional.

import type { GameEngine } from '@/game/engine';

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
  apply: (engine: GameEngine) => void;
}

export const MODIFIERS: readonly RunModifier[] = [
  {
    id: 'smooth-caret',
    label: 'editor.cursorSmoothCaretAnimation',
    detail: 'Words advance 15% slower',
    hint: 'Preferences',
    icon: 'icon-[lucide--gauge]',
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
    apply: (engine) => engine.addLives(1),
  },
  {
    id: 'smooth-scrolling',
    label: 'editor.smoothScrolling',
    detail: 'Combo survives longer pauses',
    hint: 'Preferences',
    icon: 'icon-[lucide--waves]',
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
    apply: (engine) => {
      engine.tuning.spawnIntervalStartMs += 400;
      engine.tuning.spawnIntervalFloorMs += 150;
      engine.tuning.scorePerCombo += 1;
    },
  },
];

/** Draw `count` distinct modifiers for an offer (no repeats within one offer). */
export function rollModifiers(count: number, rng: () => number = Math.random): RunModifier[] {
  const pool = [...MODIFIERS];
  const chosen: RunModifier[] = [];
  while (chosen.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
}
