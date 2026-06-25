// ─── Shared field geometry ───────────────────────────────────────────────────
// Single source of truth for the editor field's row/lane/gutter math so the
// engine (spawn lanes, base line) and the renderer (gutter, line numbers) can
// never drift apart. All values derive from the field width/height in CSS px.

const FONT_MIN_PX = 18;
const FONT_MAX_PX = 28;
// Word size tracks field WIDTH (not height) so it stays proportional to the
// rem-based UI at any zoom and never balloons on tall play areas.
const FONT_WIDTH_DIVISOR = 38;
// Line height relative to the font — the editor's row stride.
export const ROW_HEIGHT_FACTOR = 1.6;

const MIN_LANES = 4;
const MAX_LANES = 9;

export function fontPxFor(width: number): number {
  return Math.max(FONT_MIN_PX, Math.min(FONT_MAX_PX, Math.round(width / FONT_WIDTH_DIVISOR)));
}

export function rowHeightFor(width: number): number {
  return Math.round(fontPxFor(width) * ROW_HEIGHT_FACTOR);
}

/** Left gutter width — also the base/danger line (where words breach). */
export function gutterWidthFor(width: number): number {
  return Math.min(fontPxFor(width) * 3, width * 0.12);
}

/** Map a y coordinate to the editor row index it sits on. */
export function rowIndexAt(y: number, width: number): number {
  return Math.round(y / rowHeightFor(width) - 0.5);
}

/**
 * Lane centers, snapped to real editor row centers and spread across the field.
 * Lane count scales with height (clamped) so tall panes use more of the field
 * and short panes don't cram — each lane is an actual numbered line.
 */
export function laneCenters(width: number, height: number): number[] {
  const rowHeight = rowHeightFor(width);
  const rows = Math.max(1, Math.floor(height / rowHeight));
  const desired = Math.min(MAX_LANES, Math.max(MIN_LANES, Math.floor(rows / 2)));
  const count = Math.max(1, Math.min(desired, rows));
  const centers = new Set<number>();
  for (let lane = 0; lane < count; lane++) {
    const fraction = count === 1 ? 0.5 : lane / (count - 1);
    const rowIndex = Math.round(fraction * (rows - 1));
    centers.add((rowIndex + 0.5) * rowHeight);
  }
  return [...centers];
}
