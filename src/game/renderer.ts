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
  // Syntax palette — archetype decoration borrows the editor's own token colors
  // so a comment, a keyword marker, a string, and a function name all read as
  // ordinary highlighting rather than game UI.
  syntaxComment: string;
  syntaxKeyword: string;
  syntaxString: string;
  syntaxFunction: string;
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
  syntaxComment: '#6a9955',
  syntaxKeyword: '#569cd6',
  syntaxString: '#ce9178',
  syntaxFunction: '#dcdcaa',
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
    syntaxComment: readVar(styles, '--syntax-comment', COLOR_FALLBACKS.syntaxComment),
    syntaxKeyword: readVar(styles, '--syntax-keyword', COLOR_FALLBACKS.syntaxKeyword),
    syntaxString: readVar(styles, '--syntax-string', COLOR_FALLBACKS.syntaxString),
    syntaxFunction: readVar(styles, '--syntax-function', COLOR_FALLBACKS.syntaxFunction),
  };
}

// Canvas 2D font strings do NOT support CSS var() — they silently fall back to
// 10px sans-serif. Mirror the editor's --font-mono so the words read like code,
// with IBM Plex Sans (Arabic) tailing the chain: the coding monospaces have no
// Arabic glyphs, so the browser falls back to it per-glyph for ع/ar runs.
const CODE_FONT_FAMILY =
  '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", "SF Mono", ui-monospace, "IBM Plex Sans", monospace';
// The retro skin's pixel terminal face (spec: docs/design/retro-32bit-skin.md).
// This is the ONE thing CSS can't deliver to the canvas, so the family is
// skin-aware here. VT323 has no Arabic glyphs either — the Plex tail keeps
// Arabic runs falling back per-glyph, an honest degradation the spec accepts.
const RETRO_FONT_FAMILY = '"VT323", "IBM Plex Sans", monospace';
// VT323 draws thinner/smaller than the coding monospaces at equal px; a small
// glyph-only bump (layout rows are untouched) keeps the field readable.
const RETRO_FONT_SCALE = 1.12;
const PROXIMITY_RANGE_FRACTION = 0.4;
// A small, restrained screen shake on impact — enough to register, never a jolt
// that would betray a game running behind the editor disguise. The retro skin
// has no disguise to protect, so it shakes harder (still reduced-motion gated
// upstream in Canvas.vue) and snaps to integers for pixel-crisp jolts.
const SHAKE_PIXELS_PER_MS = 0.02;
const SHAKE_MAX_PX = 6;
const RETRO_SHAKE_PIXELS_PER_MS = 0.05;
const RETRO_SHAKE_MAX_PX = 14;

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

// ─── Spawn telegraph (#3) ──────────────────────────────────────────────────
// A freshly spawned word tints its row once and fades out — the editor briefly
// highlighting a line that just changed. No strobe and no accent fill: a blinking
// full-width accent band reads as an arcade flash and would break the disguise.
// Mirrors the engine's SPAWN_TELEGRAPH_MS so spawnFlashMs maps to a 1→0 fade.
const SPAWN_TELEGRAPH_MS = 350;
const SPAWN_FLASH_ROW_ALPHA = 0.5;

// ─── Hot lane (#8) ─────────────────────────────────────────────────────────
// The hot row's line number breathes red so the dangerous lane reads as a
// flagged line, like a persistent diagnostic in the gutter.
const HOT_LANE_PULSE_PERIOD_MS = 900;

// ─── Overflow (#10) ────────────────────────────────────────────────────────
// Backlog intensifies the base-line danger: a faint warning band creeps in from
// the gutter as more words pile into the critical zone. Mirrors the engine's
// own overflow zone (baseLine × this fraction) so the visual tracks the rule.
const OVERFLOW_ZONE_FRACTION = 4;
const OVERFLOW_BAND_MAX_ALPHA = 0.12;

