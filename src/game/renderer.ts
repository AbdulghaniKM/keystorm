// ─── Keystorm Canvas 2D renderer ─────────────────────────────────────────────
// Framework-agnostic. Reads theme colors from CSS custom properties so the
// canvas tracks the active skin, then paints the marching words as plain
// syntax-colored code tokens over a flat editor background. The vscode skin is
// a deliberate disguise: the field must read as a developer editing a file, so
// there is no grid, no glow, no neon — just code on #1e1e1e. Tuned for low
// per-frame allocation.

import type { GameEngine } from '@/game/engine';
import type { Enemy, Locale } from '@/game/types';
import { fontPxFor, gutterWidthFor, rowHeightFor } from '@/game/layout';

export interface RenderColors {
  base: string;
  enemy: string;
  enemyActive: string;
  typed: string;
  remaining: string;
  text: string;
  accent: string;
  danger: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  outline: string;
  glow: string;
}

const COLOR_FALLBACKS: RenderColors = {
  base: '#aeafad',
  enemy: '#858585',
  enemyActive: '#dcdcaa',
  typed: '#6a9955',
  remaining: '#d4d4d4',
  text: '#d4d4d4',
  accent: '#dcdcaa',
  danger: '#f14c4c',
  background: '#1e1e1e',
  surface: '#252526',
  surfaceElevated: '#2d2d2d',
  outline: '#2b2b2b',
  glow: '#569cd6',
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

export function readRenderColors(el: HTMLElement): RenderColors {
  const styles = getComputedStyle(el);
  return {
    base: readVar(styles, '--color-primary', COLOR_FALLBACKS.base),
    enemy: readVar(styles, '--color-text-secondary', COLOR_FALLBACKS.enemy),
    enemyActive: readVar(styles, '--color-accent', COLOR_FALLBACKS.enemyActive),
    typed: readVar(styles, '--color-success', COLOR_FALLBACKS.typed),
    remaining: readVar(styles, '--color-text', COLOR_FALLBACKS.remaining),
    text: readVar(styles, '--color-text', COLOR_FALLBACKS.text),
    accent: readVar(styles, '--color-accent', COLOR_FALLBACKS.accent),
    danger: readVar(styles, '--color-error', COLOR_FALLBACKS.danger),
    background: readVar(styles, '--color-background', COLOR_FALLBACKS.background),
    surface: readVar(styles, '--color-surface', COLOR_FALLBACKS.surface),
    surfaceElevated: readVar(styles, '--color-surface-elevated', COLOR_FALLBACKS.surfaceElevated),
    outline: readVar(styles, '--color-border', COLOR_FALLBACKS.outline),
    glow: readVar(styles, '--color-glow', COLOR_FALLBACKS.glow),
  };
}

// Canvas 2D font strings do NOT support CSS var() — they silently fall back to
// 10px sans-serif. Mirror the editor's --font-mono so the words read like code,
// with IBM Plex Sans (Arabic) tailing the chain: the coding monospaces have no
// Arabic glyphs, so the browser falls back to it per-glyph for ع/ar runs.
const FONT_FAMILY =
  '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", "SF Mono", ui-monospace, "IBM Plex Sans", monospace';
const PROXIMITY_RANGE_FRACTION = 0.4;
// A small, restrained screen shake on impact — enough to register, never a jolt
// that would betray a game running behind the editor disguise.
const SHAKE_PIXELS_PER_MS = 0.02;
const SHAKE_MAX_PX = 6;

const GUTTER_FONT_SCALE = 0.82;
const ACTIVE_LINE_ALPHA = 0.4;
// Horizontal padding for the selection rectangle drawn behind the active word.
const SELECTION_PADDING_X = 4;
const SELECTION_PADDING_Y = 3;
const SELECTION_ALPHA = 0.55;
// Blinking caret drawn at the active word's typed offset, like the editor caret.
const CARET_BLINK_MS = 1000;

// ─── Danger zones ────────────────────────────────────────────────────────────
// Discrete proximity bands (0 = just spawned, 1 = at the gutter). The critical
// band earns the red diagnostics squiggle and a red line number; everything
// dims with distance so the nearest threat reads as the brightest.
const CRITICAL_NEARNESS = 0.78;
const SQUIGGLE_AMPLITUDE = 2.5;
const SQUIGGLE_STEP = 4;
const MIN_WORD_ALPHA = 0.55;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class GameRenderer {
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  resize(cssW: number, cssH: number, dpr: number): void {
    const canvas = this.ctx.canvas;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = cssW;
    this.cssHeight = cssH;
  }

  draw(engine: GameEngine, locale: Locale, colors: RenderColors, shakeMs: number): void {
    const { ctx } = this;
    const width = this.cssWidth;
    const enemies = engine.enemies;
    const px = fontPxFor(width);
    const rowHeight = rowHeightFor(width);
    const gutter = gutterWidthFor(width);

    const proximity = this.nearestThreatProximity(enemies, gutter, width);
    const frontMost = this.frontMostEnemy(enemies);
    const highlights = this.gutterHighlights(enemies, frontMost, rowHeight, gutter, width, colors);

    ctx.clearRect(0, 0, width, this.cssHeight);
    // The editor body renders outside the shake transform so the structure stays
    // steady while impacts nudge only the words.
    this.drawEditorField(colors, px, rowHeight, gutter, highlights, proximity);
    ctx.save();
    this.applyShake(shakeMs);
    this.drawEnemies(enemies, locale, colors, px, gutter, width);
    ctx.restore();
  }

  // Full-bleed editor body: a flat fill, a current-line highlight, and a real
  // line-number gutter. Line numbers double as the game HUD: red on a word in
  // the critical zone, accent on the front-most "next up" word (with a current-
  // line ▶ marker), and a green flash on the row of a word being cleared.
  private drawEditorField(
    colors: RenderColors,
    px: number,
    rowHeight: number,
    gutterWidth: number,
    highlights: Map<number, string>,
    proximity: number,
  ): void {
    const { ctx } = this;
    const width = this.cssWidth;
    const height = this.cssHeight;

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Current-line highlight, like the caret's row in a real editor.
    const activeRow = Math.floor(height / 2 / rowHeight);
    ctx.globalAlpha = ACTIVE_LINE_ALPHA;
    ctx.fillStyle = colors.surfaceElevated;
    ctx.fillRect(gutterWidth, activeRow * rowHeight, width - gutterWidth, rowHeight);
    ctx.globalAlpha = 1;

    // Gutter divider doubles as the base line — it reddens and thickens as the
    // nearest word closes in, so the danger lives on the editor's own chrome.
    ctx.strokeStyle = proximity > 0.55 ? colors.danger : colors.outline;
    ctx.lineWidth = 1 + proximity * 1.5;
    ctx.beginPath();
    ctx.moveTo(gutterWidth, 0);
    ctx.lineTo(gutterWidth, height);
    ctx.stroke();

    // Line numbers down the full height, recolored per row by the game state.
    ctx.font = `${Math.round(px * GUTTER_FONT_SCALE)}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    let lineNumber = 1;
    for (let y = rowHeight / 2; y < height; y += rowHeight) {
      const color = highlights.get(lineNumber - 1) ?? colors.enemy;
      if (color === colors.accent) this.drawNextUpMarker(y, px, colors.accent);
      ctx.fillStyle = color;
      ctx.fillText(String(lineNumber), gutterWidth - 8, y);
      lineNumber++;
    }

    ctx.restore();
  }

  // A small ▶ in the gutter on the front-most word's row — the editor's current-
  // line indicator, repurposed as the "clear this one next" cue.
  private drawNextUpMarker(centerY: number, px: number, color: string): void {
    const { ctx } = this;
    const size = px * 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(3, centerY - size);
    ctx.lineTo(3 + size, centerY);
    ctx.lineTo(3, centerY + size);
    ctx.closePath();
    ctx.fill();
  }

  private applyShake(shakeMs: number): void {
    if (shakeMs <= 0) return;
    const magnitude = Math.min(shakeMs * SHAKE_PIXELS_PER_MS, SHAKE_MAX_PX);
    const offsetX = (Math.random() - 0.5) * 2 * magnitude;
    const offsetY = (Math.random() - 0.5) * 2 * magnitude;
    this.ctx.translate(offsetX, offsetY);
  }

  // How close (0..1) a word's left edge sits to the gutter/base line.
  private nearness(enemy: Enemy, gutter: number, width: number): number {
    const range = width * PROXIMITY_RANGE_FRACTION;
    return 1 - clamp01((enemy.x - gutter) / range);
  }

  private nearestThreatProximity(enemies: Enemy[], gutter: number, width: number): number {
    let closest = 0;
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) continue;
      const nearness = this.nearness(enemy, gutter, width);
      if (nearness > closest) closest = nearness;
    }
    return closest;
  }

  private frontMostEnemy(enemies: Enemy[]): Enemy | undefined {
    let front: Enemy | undefined;
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) continue;
      if (!front || enemy.x < front.x) front = enemy;
    }
    return front;
  }

  // Map each interesting word to a line-number color: a clearing word flashes
  // green, a critical word burns red, and the front-most word gets the accent
  // "next up" cue. Keyed by row index (line number − 1).
  private gutterHighlights(
    enemies: Enemy[],
    frontMost: Enemy | undefined,
    rowHeight: number,
    gutter: number,
    width: number,
    colors: RenderColors,
  ): Map<number, string> {
    const map = new Map<number, string>();
    for (const enemy of enemies) {
      const row = Math.round(enemy.y / rowHeight - 0.5);
      if (row < 0) continue;
      if (enemy.shatter !== undefined) {
        map.set(row, colors.typed);
      } else if (this.nearness(enemy, gutter, width) >= CRITICAL_NEARNESS) {
        map.set(row, colors.danger);
      }
    }
    if (frontMost) {
      const row = Math.round(frontMost.y / rowHeight - 0.5);
      if (row >= 0 && !map.has(row)) map.set(row, colors.accent);
    }
    return map;
  }

  private drawEnemies(
    enemies: Enemy[],
    locale: Locale,
    colors: RenderColors,
    px: number,
    gutter: number,
    width: number,
  ): void {
    const { ctx } = this;
    ctx.font = `400 ${px}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) {
        this.drawShatter(enemy, locale, colors, px);
        continue;
      }
      const near = this.nearness(enemy, gutter, width);
      const critical = near >= CRITICAL_NEARNESS;
      const alpha = enemy.active ? 1 : MIN_WORD_ALPHA + (1 - MIN_WORD_ALPHA) * near;
      if (locale === 'ar') {
        this.drawArabicEnemy(enemy, colors, px, alpha, critical);
      } else {
        this.drawLatinEnemy(enemy, colors, px, alpha, critical);
      }
    }
  }

  // A faint text-selection rectangle behind the active word, the same gesture as
  // selecting a token in the editor. Drawn under the glyphs so they stay crisp.
  private drawSelection(left: number, width: number, centerY: number, px: number, colors: RenderColors): void {
    const { ctx } = this;
    const height = px + SELECTION_PADDING_Y * 2;
    ctx.save();
    ctx.globalAlpha = SELECTION_ALPHA;
    ctx.fillStyle = colors.surfaceElevated;
    ctx.fillRect(left - SELECTION_PADDING_X, centerY - height / 2, width + SELECTION_PADDING_X * 2, height);
    ctx.restore();
  }

  private drawLatinEnemy(
    enemy: Enemy,
    colors: RenderColors,
    px: number,
    alpha: number,
    critical: boolean,
  ): void {
    const { ctx } = this;
    const typedText = enemy.word.slice(0, enemy.typed);
    const remainingText = enemy.word.slice(enemy.typed);
    const wordWidth = ctx.measureText(enemy.word).width;
    const typedWidth = ctx.measureText(typedText).width;
    const erroring = (enemy.errorMs ?? 0) > 0;

    if (enemy.active) this.drawSelection(enemy.x, wordWidth, enemy.y, px, colors);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.typed;
    ctx.fillText(typedText, enemy.x, enemy.y);
    ctx.fillStyle = this.remainingColor(enemy.active, erroring, colors);
    ctx.fillText(remainingText, enemy.x + typedWidth, enemy.y);
    ctx.restore();

    this.drawProgressUnderline(enemy.x, wordWidth, enemy, colors, enemy.y + px * 0.5, alpha);
    this.drawWordStatus(enemy.x, wordWidth, enemy.y, px, erroring, critical, colors);

    if (enemy.active) this.drawCaret(enemy.x + typedWidth, enemy.y, px, colors.text);
  }

  private drawArabicEnemy(
    enemy: Enemy,
    colors: RenderColors,
    px: number,
    alpha: number,
    critical: boolean,
  ): void {
    const { ctx } = this;
    const wordWidth = ctx.measureText(enemy.word).width;
    const erroring = (enemy.errorMs ?? 0) > 0;
    const left = enemy.x - wordWidth;

    if (enemy.active) this.drawSelection(left, wordWidth, enemy.y, px, colors);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = this.remainingColor(enemy.active, erroring, colors);
    ctx.fillText(enemy.word, enemy.x, enemy.y);
    ctx.restore();

    // Arabic underline is right-anchored from enemy.x leftward.
    this.drawProgressUnderline(left, wordWidth, enemy, colors, enemy.y + px * 0.6, alpha);
    this.drawWordStatus(left, wordWidth, enemy.y, px, erroring, critical, colors);
  }

  // Non-color-only feedback below every word: a red strike-through while a typo
  // is live (errorMs), or a red diagnostics squiggle once it enters the critical
  // zone — the squiggle reads exactly like an editor error, and the shape (not
  // just the color) carries the warning for color-blind players.
  private drawWordStatus(
    left: number,
    width: number,
    centerY: number,
    px: number,
    erroring: boolean,
    critical: boolean,
    colors: RenderColors,
  ): void {
    if (erroring) {
      this.drawStrike(left, width, centerY, colors.danger);
    } else if (critical) {
      this.drawSquiggle(left, width, centerY + px * 0.82, colors.danger);
    }
  }

  // Progress bar under the word: the whole span faint, the typed fraction solid
  // green — mirrors the editor's inline diff/coverage gutter.
  private drawProgressUnderline(
    left: number,
    wordWidth: number,
    enemy: Enemy,
    colors: RenderColors,
    underlineY: number,
    alpha: number,
  ): void {
    const { ctx } = this;
    const fraction = enemy.word.length > 0 ? enemy.typed / enemy.word.length : 0;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.25 * alpha;
    ctx.strokeStyle = colors.enemy;
    ctx.beginPath();
    ctx.moveTo(left, underlineY);
    ctx.lineTo(left + wordWidth, underlineY);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors.typed;
    ctx.beginPath();
    ctx.moveTo(left, underlineY);
    ctx.lineTo(left + wordWidth * fraction, underlineY);
    ctx.stroke();
    ctx.restore();
  }

  private drawStrike(left: number, width: number, centerY: number, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, centerY);
    ctx.lineTo(left + width, centerY);
    ctx.stroke();
    ctx.restore();
  }

  private drawSquiggle(left: number, width: number, y: number, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, y);
    let up = true;
    for (let x = left; x <= left + width; x += SQUIGGLE_STEP) {
      ctx.lineTo(x, y + (up ? -SQUIGGLE_AMPLITUDE : SQUIGGLE_AMPLITUDE));
      up = !up;
    }
    ctx.stroke();
    ctx.restore();
  }

  // A blinking caret at the active word's typed offset — the editing cursor.
  private drawCaret(x: number, centerY: number, px: number, color: string): void {
    if (performance.now() % CARET_BLINK_MS >= CARET_BLINK_MS / 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, centerY - px / 2, 2, px);
    ctx.restore();
  }

  // Remaining glyphs: error red while mistyped, function-yellow on the locked
  // target, plain editor foreground otherwise.
  private remainingColor(active: boolean, erroring: boolean, colors: RenderColors): string {
    if (erroring) return colors.danger;
    if (active) return colors.enemyActive;
    return colors.text;
  }

  // A cleared word doesn't explode — it fades and shrinks like text being
  // deleted from the buffer. No additive blending, no glow, no motes.
  private drawShatter(enemy: Enemy, locale: Locale, colors: RenderColors, px: number): void {
    const { ctx } = this;
    const progress = enemy.shatter ?? 0;
    const fade = 1 - progress;
    const scale = 1 - progress * 0.4;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `400 ${px}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.translate(enemy.x, enemy.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = colors.typed;
    if (locale === 'ar') {
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
    } else {
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
    }
    ctx.fillText(enemy.word, 0, 0);
    ctx.restore();
  }
}
