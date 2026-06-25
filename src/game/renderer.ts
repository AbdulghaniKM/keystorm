// ─── Keystorm Canvas 2D renderer ─────────────────────────────────────────────
// Framework-agnostic. Reads theme colors from CSS custom properties so the
// canvas tracks the active skin, then paints the marching words as plain
// syntax-colored code tokens over a flat editor background. The vscode skin is
// a deliberate disguise: the field must read as a developer editing a file, so
// there is no grid, no glow, no neon — just code on #1e1e1e. Tuned for low
// per-frame allocation.

import type { GameEngine } from '@/game/engine';
import type { Enemy, Locale } from '@/game/types';

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

const BASE_ZONE_FRACTION = 0.08;
// Canvas 2D font strings do NOT support CSS var() — they silently fall back to
// 10px sans-serif. Mirror the editor's --font-mono so the words read like code,
// with IBM Plex Sans (Arabic) tailing the chain: the coding monospaces have no
// Arabic glyphs, so the browser falls back to it per-glyph for ع/ar runs.
const FONT_FAMILY =
  '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", "SF Mono", ui-monospace, "IBM Plex Sans", monospace';
const FONT_MIN_PX = 18;
const FONT_MAX_PX = 28;
// Word size is tied to field WIDTH (not height) so it stays proportional to the
// rem-based UI at any browser zoom, and never balloons on tall play areas.
const FONT_WIDTH_DIVISOR = 38;
const PROXIMITY_RANGE_FRACTION = 0.35;
// A small, restrained screen shake on impact — enough to register, never a jolt
// that would betray a game running behind the editor disguise.
const SHAKE_PIXELS_PER_MS = 0.02;
const SHAKE_MAX_PX = 6;