// ─── Archetype decoration (#6) ─────────────────────────────────────────────
const TANK_FONT_SCALE = 1.18;
const COMMENT_ALPHA_SCALE = 0.78;
const BRACKET_CONNECTOR_ALPHA = 0.3;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class GameRenderer {
  private cssWidth = 0;
  private cssHeight = 0;
  // Reused row → line-number-color map, cleared and refilled each frame so the
  // gutter HUD costs no per-frame Map allocation. Keyed by row index.
  private readonly rowHighlights = new Map<number, string>();
  // Skin-aware rendering (font family can't come from CSS vars — canvas font
  // strings don't resolve var()). Synced once per frame from data-skin so the
  // renderer stays a single implementation, driven by the same switch as the
  // rest of the app, not a hard fork.
  private retroSkin = false;
  private fontFamily = CODE_FONT_FAMILY;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  // Read the active skin off the root attribute useSkin.ts owns. Cheap enough
  // per-frame (one attribute read); keeps the hot loop dependency-free.
  private syncSkin(): void {
    this.retroSkin =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-skin') === 'retro';
    this.fontFamily = this.retroSkin ? RETRO_FONT_FAMILY : CODE_FONT_FAMILY;
    // Nearest-neighbor for any scaled draw — crisp pixels in retro.
    this.ctx.imageSmoothingEnabled = !this.retroSkin;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const canvas = this.ctx.canvas;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = cssW;
    this.cssHeight = cssH;
  }

  draw(engine: GameEngine, locale: Locale, colors: RenderColors, shakeMs: number): void {
    this.syncSkin();
    const { ctx } = this;
    const width = this.cssWidth;
    const enemies = engine.enemies;
    const px = this.retroSkin
      ? Math.round(fontPxFor(width) * RETRO_FONT_SCALE)
      : fontPxFor(width);
    const rowHeight = rowHeightFor(width);
    const gutter = gutterWidthFor(width);

    const proximity = this.nearestThreatProximity(enemies, gutter, width);
    const frontMost = this.frontMostEnemy(enemies);
    const highlights = this.gutterHighlights(enemies, frontMost, rowHeight, gutter, width, colors);
    const overflow = this.overflowIntensity(enemies, gutter);

    ctx.clearRect(0, 0, width, this.cssHeight);
    // The editor body renders outside the shake transform so the structure stays
    // steady while impacts nudge only the words.
    this.drawEditorField(colors, px, rowHeight, gutter, highlights, proximity, overflow);
    this.drawHotLanes(engine.hotLaneYs, rowHeight, gutter, px, colors);
    ctx.save();
    this.applyShake(shakeMs);
    this.drawEnemies(enemies, locale, colors, px, gutter, width, rowHeight);
    ctx.restore();
  }

  // Backlog danger (#10): how full the engine's critical overflow zone is, 0..1.
  // Counts live words whose marching anchor has crept inside baseLine × the zone
  // span, mirroring the engine's own overflow rule so the visual tracks it.
  private overflowIntensity(enemies: Enemy[], gutter: number): number {
    const criticalEdge = gutter + gutter * OVERFLOW_ZONE_FRACTION;
    let backlog = 0;
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) continue;
      if (enemy.x <= criticalEdge) backlog++;
    }
    return clamp01(backlog / 6);
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
    overflow: number,
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

    // Overflow band (#10): as the backlog fills the critical zone, a faint red
    // wash creeps in from the base line — the editor's own "lines with problems"
    // shading deepening, never a glow, so a crowded field reads as mounting risk.
    if (overflow > 0) {
      const bandWidth = (width - gutterWidth) * 0.5 * overflow;
      ctx.globalAlpha = OVERFLOW_BAND_MAX_ALPHA * overflow;
      ctx.fillStyle = colors.danger;
      ctx.fillRect(gutterWidth, 0, bandWidth, height);
      ctx.globalAlpha = 1;
    }

    // Gutter divider doubles as the base line — it reddens and thickens as the
    // nearest word closes in (and as backlog mounts), so the danger lives on the
    // editor's own chrome rather than any added arcade flourish.
    const danger = Math.max(proximity, overflow);
    ctx.strokeStyle = danger > 0.55 ? colors.danger : colors.outline;
    ctx.lineWidth = 1 + danger * 1.5 + overflow;
    ctx.beginPath();
    ctx.moveTo(gutterWidth, 0);
    ctx.lineTo(gutterWidth, height);
    ctx.stroke();

    // Line numbers down the full height, recolored per row by the game state.
    ctx.font = `${Math.round(px * GUTTER_FONT_SCALE)}px ${this.fontFamily}`;
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

  // Hot lane (#8): repaint the hot row's line number(s) in a breathing red so the
  // dangerous lane reads as a flagged line in the gutter. Drawn after the field
  // so it overrides the default line-number color on exactly those rows. Reuses
  // the engine's reused hotLaneYs buffer — no per-frame allocation here.
  private drawHotLanes(
    hotLaneYs: number[],
    rowHeight: number,
    gutterWidth: number,
    px: number,
    colors: RenderColors,
  ): void {
    if (hotLaneYs.length === 0) return;
    const { ctx } = this;
    const pulse = 0.6 + 0.4 * this.pulse(HOT_LANE_PULSE_PERIOD_MS);
    ctx.save();
    ctx.font = `${Math.round(px * GUTTER_FONT_SCALE)}px ${this.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.danger;
    for (const laneY of hotLaneYs) {
      const lineNumber = Math.round(laneY / rowHeight - 0.5) + 1;
      if (lineNumber < 1) continue;
      ctx.globalAlpha = pulse;
      ctx.fillText(String(lineNumber), gutterWidth - 8, laneY);
    }
    ctx.restore();
  }

  // A 0..1 triangle wave driven by the wall clock — a calm, steady breath for
  // telegraph/hot-lane pulses. No state, so it costs nothing across frames.
  private pulse(periodMs: number): number {
    const phase = (performance.now() % periodMs) / periodMs;
    return phase < 0.5 ? phase * 2 : 2 - phase * 2;
  }

  private applyShake(shakeMs: number): void {
    if (shakeMs <= 0) return;
    const rate = this.retroSkin ? RETRO_SHAKE_PIXELS_PER_MS : SHAKE_PIXELS_PER_MS;
    const maxPx = this.retroSkin ? RETRO_SHAKE_MAX_PX : SHAKE_MAX_PX;
    const magnitude = Math.min(shakeMs * rate, maxPx);
    let offsetX = (Math.random() - 0.5) * 2 * magnitude;
    let offsetY = (Math.random() - 0.5) * 2 * magnitude;
    if (this.retroSkin) {
      // Integer-snapped jolts read as whole-pixel arcade shake, not smear.
      offsetX = Math.round(offsetX);
      offsetY = Math.round(offsetY);
    }
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
    const map = this.rowHighlights;
    map.clear();
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
    rowHeight: number,
  ): void {
    const { ctx } = this;
    ctx.font = `400 ${px}px ${this.fontFamily}`;
    ctx.textBaseline = 'middle';
    // Bracket pairs (#6) get a faint connector drawn under the words so the two
    // linked halves read as one { … } span; done first so glyphs stay on top.
    this.drawBracketConnectors(enemies, locale, colors, px);
    // Merge encounters (#7) get their real conflict boundary lines drawn around
    // the vertically-stacked HEAD and branch blocks before the content glyphs.
    this.drawConflictFrames(enemies, locale, colors, rowHeight);
    for (const enemy of enemies) {
      if (enemy.shatter !== undefined) {
        this.drawShatter(enemy, locale, colors, px);
        continue;
      }
      this.drawSpawnTelegraph(enemy, colors, px);
      const near = this.nearness(enemy, gutter, width);
      const critical = near >= CRITICAL_NEARNESS;
      let alpha = enemy.active ? 1 : MIN_WORD_ALPHA + (1 - MIN_WORD_ALPHA) * near;
      if (enemy.kind === 'comment') alpha *= COMMENT_ALPHA_SCALE;
      if (locale === 'ar') {
        this.drawArabicEnemy(enemy, colors, px, alpha, critical);
      } else {
        this.drawLatinEnemy(enemy, colors, px, alpha, critical);
      }
    }
  }

  // Spawn telegraph (#3): while a word is still announcing itself, tint its row
  // with a single surface wash that fades out over the telegraph window — the
  // editor briefly highlighting a line that just changed. No blink, no accent
  // fill: a strobing accent band would read as an arcade flash and break cover.
  private drawSpawnTelegraph(enemy: Enemy, colors: RenderColors, px: number): void {
    if (enemy.spawnFlashMs === undefined || enemy.spawnFlashMs <= 0) return;
    const { ctx } = this;
    const fade = clamp01(enemy.spawnFlashMs / SPAWN_TELEGRAPH_MS);
    const bandHeight = px + SELECTION_PADDING_Y * 2;
    ctx.save();
    ctx.globalAlpha = SPAWN_FLASH_ROW_ALPHA * fade;
    ctx.fillStyle = colors.surfaceElevated;
    ctx.fillRect(0, enemy.y - bandHeight / 2, this.cssWidth, bandHeight);
    ctx.restore();
  }

  // Bracket connector (#6): join each linked bracket pair with a faint horizontal
  // tie between the two words' left edges, reading as the span a { … } encloses.
  private drawBracketConnectors(
    enemies: Enemy[],
    locale: Locale,
    colors: RenderColors,
    px: number,
  ): void {
    const { ctx } = this;
    for (const opener of enemies) {
      if (opener.kind !== 'bracket' || opener.linkId === undefined) continue;
      if (opener.shatter !== undefined) continue;
      const partner = this.bracketPartner(enemies, opener);
      if (!partner || partner.id <= opener.id) continue;
      const a = this.wordLeft(opener, locale);
      const b = this.wordLeft(partner, locale);
      ctx.save();
      ctx.globalAlpha = BRACKET_CONNECTOR_ALPHA;
      ctx.strokeStyle = colors.syntaxFunction;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a, opener.y);
      ctx.lineTo(b, partner.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Merge-conflict framing (#7): the encounter is a real VERTICAL conflict stack.
  // In one pass over the frame's words, find the bounds of the HEAD block and the
  // incoming branch block (kept apart by enemy.conflictSide from the engine), then
  // draw the genuine boundary lines — `<<<<<<< HEAD` above the head block,
  // `=======` between the two blocks, `>>>>>>> branch` below the branch block.
  // The content words sit on their own lines, so the markers read exactly like git
  // conflict markers rather than a gimmick. Single pass keeps this off the O(n²)
  // per-partner scans the old inline separator did every frame.
  private drawConflictFrames(
    enemies: Enemy[],
    locale: Locale,
    colors: RenderColors,
    rowHeight: number,
  ): void {
    let headTopY = Number.POSITIVE_INFINITY;
    let headBottomY = Number.NEGATIVE_INFINITY;
    let branchTopY = Number.POSITIVE_INFINITY;
    let branchBottomY = Number.NEGATIVE_INFINITY;
    let blockLeft = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (enemy.kind !== 'conflict' || enemy.conflictSide === undefined) continue;
      if (enemy.shatter !== undefined) continue;
      blockLeft = Math.min(blockLeft, this.wordLeft(enemy, locale));
      if (enemy.conflictSide === 'head') {
        headTopY = Math.min(headTopY, enemy.y);
        headBottomY = Math.max(headBottomY, enemy.y);
      } else {
        branchTopY = Math.min(branchTopY, enemy.y);
        branchBottomY = Math.max(branchBottomY, enemy.y);
      }
    }
    if (blockLeft === Number.POSITIVE_INFINITY) return;
    this.paintConflictMarkers(
      colors,
      blockLeft,
      rowHeight,
      headTopY,
      headBottomY,
      branchTopY,
      branchBottomY,
    );
  }

  // Paint the three conflict boundary lines around the stacked blocks. Each marker
  // sits a half-row outside its block so it reads as the line just above/below the
  // content, never overlapping a typeable word. The `=======` divider lands in the
  // gap between the head and branch blocks.
  private paintConflictMarkers(
    colors: RenderColors,
    left: number,
    rowHeight: number,
    headTopY: number,
    headBottomY: number,
    branchTopY: number,
    branchBottomY: number,
  ): void {
    const { ctx } = this;
    const hasHead = headTopY !== Number.POSITIVE_INFINITY;
    const hasBranch = branchTopY !== Number.POSITIVE_INFINITY;
    ctx.save();
    ctx.globalAlpha = BRACKET_CONNECTOR_ALPHA;
    ctx.fillStyle = colors.syntaxKeyword;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    if (hasHead) {
      ctx.fillText('<<<<<<< HEAD', left, Math.max(rowHeight / 2, headTopY - rowHeight / 2));
    }
    if (hasHead && hasBranch) {
      ctx.fillText('=======', left, (headBottomY + branchTopY) / 2);
    }
    if (hasBranch) {
      const bottom = Math.min(this.cssHeight - rowHeight / 2, branchBottomY + rowHeight / 2);
      ctx.fillText('>>>>>>> branch', left, bottom);
    }
    ctx.restore();
  }

  private bracketPartner(enemies: Enemy[], opener: Enemy): Enemy | undefined {
    for (const candidate of enemies) {
      if (candidate === opener) continue;
      if (candidate.kind === 'bracket' && candidate.linkId === opener.linkId) return candidate;
    }
    return undefined;
  }

  // The word's painted left edge, anchor-aware (Arabic anchors on the right).
  private wordLeft(enemy: Enemy, locale: Locale): number {
    if (locale === 'ar') return enemy.x - this.ctx.measureText(enemy.word).width;
    return enemy.x;
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
    const kindPx = this.archetypeFontPx(enemy, px);
    ctx.font = `400 ${kindPx}px ${this.fontFamily}`;
    const typedText = enemy.word.slice(0, enemy.typed);
    const remainingText = enemy.word.slice(enemy.typed);
    const wordWidth = ctx.measureText(enemy.word).width;
    const typedWidth = ctx.measureText(typedText).width;
    const erroring = (enemy.errorMs ?? 0) > 0;

    if (enemy.active) this.drawSelection(enemy.x, wordWidth, enemy.y, kindPx, colors);
    this.drawLeadingMarker(enemy, colors, enemy.x, enemy.y, alpha, 'right');

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.typed;
    ctx.fillText(typedText, enemy.x, enemy.y);
    ctx.fillStyle = this.archetypeRemainingColor(enemy, erroring, colors);
    ctx.fillText(remainingText, enemy.x + typedWidth, enemy.y);
    ctx.restore();

    this.drawTrailingMarker(enemy, colors, enemy.x + wordWidth, enemy.y, alpha, 'left');
    this.drawProgressUnderline(enemy.x, wordWidth, enemy, colors, enemy.y + kindPx * 0.5, alpha);
    this.drawArchetypeStatus(enemy, enemy.x, wordWidth, enemy.y, kindPx, erroring, critical, colors);

    if (enemy.active) this.drawCaret(enemy.x + typedWidth, enemy.y, kindPx, colors.text);
    ctx.font = `400 ${px}px ${this.fontFamily}`;
  }

  private drawArabicEnemy(
    enemy: Enemy,
    colors: RenderColors,
    px: number,
    alpha: number,
    critical: boolean,
  ): void {
    const { ctx } = this;
    const kindPx = this.archetypeFontPx(enemy, px);
    ctx.font = `400 ${kindPx}px ${this.fontFamily}`;
    const wordWidth = ctx.measureText(enemy.word).width;
    const erroring = (enemy.errorMs ?? 0) > 0;
    const left = enemy.x - wordWidth;

    if (enemy.active) this.drawSelection(left, wordWidth, enemy.y, kindPx, colors);
    // In RTL the leading edge is the left side, so markers mirror sides.
    this.drawLeadingMarker(enemy, colors, enemy.x, enemy.y, alpha, 'left');

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = this.archetypeRemainingColor(enemy, erroring, colors);
    ctx.fillText(enemy.word, enemy.x, enemy.y);
    ctx.restore();

    this.drawTrailingMarker(enemy, colors, left, enemy.y, alpha, 'right');
    // Arabic underline is right-anchored from enemy.x leftward.
    this.drawProgressUnderline(left, wordWidth, enemy, colors, enemy.y + kindPx * 0.6, alpha, true);
    this.drawArchetypeStatus(enemy, left, wordWidth, enemy.y, kindPx, erroring, critical, colors);
    ctx.font = `400 ${px}px ${this.fontFamily}`;
  }

  // Tank words (#6) read as a heavier long identifier — a touch bigger than the
  // surrounding code. Every other kind keeps the field's base size.
  private archetypeFontPx(enemy: Enemy, px: number): number {
    return enemy.kind === 'tank' ? Math.round(px * TANK_FONT_SCALE) : px;
  }

  // Remaining-glyph color, archetype-aware: comments take the comment color and
  // lints the error tone so a must-kill and an ignorable word look as different
  // as real code, while preserving the active/erroring base behavior.
  private archetypeRemainingColor(enemy: Enemy, erroring: boolean, colors: RenderColors): string {
    if (erroring) return colors.danger;
    if (enemy.kind === 'comment') return colors.syntaxComment;
    if (enemy.kind === 'lint' && !enemy.active) return colors.danger;
    if (enemy.active) return colors.enemyActive;
    return colors.text;
  }

  // The decoration painted just before a word's leading edge (#6/#7): `// ` for a
  // comment, and the merge-conflict / stack-trace framing for a boss word. The
  // marker is right- or left-anchored to the word edge so it never shifts the
  // typed glyphs. `side` is which edge of the word the marker abuts.
  private drawLeadingMarker(
    enemy: Enemy,
    colors: RenderColors,
    edgeX: number,
    centerY: number,
    alpha: number,
    side: 'left' | 'right',
  ): void {
    const text = this.leadingMarkerFor(enemy);
    if (text.length === 0) return;
    const color = enemy.kind === 'comment' ? colors.syntaxComment : colors.syntaxKeyword;
    this.drawMarkerText(text, color, edgeX, centerY, alpha, side);
  }

  private drawTrailingMarker(
    enemy: Enemy,
    colors: RenderColors,
    edgeX: number,
    centerY: number,
    alpha: number,
    side: 'left' | 'right',
  ): void {
    const text = this.trailingMarkerFor(enemy);
    if (text.length === 0) return;
    this.drawMarkerText(text, colors.syntaxKeyword, edgeX, centerY, alpha, side);
  }

  // Inline marker before a word's leading edge. A comment gets `// `; a lone
  // stack-trace frame (a conflict word with no head/branch side) gets `at `. Merge
  // words carry no inline marker — they are framed by the standalone conflict
  // boundary lines drawn in drawConflictFrames, so the content never sits between
  // a marker keyword and its label.
  private leadingMarkerFor(enemy: Enemy): string {
    if (enemy.kind === 'comment') return '// ';
    if (enemy.kind === 'conflict' && enemy.conflictSide === undefined) return 'at ';
    return '';
  }

  private trailingMarkerFor(enemy: Enemy): string {
    if (enemy.kind === 'conflict' && enemy.conflictSide === undefined) return '()';
    return '';
  }

  // Draw a decoration token abutting a word edge. Uses the current font so tank
  // markers scale with the word; never repositions the typed glyphs.
  private drawMarkerText(
    text: string,
    color: string,
    edgeX: number,
    centerY: number,
    alpha: number,
    side: 'left' | 'right',
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = color;
    ctx.direction = 'ltr';
    ctx.textAlign = side === 'right' ? 'right' : 'left';
    ctx.fillText(text, edgeX, centerY);
    ctx.restore();
  }

  // Below-word feedback, archetype-aware (#6): a lint always wears the red
  // diagnostics squiggle (its must-kill warning) and a bonus is struck through
  // like a deprecated symbol; otherwise fall through to the shared error/critical
  // status so existing behavior is preserved.
  private drawArchetypeStatus(
    enemy: Enemy,
    left: number,
    width: number,
    centerY: number,
    px: number,
    erroring: boolean,
    critical: boolean,
    colors: RenderColors,
  ): void {
    if (enemy.bonus) this.drawStrike(left, width, centerY, colors.accent);
    if (enemy.kind === 'lint' && !erroring) {
      this.drawSquiggle(left, width, centerY + px * 0.82, colors.danger);
      return;
    }
    this.drawWordStatus(left, width, centerY, px, erroring, critical, colors);
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
  // green — mirrors the editor's inline diff/coverage gutter. In RTL the typed
  // fraction grows from the right edge leftward, matching the typing direction.
  private drawProgressUnderline(
    left: number,
    wordWidth: number,
    enemy: Enemy,
    colors: RenderColors,
    underlineY: number,
    alpha: number,
    rtl = false,
  ): void {
    const { ctx } = this;
    const fraction = enemy.word.length > 0 ? enemy.typed / enemy.word.length : 0;
    const typedStart = rtl ? left + wordWidth : left;
    const typedEnd = rtl ? left + wordWidth * (1 - fraction) : left + wordWidth * fraction;

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
    ctx.moveTo(typedStart, underlineY);
    ctx.lineTo(typedEnd, underlineY);
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

  // A cleared word doesn't explode — it fades and shrinks like text being
  // deleted from the buffer. No additive blending, no glow, no motes.
  private drawShatter(enemy: Enemy, locale: Locale, colors: RenderColors, px: number): void {
    const { ctx } = this;
    const progress = enemy.shatter ?? 0;
    const fade = 1 - progress;
    const scale = 1 - progress * 0.4;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `400 ${px}px ${this.fontFamily}`;
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