// ─── Editor field ────────────────────────────────────────────────────────────
// The play-field IS the editor body — full-bleed, no box. A line-number gutter
// runs the full height and the words flow across the entire code surface, so the
// player gets the whole editor instead of a cramped square.
const ROW_HEIGHT_FACTOR = 1.6;
const GUTTER_FONT_SCALE = 0.82;
const ACTIVE_LINE_ALPHA = 0.4;
// Horizontal padding for the selection rectangle drawn behind the active word.
const SELECTION_PADDING_X = 4;
const SELECTION_PADDING_Y = 3;
const SELECTION_ALPHA = 0.55;
// Blinking caret drawn at the active word's typed offset, like the editor caret.
const CARET_BLINK_MS = 1000;

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
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    // The editor body renders outside the shake transform so the structure stays
    // steady while impacts nudge only the words and the cursor column.
    this.drawEditorField(colors);
    ctx.save();
    this.applyShake(shakeMs);
    this.drawCursorColumn(engine.enemies, colors);
    this.drawEnemies(engine.enemies, locale, colors);
    ctx.restore();
  }

  // Full-bleed editor body: a flat fill, a current-line highlight, and a real
  // line-number gutter numbered top to bottom. The words march across the whole
  // surface — there is no boxed arena.
  private drawEditorField(colors: RenderColors): void {
    const { ctx } = this;
    const width = this.cssWidth;
    const height = this.cssHeight;
    const px = this.fontPx();
    const rowHeight = Math.round(px * ROW_HEIGHT_FACTOR);
    const gutterWidth = this.gutterWidth();

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Current-line highlight, like the caret's row in a real editor.
    const activeRow = Math.floor(height / 2 / rowHeight);
    ctx.globalAlpha = ACTIVE_LINE_ALPHA;
    ctx.fillStyle = colors.surfaceElevated;
    ctx.fillRect(gutterWidth, activeRow * rowHeight, width - gutterWidth, rowHeight);
    ctx.globalAlpha = 1;

    // Gutter divider hairline.
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gutterWidth, 0);
    ctx.lineTo(gutterWidth, height);
    ctx.stroke();

    // Line numbers down the full height.
    ctx.fillStyle = colors.enemy;
    ctx.font = `${Math.round(px * GUTTER_FONT_SCALE)}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    let lineNumber = 1;
    for (let y = rowHeight / 2; y < height; y += rowHeight) {
      ctx.fillText(String(lineNumber), gutterWidth - 8, y);
      lineNumber++;
    }

    ctx.restore();
  }

  // Gutter width tracks the font but never crowds the words' stop line.
  private gutterWidth(): number {
    return Math.min(this.fontPx() * 3, this.baseWidth() * 0.85);
  }

  private fontPx(): number {
    const scaled = Math.round(this.cssWidth / FONT_WIDTH_DIVISOR);
    return Math.max(FONT_MIN_PX, Math.min(FONT_MAX_PX, scaled));
  }

  private applyShake(shakeMs: number): void {
    if (shakeMs <= 0) return;
    const magnitude = Math.min(shakeMs * SHAKE_PIXELS_PER_MS, SHAKE_MAX_PX);
    const offsetX = (Math.random() - 0.5) * 2 * magnitude;
    const offsetY = (Math.random() - 0.5) * 2 * magnitude;
    this.ctx.translate(offsetX, offsetY);
  }

  private baseWidth(): number {
    return this.cssWidth * BASE_ZONE_FRACTION;
  }

  // The base zone reads as an editor cursor column: a faint selection-tint band
  // that deepens as words close in, capped by a thin cursor-color line. No glow,
  // no danger red — just the kind of caret + selection you'd see while editing.
  private drawCursorColumn(enemies: Enemy[], colors: RenderColors): void {
    const { ctx } = this;
    const columnX = this.baseWidth();
    const proximity = this.nearestThreatProximity(enemies);

    ctx.save();

    const band = ctx.createLinearGradient(0, 0, columnX, 0);
    const bandAlpha = 0.08 + proximity * 0.18;
    band.addColorStop(0, this.withAlpha(colors.glow, bandAlpha));
    band.addColorStop(1, this.withAlpha(colors.glow, 0));
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, columnX, this.cssHeight);

    ctx.strokeStyle = colors.base;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(columnX, 0);
    ctx.lineTo(columnX, this.cssHeight);
    ctx.stroke();

    ctx.restore();
  }

  // Appends a hex alpha byte to a #rrggbb token; falls back to globalAlpha-safe
  // solid color for non-hex tokens so gradients always receive a valid stop.
  private withAlpha(color: string, alpha: number): string {
    if (color.length !== 7 || color.charAt(0) !== '#') return color;
    const byte = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    return color + byte.toString(16).padStart(2, '0');
  }

  private nearestThreatProximity(enemies: Enemy[]): number {
    const baseX = this.baseWidth();
    const range = this.cssWidth * PROXIMITY_RANGE_FRACTION;
    let closest = 0;
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) continue;
      const distance = enemy.x - baseX;
      if (distance < 0) continue;
      const nearness = 1 - Math.min(distance / range, 1);
      if (nearness > closest) closest = nearness;
    }
    return closest;
  }

  private drawEnemies(enemies: Enemy[], locale: Locale, colors: RenderColors): void {
    const { ctx } = this;
    const px = this.fontPx();
    ctx.font = `400 ${px}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) {
        this.drawShatter(enemy, locale, colors);
      } else if (locale === 'ar') {
        this.drawArabicEnemy(enemy, colors, px);
      } else {
        this.drawLatinEnemy(enemy, colors, px);
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

  private drawLatinEnemy(enemy: Enemy, colors: RenderColors, px: number): void {
    const { ctx } = this;
    const typedText = enemy.word.slice(0, enemy.typed);
    const remainingText = enemy.word.slice(enemy.typed);
    const wordWidth = ctx.measureText(enemy.word).width;
    const erroring = (enemy.errorMs ?? 0) > 0;

    if (enemy.active) {
      this.drawSelection(enemy.x, wordWidth, enemy.y, px, colors);
    }

    ctx.save();
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.typed;
    ctx.fillText(typedText, enemy.x, enemy.y);
    const typedWidth = ctx.measureText(typedText).width;
    ctx.fillStyle = this.remainingColor(enemy.active, erroring, colors);
    ctx.fillText(remainingText, enemy.x + typedWidth, enemy.y);
    if (enemy.active) this.drawCaret(enemy.x + typedWidth, enemy.y, px, colors.text);
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

  private drawArabicEnemy(enemy: Enemy, colors: RenderColors, px: number): void {
    const { ctx } = this;
    const wordWidth = ctx.measureText(enemy.word).width;
    const erroring = (enemy.errorMs ?? 0) > 0;
    const left = enemy.x - wordWidth;

    if (enemy.active) {
      this.drawSelection(left, wordWidth, enemy.y, px, colors);
    }

    ctx.save();
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = this.remainingColor(enemy.active, erroring, colors);
    ctx.fillText(enemy.word, enemy.x, enemy.y);
    this.drawProgressUnderline(enemy, wordWidth, colors, px);
    ctx.restore();
  }

  private drawProgressUnderline(
    enemy: Enemy,
    wordWidth: number,
    colors: RenderColors,
    px: number,
  ): void {
    const { ctx } = this;
    const fraction = enemy.word.length > 0 ? enemy.typed / enemy.word.length : 0;
    const underlineY = enemy.y + px * 0.6;
    const right = enemy.x;

    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.enemy;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(right - wordWidth, underlineY);
    ctx.lineTo(right, underlineY);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.typed;
    ctx.beginPath();
    ctx.moveTo(right, underlineY);
    ctx.lineTo(right - wordWidth * fraction, underlineY);
    ctx.stroke();
  }

  // A cleared word doesn't explode — it fades and shrinks like text being
  // deleted from the buffer. No additive blending, no glow, no motes. Reuses the
  // font set by drawEnemies so it matches the live tokens.
  private drawShatter(enemy: Enemy, locale: Locale, colors: RenderColors): void {
    const { ctx } = this;
    const progress = enemy.shatter ?? 0;
    const fade = 1 - progress;
    const scale = 1 - progress * 0.4;

    ctx.save();
    ctx.globalAlpha = fade;
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
