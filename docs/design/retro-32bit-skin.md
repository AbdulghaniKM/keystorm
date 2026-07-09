# Keystorm — 32-bit Retro Skin (Design Spec)

Status: Implemented (v1) · Additive skin · VS Code skin preserved · spec 2026-07-09, implemented 2026-07-10

Keystorm currently disguises its typing-roguelite gameplay inside a flat VS Code editor. This spec defines **retro** — a switchable, arcade-cabinet pixel-art alternative visual language that reads like a coin-op machine glowing in a dark room instead of a code editor. It is built entirely on the existing `data-skin` architecture: a new `html[data-skin='retro']` token block, real `useSkin` state, the already-built skin toggle, and exactly one small renderer edit — with the VS Code skin (and all 20 of its color themes) remaining the untouched default and fallback. **Implementation note (v1):** shipped as `src/components/ui/RetroChrome.vue`, `src/components/game/VoltMascot.vue`, the `html[data-skin='retro']` block in `src/style.css`, real state in `src/composables/useSkin.ts`, and the skin-aware font/smoothing/shake edit in `src/game/renderer.ts`. The VS Code skin's dark/light rocker is intentionally not duplicated in the retro HUD (retro v1 is dark-only; light/dark remains reachable via the palette picker) — see Open Questions.

## Table of Contents

- [Concept & Design Principles](#concept--design-principles)
- [Color System & Design Tokens](#color-system--design-tokens)
- [Chrome & Typography — The Arcade Cabinet](#chrome--typography--the-arcade-cabinet)
- [The Play-Field — Canvas in 32-bit](#the-play-field--canvas-in-32-bit)
- [Mascot & Sprite Design](#mascot--sprite-design)
- [Playability, Juice & Accessibility](#playability-juice--accessibility)
- [Preserving the VS Code Look](#preserving-the-vs-code-look)
- [Rollout Plan](#rollout-plan)
- [Open Questions / Decisions for the Owner](#open-questions--decisions-for-the-owner)

## Concept & Design Principles

The retro skin is the deliberate inverse of the VS Code disguise. Seven principles govern every decision below:

1. **Pixel-perfect.** Zero border-radius, hard 2–4px borders, hard sticker drop-shadows (offset, never blur), no anti-aliasing on text or images, integer-only sprite scaling. This is what sells "32-bit."
2. **Arcade-cabinet framing.** Editor chrome is re-costumed as cabinet parts — a lit marquee, a stage/cartridge indicator, a HUD control panel — not as a fake `src/` file tree.
3. **Color-not-only preserved.** Every gameplay signal keeps a shape or position cue (squiggle, strike-through, pixel bar, blocky caret, mascot silhouette) so color-blind players stay unaffected. Color is never the sole channel.
4. **Additive / opt-in.** Retro is *added, never subtracted.* It is a new `data-skin` value, a new sibling CSS block, and new components — it cannot regress the VS Code skin.
5. **Dark-first.** Arcade/CRT is a night aesthetic; v1 is dark-only on a deep-navy `#0F172A` ground.
6. **Genuinely playable.** The marching-word lane is always the top-priority visual; all juice is duration-capped and gated behind `prefers-reduced-motion`.
7. **VS Code stays default.** First-time and cleared-storage users always land on the untouched VS Code look; retro is a reversible flip.

## Color System & Design Tokens

Scope: the palette applied under `html[data-skin='retro']`.

### 1. Rationale — why a 32-bit night-arcade palette

The VS Code skin hides the game inside a flat `#1e1e1e` editor so nothing reads as a "game." The `retro` skin should read as a coin-op cabinet glowing in a dark room. Three constraints from the hardware era shape the choices:

- **Deep-navy base, not black.** NES/SNES output was viewed on CRTs where pure `#000000` bloomed and smeared. Games of the era (and the 32-bit successors) leaned on a dark desaturated blue-black for the "night" field because navy keeps black-level separation while letting saturated foreground sprites pop. We use **`#0F172A`** as `--color-background` — the marching words sit on it exactly the way sprites sat on a starfield.
- **Few, saturated, high-value accents.** The NES master palette was 54 usable colors and a typical scene used a 4-color sub-palette per tile; SNES scenes budgeted 15 colors per palette. That scarcity trained players to read *hue as meaning*. We keep the working set tiny and maximally separated on the hue wheel: **neon red (danger/primary), electric blue (secondary), score-green (accent/success), gold (emphasis/functions), cyan (glow/type), magenta (keywords)** — each pair is far enough apart to survive CRT bleed and colorblind ambiguity, which is why we also keep the canvas's existing squiggle/strike shape cues (color is never the only signal).
- **CRT feel without illegibility.** The "CRT" is expressed through *structure*, not through muddying text: hard 1px neon glows (`--glow-*`), a hard black pixel drop-shadow on cards (`--shadow-pop` = sticker offset, not blur), zero border-radius for chunky pixel corners, and an optional scanline overlay (the existing `ks-scanline` keyframe, gated behind `prefers-reduced-motion`). Every foreground color is tuned to clear **4.5:1** against the navy field so the "arcade glow" never costs readability (see §4).

Typography follows the era split: **`Press Start 2P`** for chunky 8-bit headings/marquee, **`VT323`** as the readable pixel-terminal body/mono.

> **Renderer code change (one place only).** `src/game/renderer.ts` hard-codes `FONT_FAMILY` (canvas 2D font strings cannot read `var()`), so switching marching words to the pixel face requires editing that constant to `"'Press Start 2P', monospace"` (with a larger line-height / letter-spacing budget, since PS2P is wide). Also set `ctx.imageSmoothingEnabled = false` and add `image-rendering: pixelated` to the `<canvas>` under `html[data-skin='retro']` for crisp, non-blurred glyph scaling. All *colors* flow automatically via `getComputedStyle` — no color code changes.

### 2. Complete token table

| Variable | Value | Role / notes |
|---|---|---|
| `--color-primary` | `#FF4D4D` | Neon arcade red. Renderer `base`. Brightened from the classic `#DC2626` (which fails at 3.7:1) to clear 4.5:1 on navy. |
| `--color-secondary` | `#4C8DFF` | Electric blue. Secondary UI / info-leaning accents. |
| `--color-accent` | `#22C55E` | Score green. Renderer `enemyActive` (word under attack) + primary CTA fill. |
| `--color-background` | `#0F172A` | Deep-navy night-arcade field. Renderer `background`; canvas paints on this. |
| `--color-surface` | `#192134` | Card / HUD panel. |
| `--color-surface-elevated` | `#22304A` | Raised panel (modals, active tab). |
| `--color-text` | `#E8EEF9` | Primary text / remaining glyphs. Renderer `remaining`/`text`. |
| `--color-text-secondary` | `#9FB3D1` | Idle enemy words, muted labels. Renderer `enemy`. |
| `--color-border` | `#05070D` | Ink-black pixel outline; also the color inside hard pop-shadows. Renderer `outline`. |
| `--color-muted` | `#131B2E` | Recessed wells / disabled fills. |
| `--color-glow` | `#22D3EE` | Cyan CRT glow tint. Renderer `glow`; feeds `--glow-*`. |
| `--color-link` | `#38BDF8` | Sky-cyan link. |
| `--color-link-hover` | `#7DD3FC` | Brighter cyan on hover. |
| `--color-emphasis` | `#FDE047` | Gold highlight for scores / streak callouts. |
| `--color-success` | `#22C55E` | Correct / cleared. |
| `--color-warning` | `#FBBF24` | Caution (word near gutter). |
| `--color-error` | `#F87171` | Miss / breach. Renderer `danger`. |
| `--color-info` | `#38BDF8` | Neutral info. |
| `--glass-bg` | `rgba(25, 33, 52, 0.82)` | Semi-opaque panel over the field (surface tint). |
| `--glass-bg-strong` | `rgba(34, 48, 74, 0.92)` | Denser panel (elevated tint). |
| `--glass-border` | `#34406B` | Visible 1–2px pixel rim on panels. |
| `--glow-sm` | `0 0 4px rgba(34, 211, 238, 0.35)` | Subtle neon rim (cyan). |
| `--glow-md` | `0 0 8px rgba(34, 211, 238, 0.45)` | Medium neon rim. |
| `--glow-lg` | `0 0 14px rgba(34, 211, 238, 0.55)` | Large neon halo (hover/active). |
| `--glow-accent` | `0 0 10px rgba(34, 197, 94, 0.55)` | Green score-glow for accent elements. |
| `--shadow-pop` | `4px 4px 0 0 #05070D` | **Hard pixel sticker offset** — no blur. |
| `--shadow-pop-sm` | `3px 3px 0 0 #05070D` | Smaller hard offset. |
| `--shadow-pop-active` | `1px 1px 0 0 #05070D` | Pressed state (button sinks into its shadow). |
| `--text-shadow-pop` | `4px 4px 0 #05070D` | Hard ink drop behind PS2P headings (arcade marquee). |
| `--syntax-comment` | `#8AA0C4` | Muted slate — reads as "comment" yet stays ≥4.5:1. |
| `--syntax-keyword` | `#E879F9` | Neon magenta. |
| `--syntax-control` | `#FB923C` | Arcade orange. |
| `--syntax-function` | `#FCD34D` | Gold. |
| `--syntax-string` | `#4ADE80` | Bright green. |
| `--syntax-number` | `#C084FC` | Violet. |
| `--syntax-type` | `#22D3EE` | Cyan. |
| `--syntax-variable` | `#BAE6FD` | Pale ice-blue (near-text, high legibility). |
| `--syntax-punctuation` | `#94A3B8` | Cool grey. |
| `--vscode-titlebar` | `#05070D` | Only rendered if chrome shows in retro (cabinet marquee). |
| `--vscode-activitybar` | `#131B2E` | Cabinet side rail. |
| `--vscode-tab-inactive` | `#131B2E` | Inactive tab. |
| `--vscode-selection` | `#24406E` | Selection highlight. |
| `--vscode-hover` | `#22304A` | Hover fill. |
| `--vscode-statusbar-bg` | `#131B2E` | Control-panel bar holding the real toggles. |
| `--vscode-statusbar-fg` | `#E8EEF9` | Status-bar text (13.7:1 on its bg). |
| `--font-display` | `'Press Start 2P', 'Courier New', monospace` | Chunky 8-bit headings/marquee. |
| `--font-primary` | `'VT323', 'Courier New', monospace` | Readable pixel-terminal body. |
| `--font-mono` | `'VT323', 'Courier New', monospace` | Mono = same pixel terminal. |
| `--font-sans` | `'VT323', system-ui, sans-serif` | No true sans in-era; map to VT323. |
| `--font-serif` | `'VT323', Georgia, serif` | Retro has no serif; map to VT323. |
| `--radius-sm` | `0` | Hard pixel corners. |
| `--radius-md` | `0` | Hard pixel corners. |
| `--radius-lg` | `0` | Hard pixel corners. |
| `--radius-xl` | `0` | Hard pixel corners. |

### 3. Ready-to-paste CSS spec block

```css
/* ─── Skin: 32-bit retro night-arcade ──────────────────────────────────────
   Chunky pixel corners, hard sticker shadows, neon-on-navy. A switchable
   alternative to the VS Code skin; every component + the canvas read these. */
html[data-skin='retro'] {
  /* Fonts (Google Fonts: Press Start 2P + VT323) */
  --font-display: 'Press Start 2P', 'Courier New', monospace;
  --font-primary: 'VT323', 'Courier New', monospace;
  --font-mono: 'VT323', 'Courier New', monospace;
  --font-sans: 'VT323', system-ui, sans-serif;
  --font-serif: 'VT323', Georgia, serif;

  /* Hard pixel corners */
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;
  --radius-xl: 0;

  /* Core palette — neon accents on deep navy */
  --color-primary: #FF4D4D;
  --color-secondary: #4C8DFF;
  --color-accent: #22C55E;
  --color-background: #0F172A;
  --color-surface: #192134;
  --color-surface-elevated: #22304A;
  --color-text: #E8EEF9;
  --color-text-secondary: #9FB3D1;
  --color-border: #05070D;
  --color-muted: #131B2E;
  --color-glow: #22D3EE;
  --color-link: #38BDF8;
  --color-link-hover: #7DD3FC;
  --color-emphasis: #FDE047;
  --color-success: #22C55E;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-info: #38BDF8;

  /* Depth / skin tokens — hard pixel sticker shadows + subtle neon glow */
  --glass-bg: rgba(25, 33, 52, 0.82);
  --glass-bg-strong: rgba(34, 48, 74, 0.92);
  --glass-border: #34406B;
  --glow-sm: 0 0 4px rgba(34, 211, 238, 0.35);
  --glow-md: 0 0 8px rgba(34, 211, 238, 0.45);
  --glow-lg: 0 0 14px rgba(34, 211, 238, 0.55);
  --glow-accent: 0 0 10px rgba(34, 197, 94, 0.55);
  --shadow-pop: 4px 4px 0 0 #05070D;
  --shadow-pop-sm: 3px 3px 0 0 #05070D;
  --shadow-pop-active: 1px 1px 0 0 #05070D;
  --text-shadow-pop: 4px 4px 0 #05070D;

  /* Syntax — bright arcade hues for the marching-word decoration */
  --syntax-comment: #8AA0C4;
  --syntax-keyword: #E879F9;
  --syntax-control: #FB923C;
  --syntax-function: #FCD34D;
  --syntax-string: #4ADE80;
  --syntax-number: #C084FC;
  --syntax-type: #22D3EE;
  --syntax-variable: #BAE6FD;
  --syntax-punctuation: #94A3B8;

  /* Chrome vars — only used if editor chrome renders under retro */
  --vscode-titlebar: #05070D;
  --vscode-activitybar: #131B2E;
  --vscode-tab-inactive: #131B2E;
  --vscode-selection: #24406E;
  --vscode-hover: #22304A;
  --vscode-statusbar-bg: #131B2E;
  --vscode-statusbar-fg: #E8EEF9;
}

/* Crisp pixels for the marching-word canvas */
html[data-skin='retro'] canvas {
  image-rendering: pixelated;
}
```

### 4. Contrast check (WCAG 2.1, computed)

Text threshold ≥ 4.5:1. All marching-word (syntax) colors are treated as body text since they are gameplay-critical.

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `--color-text` `#E8EEF9` | `#0F172A` bg | 15.3:1 | PASS |
| `--color-text` `#E8EEF9` | `#192134` surface | 13.8:1 | PASS |
| `--color-text-secondary` `#9FB3D1` | `#0F172A` bg | 8.4:1 | PASS |
| `--color-text-secondary` `#9FB3D1` | `#192134` surface | 7.5:1 | PASS |
| `--color-primary` `#FF4D4D` | `#0F172A` bg | 5.5:1 | PASS *(was 3.7:1 at `#DC2626` → brightened)* |
| `--color-secondary` `#4C8DFF` | `#0F172A` bg | 5.6:1 | PASS *(was 4.85:1 at `#3B82F6` → nudged for margin)* |
| `--color-accent` `#22C55E` | `#0F172A` bg | 7.8:1 | PASS |
| ink `#05070D` (label) | `#FF4D4D` primary btn | 5.7:1 | PASS *(buttons use ink text, not white)* |
| ink `#05070D` (label) | `#22C55E` accent btn | 8.1:1 | PASS |
| `--color-link` `#38BDF8` | `#0F172A` bg | 8.3:1 | PASS |
| `--color-error` `#F87171` | `#0F172A` bg | 6.5:1 | PASS |
| `--color-warning` `#FBBF24` | `#0F172A` bg | 10.7:1 | PASS |
| `--vscode-statusbar-fg` `#E8EEF9` | `#131B2E` statusbar | 13.7:1 | PASS |
| `--syntax-comment` `#8AA0C4` | `#0F172A` bg | 6.7:1 | PASS |
| `--syntax-keyword` `#E879F9` | `#0F172A` bg | 7.3:1 | PASS |
| `--syntax-control` `#FB923C` | `#0F172A` bg | 7.9:1 | PASS |
| `--syntax-function` `#FCD34D` | `#0F172A` bg | 12.4:1 | PASS |
| `--syntax-string` `#4ADE80` | `#0F172A` bg | 10.3:1 | PASS |
| `--syntax-number` `#C084FC` | `#0F172A` bg | 6.8:1 | PASS |
| `--syntax-type` `#22D3EE` | `#0F172A` bg | 9.9:1 | PASS |
| `--syntax-variable` `#BAE6FD` | `#0F172A` bg | 13.5:1 | PASS |
| `--syntax-punctuation` `#94A3B8` | `#0F172A` bg | 7.0:1 | PASS |

**Fixes applied:** `--color-primary` moved `#DC2626 → #FF4D4D` (3.7:1 fail → 5.5:1) and `--color-secondary` moved `#3B82F6 → #4C8DFF` (4.85:1 borderline → 5.6:1). **Button rule:** on the saturated `--color-primary` / `--color-accent` fills, labels use ink `#05070D`, never white (white-on-red is only ~2.8:1 and would fail).

### 5. Optional "Boss Fight" alt palette (violet family)

Layered exactly like the `data-vscode-theme` variants sit under `data-skin='vscode'` — a sub-attribute swaps the palette without touching the retro skin's structural tokens (radii, hard shadows, fonts, glow shapes all inherit). Applied during boss encounters (the store already tracks boss state).

```css
/* Deeper, more menacing violet cabinet — inherits all retro depth/font tokens */
html[data-skin='retro'][data-retro-theme='boss'] {
  --color-primary: #7C3AED;   /* violet — boss "base" */
  --color-secondary: #A78BFA; /* soft lilac */
  --color-accent: #F43F5E;    /* rose — the threat color */
  --color-background: #0F0F23; /* near-black indigo void */
  --color-surface: #1A1636;
  --color-surface-elevated: #241C4A;
  --color-text: #EDE9FE;
  --color-text-secondary: #B7A9E8;
  --color-border: #05040F;
  --color-muted: #16122E;
  --color-glow: #A78BFA;
  --color-emphasis: #FDE047;
  --color-error: #FB7185;     /* boss breach */
  --glow-accent: 0 0 12px rgba(244, 63, 94, 0.6);   /* rose menace-glow */
  --glow-lg: 0 0 16px rgba(167, 139, 250, 0.6);
}
```

Spot-check on `#0F0F23`: text `#EDE9FE` ≈ 16:1, `--color-secondary` `#A78BFA` ≈ 7.9:1, `--color-accent` `#F43F5E` ≈ 4.7:1 (PASS — kept above threshold; do not darken the rose further). The rose accent doubles as the shape-backed danger cue, preserving the color-not-only rule already enforced by the canvas squiggle/strike marks.

## Chrome & Typography — The Arcade Cabinet

> **Scope.** This describes the chrome that `html[data-skin='retro']` plus a sibling component to `EditorChrome.vue` (call it `ArcadeChrome.vue`, selected by `useSkin`) would render. The play-field `<canvas>` is untouched — it keeps reading the CSS-variable color contract, so the same marching-words renderer paints inside a re-dressed cabinet. Every functional control that lives in the VS Code status bar survives; only its costume changes.

### The re-frame: editor element → cabinet part

| VS Code chrome (`EditorChrome.vue`) | Retro cabinet part (`ArcadeChrome.vue`) | Keeps |
|---|---|---|
| Title bar + fake menus (File/Edit/…) | **MARQUEE** — pixel `KEYSTORM` logo, blinking `CREDIT 01`, coin slot | Window drag region, app identity |
| Activity bar + file explorer (fake `src/` tree) | **Cabinet side-art** — optional, collapsible, hidden by default | See "Explorer" below |
| Tab strip + breadcrumbs | **STAGE indicator** — `STAGE 1-1`, `WAVE 03`, run seed | Current-context readout |
| Status bar (holds the REAL controls) | **HUD strip / control panel** — chunky pixel buttons | Language, dark/light, theme picker, sound |

### Marquee header (was: title bar)

A 56px bar pinned to the top, full width, drawn as a lit cabinet marquee.

- **Left:** 3px-bevelled pixel wordmark `KEYSTORM` in Press Start 2P, `--color-primary` fill with a 1px `--color-accent` inner highlight to fake a lit tube. The logo is a `<span>`, not an image — no asset pipeline for a hobbyist.
- **Center:** the drag region (`-webkit-app-region: drag` if packaged; a no-op `<div>` in browser) so the marquee keeps the title bar's window-move affordance.
- **Right:** `CREDIT 01` in VT323, tabular, with a blinking coin glyph. The blink is a 2-step `steps(1)` opacity animation, **1.06s**, and **must** stop under `prefers-reduced-motion` (hold at full opacity). Credits are decorative — they read as "insert coin" flavor and never gate play.
- Bottom edge: a 3px `--color-border` rule + a 2px scanline notch so the marquee reads as a separate lit panel.

### Explorer / activity bar → hidden by default (justified)

**Recommendation: hide on retro, offer a collapsible "side-art" drawer.** Rationale:

1. **Game-first.** The explorer's job in the VS Code skin is disguise — it sells "a developer is editing a file." Retro drops the disguise entirely, so the fake `src/` tree has no function to preserve; keeping it would only steal play-field width from a canvas whose enemies march the **full** horizontal distance.
2. **Nothing is lost.** The explorer never held a real control (all live controls are in the status bar → HUD). So hiding it removes zero functionality — this satisfies the "keep the same functional controls" rule while reclaiming space.
3. **Optional flavor, not chrome.** A single collapsible rail (default collapsed, toggled by a pixel chevron docked to the play-field's left gutter) can show **cabinet side-art**: a vertical dithered stripe + the simple mascot sprite. It is purely cosmetic, `aria-hidden`, and excluded from tab order. On viewports `< 720px` it is force-collapsed.

### Stage indicator (was: tab strip + breadcrumbs)

A 28px strip below the marquee. Instead of file tabs, one active "cartridge tab" with a hard-offset shadow shows `STAGE 1-1`; breadcrumbs become a run-context trail: `RUN › WAVE 03 › ×1.5 COMBO`. Press Start 2P at the small display size for the stage number, VT323 for the trailing modifiers (they change often and need tabular digits). Inactive/upcoming stages render as dimmed cartridge stubs, mirroring inactive tabs.

### HUD strip (was: status bar — carries the real controls)

This is the load-bearing part: the retro skin **must** re-home the exact control cluster from `EditorChrome.vue`'s status bar (`toggleLocale` → `toggleMode` → theme picker → `settings.toggleAudio()`), in the same order, same handlers, same `aria-label`s. Only the styling token layer differs. A bottom bar, min-height **48px** (touch target ≥44px), split like the original status bar (left = passive readouts, right = interactive controls).

**Left cluster (passive HUD, VT323 tabular):** `SCORE 0012840` · `HI 0031200` · `LIVES ♥♥♥` (drawn as pixel hearts, shape-not-color) · `WPM 68`. These replace the encoding / line-col / language-mode readouts.

**Right cluster — the four real controls, each a chunky pixel button** (2–4px hard border, `--shadow-pop` 4px 4px 0 offset shadow, `--shadow-pop-active` on `:active` to sink it, no border-radius, no blur):

| Control | Handler (unchanged) | Retro form |
|---|---|---|
| Language toggle | `toggleLocale` | `[EN] / [ع]` two-state pixel switch; the active side is depressed (uses `--shadow-pop-active`). Icon: `lucide--languages` rendered pixelated (`image-rendering: pixelated` on the icon layer). Label text switches font per side (see RTL note). |
| Dark / light | `toggleMode` | A physical-looking rocker; `lucide--moon` / `lucide--sun` swapped, drawn 2× nearest-neighbor. Sets `data-theme`, which flips `color-scheme` exactly as today. |
| Theme picker | opens `UiThemePicker` | Button reads `PALETTE: DRACULA` in VT323; opening the picker is framed as **"SELECT PALETTE"** — a modal styled as an arcade select screen (grid of swatch cartridges), reusing the existing `<UiThemePicker>` component. |
| Sound | `settings.toggleAudio()` | `SOUND ▮▮▮▮` / `SOUND ▯▯▯▯` speaker meter; the bars are the shape cue so state isn't color-only. `lucide--volume` / `volume-x` under the bars. |

All four remain real `<button>`s, in DOM order Language → Dark/Light → Theme → Sound, so keyboard tab order and screen-reader labels match the VS Code skin one-to-one.

### Typography scale

Two families only. **Press Start 2P is very wide and unreadable in bulk — use it as a display accent, never for running text or numbers that change every frame.** VT323 is a proportional-feel pixel terminal font that stays legible small and has honest tabular digits — it carries all body, HUD, and numeric load.

```
Load: Press Start 2P (400) + VT323 (400). Two weights total.
--font-display: "Press Start 2P", monospace;   /* headings ONLY */
--font-primary: "VT323", monospace;            /* body + HUD + numbers */
--font-mono:    "VT323", monospace;            /* keep contract satisfied */
```

| Token | Font | px | line-height | letter-spacing | Use when |
|---|---|---|---|---|---|
| `display-xl` | Press Start 2P | 32 | 1.4 (44px) | 0.02em | Marquee `KEYSTORM`, game-over / title screen only |
| `display-lg` | Press Start 2P | 20 | 1.5 (30px) | 0.02em | Section headers, modal titles ("SELECT PALETTE") |
| `display-sm` | Press Start 2P | 12 | 1.6 (19px) | 0.04em | `STAGE 1-1`, button captions — the smallest PS2P should ever go; below 12px it smears |
| `hud-lg` | VT323 | 28 | 1.1 (31px) | 0 | Score / Hi-score numerals — big, `font-variant-numeric: tabular-nums` |
| `hud-md` | VT323 | 22 | 1.15 (25px) | 0.01em | HUD labels, control button text, WPM/combo |
| `body` | VT323 | 20 | 1.35 (27px) | 0.01em | Tooltips, help text, run summaries (≥18px because VT323 is thin) |
| `caption` | VT323 | 18 | 1.3 (23px) | 0.02em | Credits, seed string, footnotes |

**Rules of thumb:**
- Press Start 2P = **static, short, ≤ ~14 characters, never a live counter** (its fixed advance width makes long lines crawl off-screen, and re-layout on every score tick is jarring).
- VT323 = **everything that scrolls, counts, or wraps**, always `tabular-nums` for any number so digits don't jitter.
- Never set VT323 below 18px or Press Start 2P below 12px — both lose their pixel grid and turn to mud.

**Arabic / RTL fallback (critical — neither pixel font ships Arabic glyphs).** Press Start 2P has **no** Arabic coverage and VT323's is absent/broken, so RTL must fall back the moment `dir="rtl"` / locale `ar` is active. Do **not** try to force a pixel look on Arabic — legibility wins:

```css
--font-display-ar: "Cairo", "Noto Sans Arabic", system-ui, sans-serif;
--font-primary-ar: "Noto Kufi Arabic", "Noto Sans Arabic", system-ui, sans-serif;

html[data-skin='retro'][dir='rtl'] {
  --font-display: var(--font-display-ar);
  --font-primary: var(--font-primary-ar);
  --font-mono:    var(--font-primary-ar);
}
```

- Use **Cairo** (or Noto Kufi Arabic) for headings — geometric and slightly blocky, so it reads as the closest "pixel-adjacent" Arabic without sacrificing shaping. Use **Noto Kufi/Sans Arabic** for body/HUD.
- **Keep numerals tabular and Latin (Western Arabic numerals) in the HUD regardless of locale** — score/WPM/lives are game telemetry; forcing Eastern-Arabic digits would break the fixed-width HUD alignment. Apply `font-variant-numeric: tabular-nums` on the Arabic fallback too.
- The language-toggle button therefore shows its `[EN]` side in Press Start 2P and its `[ع]` side in Cairo — expected, since the two scripts legitimately use different families.
- **Canvas note:** `FONT_FAMILY` in `src/game/renderer.ts` is hard-coded (Canvas 2D font strings can't read `var()`), so making the marching words render in the pixel font is the **one** required code change — set `FONT_FAMILY = '"Press Start 2P", monospace'` for LTR and branch to `'"Cairo", sans-serif'` when the run is Arabic. Because PS2P is wide, drop the canvas word size ~2px and add letter budget, or enemies overlap. Everything else (palette) flows automatically through the existing `getComputedStyle` reads.

### Pixel-perfect details

```css
html[data-skin='retro'] {
  /* Crisp pixels everywhere: icons, sprites, the canvas */
  image-rendering: pixelated;                 /* icons/sprites */
  -webkit-font-smoothing: none;               /* kill AA on text */
  text-rendering: geometricPrecision;
  --radius-sm: 0; --radius-md: 0;             /* NO rounded corners */
  --radius-lg: 0; --radius-xl: 0;
  --shadow-pop:        4px 4px 0 var(--color-border);
  --shadow-pop-sm:     2px 2px 0 var(--color-border);
  --shadow-pop-active: 1px 1px 0 var(--color-border);
}
html[data-skin='retro'] canvas { image-rendering: pixelated; }
/* renderer.ts must also set ctx.imageSmoothingEnabled = false */
```

- **Borders:** hard **2–4px** solid `--color-border`, never a shadow-blur. Panels (marquee, HUD, modal) get 3px; buttons 2px + the offset `--shadow-pop`.
- **Focus ring — NES style:** `outline: 2px solid var(--color-accent); outline-offset: 2px; box-shadow: none;` — a hard, un-blurred rectangle. Never `outline: none`. Every control keeps a visible focus state (accessibility rule + it looks correctly "selected" on a cabinet).
- **Scanline + dither overlay:** a single non-interactive full-screen layer, `pointer-events:none; mix-blend-mode: multiply; z-index` above the field, built from a repeating CSS gradient — no image asset:
  ```css
  .retro-scanlines::after {
    content:""; position:fixed; inset:0; pointer-events:none;
    background: repeating-linear-gradient(
      to bottom, transparent 0 2px, rgba(0,0,0,.18) 2px 3px);
  }
  ```
  Add a faint dither via a 2px `repeating-conic-gradient` at very low opacity for the "CRT phosphor" grain. **All of this is disabled under `prefers-reduced-motion`** (drop the flicker) and should be user-toggleable via the sound-adjacent settings — some players get eyestrain from scanlines.
- **No anti-aliasing** on text (`-webkit-font-smoothing: none`) or images (`image-rendering: pixelated`); this is what sells "32-bit."
- **Motion budget:** shake stays capped (the existing ≤6px is fine; retro can go to ~8px but no more), all continuous animation (coin blink, scanline flicker, marquee shimmer) is decorative and killed by `prefers-reduced-motion`. Only genuine loaders animate continuously.
- **Contrast:** neon-red/blue on deep navy `#0F172A` passes ≥4.5:1 for the VT323 HUD text; verify the theme-picker palettes keep `--color-text` on `--color-background` above 4.5:1 in both `data-theme` modes.

### ASCII wireframe — full retro screen

```
┌══════════════════════════════════════════════════════════════════════┐
│  ▛▀▜  K E Y S T O R M              ◉ CREDIT 01           [ drag ]      │  ◄ MARQUEE (Press Start 2P logo,
│  ▙▄▟  «pixel wordmark, neon-red»     ▲blinks                          │     blinking coin, 56px, 3px base rule)
├──────────────────────────────────────────────────────────────────────┤
│ ▐STAGE 1-1▌  RUN › WAVE 03 › ×1.5 COMBO            seed:7F3A          │  ◄ STAGE STRIP (cartridge tab + trail)
├─┬────────────────────────────────────────────────────────────────────┤
│▓│                                                                    ║│
│▓│                                                          getUser() ║│  ◄ PLAY-FIELD  (<canvas>, words march
│▓│                                          const foo = ▮             ║│     right→left toward the ║ gutter;
│▓│                              while(x) ▮                            ║│     full width; palette from CSS vars;
│▓│  side-                                                             ║│     scanline+dither overlay on top)
│▓│  art                    return ▮                                   ║│
│▓│  (opt,                                                             ║│  ◄ ║ = danger gutter (--color-error)
│▓│  hidden)                                          import x from ▮  ║│
│▓│◄chevron toggles the collapsible cabinet side rail                  ║│
├─┴────────────────────────────────────────────────────────────────────┤
│ SCORE 0012840   HI 0031200   ♥♥♥   WPM 68 │ [EN|ع] [☾] [PALETTE:DRACULA] [♪▮▮▮▮] │  ◄ HUD / control panel (48px)
└──────────────────────────────────────────────────────────────────────┘
   └─ passive readouts (VT323 tabular) ────┘  └─ the 4 REAL controls, chunky pixel buttons ─┘
                                                 lang    mode  theme-picker   sound
                                              toggleLocale toggleMode  UiThemePicker  toggleAudio()
```

The right-hand HUD cluster is a literal one-to-one re-skin of `EditorChrome.vue`'s status-bar settings cluster — same components, same order, same handlers — so switching `data-skin` between `'vscode'` and `'retro'` never adds, removes, or relocates a single control. Only the paint changes.

## The Play-Field — Canvas in 32-bit

The play-field is the one surface that is *not* HTML — it's a `<canvas>` driven by `src/game/renderer.ts`, so it can't be re-skinned by CSS alone the way the chrome can. The good news is that the renderer was written to read its palette from the same CSS variable contract every Vue component uses. That means most of the retro conversion is **free**, and exactly one thing — the font — is not. This section is precise about which is which, because "just add a `[data-skin='retro']` block" is true for color and a lie for typography.

### What flows automatically (zero renderer changes)

The renderer resolves its colors once per frame via `getComputedStyle` off the CSS custom properties. Redefine those tokens under `html[data-skin='retro']` and the canvas repaints in arcade colors with **no TypeScript touched**. The mapping the renderer already uses:

| Canvas role | Reads from | VS Code today | Retro value |
| --- | --- | --- | --- |
| `background` (field) | `--color-background` | `#1e1e1e` flat | deep-navy `#0F172A` |
| `surface` / `surfaceElevated` | `--color-surface` / `--color-surface-elevated` | editor grays | `#192134` / `#1F2937` cards |
| `base` (structural strokes) | `--color-primary` | editor blue | neon-red `#DC2626` |
| `enemy` (marching word) | `--color-text-secondary` | muted gray | dim pixel-cyan |
| `enemyActive` (targeted word) | `--color-accent` | accent | score-green `#22C55E` |
| `typed` (cleared prefix) | `--color-success` | green | score-green `#22C55E` |
| `remaining` / `text` | `--color-text` | near-white | `#E2E8F0` |
| `danger` (near the gutter) | `--color-error` | red | neon-red `#DC2626` |
| `outline` | `--color-border` | subtle | chunky pixel border |
| `glow` | `--color-glow` | ~none | neon bloom color |
| word syntax tint | `--syntax-comment/keyword/string/function/…` | VS Code token colors | remapped arcade palette |

So the moment the `retro` token block exists, the field is already deep-navy, danger already reads neon-red, the typed prefix already flashes score-green, and each marching word is tinted by its `--syntax-*` role. This is the payoff of the existing contract: **color is data, and the canvas already speaks it.**

### What needs a small code change (and why)

Three things cannot ride on CSS. None is large; all are called out so nobody assumes the token block is sufficient.

**(a) The font — the one real fork.** Canvas 2D font strings are plain strings; `ctx.font = "16px var(--font-mono)"` is silently invalid — the 2D context does **not** resolve `var()`. The family is therefore hard-coded in `renderer.ts`:

```
const FONT_FAMILY =
  '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", "SF Mono", ui-monospace, "IBM Plex Sans", monospace';
```

and is interpolated into every `ctx.font` assignment (the gutter, the word body, the "kind" glyph, etc.). To get the 8-bit look the family must become skin-aware. **Do not hard-fork** into two renderers — read the active skin and pick a family. Retro headings/kind-markers want `'Press Start 2P'` (chunky, only for short strings — it's expensive to read at small sizes), and the word body wants `'VT323'` (a readable pixel terminal font that stays legible at gameplay density). Keep `'IBM Plex Sans'` tailing the chain so Arabic (RTL) runs still fall back per-glyph — Press Start 2P and VT323 have no Arabic glyphs, so Arabic words in the retro skin will render in the Plex fallback. That's an acceptable, honest degradation; flag it, don't hide it.

**(b) Crisp pixels.** Retro wants hard edges. Set `ctx.imageSmoothingEnabled = false` on context setup, and snap all draw coordinates to integers (`Math.round` on x/y for word origins, gutter, bars, caret). The renderer already rounds font sizes; extend that discipline to positions so glyphs and the pixel bar don't land on half-pixels and blur. Pair with `image-rendering: pixelated` on the `<canvas>` element in the retro CSS block so any backing-store scaling stays blocky.

**(c) Loosened shake / optional scanlines.** `SHAKE_MAX_PX = 6` and `SHAKE_PIXELS_PER_MS = 0.02` are deliberately tiny — the VS Code skin's whole conceit is "a developer calmly editing a file," so a big jolt would break the disguise. Retro has no disguise to protect. Make these two constants skin-aware (retro can go to ~14–18px cap) and optionally composite a scanline / CRT-vignette overlay pass at the end of the frame. Both are gated on motion preference (see juice budget).

### Retro treatment of the existing render features (color-not-only preserved)

The renderer already draws meaning with *shape*, not color alone — a hard accessibility win we keep. Each existing feature gets a retro read that still carries the same signal:

- **Line-number gutter** → arcade **"lane" markers**. The left number column becomes chunky lane labels down the side of the field, so each marching word reads as travelling down a numbered arcade lane toward the base. Same spatial information, new metaphor.
- **Red squiggle / strike-through on error** → **keep verbatim.** A jagged red underline is *already* pixel-art; at `imageSmoothingEnabled=false` it renders as a crisp saw-tooth. This is the primary non-color error signal — do not replace it with color.
- **Progress underline** (typed-prefix length) → **chunky pixel bar**: a segmented, blocky fill under the word instead of a thin line — reads like an arcade power/charge meter.
- **Caret** → **blocky blinking block** (a solid filled square that blinks), the classic terminal/arcade cursor, instead of the thin editor I-beam.
- **"Next-up" ▶ marker** → keep as a solid filled pixel triangle pointing at the next target; it already is a shape cue, just render it hard-edged (and not as an emoji — a drawn triangle).
- **Spawn telegraph** → a brief blocky flash / expanding pixel frame at the spawn edge before the word commits — louder than vscode allowed, still purely a timing tell.
- **Hot-lane pulse** → a pulsing lane highlight; in retro it can bloom via `--color-glow` (which vscode set to near-nothing), reading as an "energized" arcade lane.
- **Merge-conflict / bracket framing** → the bracket/`<<<<<<<` framing that groups linked words can read as an arcade **"combo link"** (chained enemies). **Keep it functional** — the frame still communicates the grouping; only its costume changes.

Every one of these keeps a shape/position cue, so the field stays parseable for color-blind players and satisfies the color-not-only rule even before palette contrast is considered.

### Proposal: the minimal skin-aware renderer tweak

*Design sketch only — no code is being changed here.* The whole font+smoothing fork collapses to a small resolver plus one setup line:

```
// renderer.ts (PROPOSED, not applied)

type Skin = 'vscode' | 'retro';

// read once per frame from the same root the CSS contract uses
function activeSkin(el: HTMLElement): Skin {
  return (document.documentElement.dataset.skin as Skin) ?? 'vscode';
}

const FONT_STACKS: Record<Skin, { body: string; display: string }> = {
  vscode: {
    body:    '"Cascadia Code","Fira Code","JetBrains Mono","Consolas",ui-monospace,"IBM Plex Sans",monospace',
    display: '"Cascadia Code","Fira Code","JetBrains Mono",ui-monospace,"IBM Plex Sans",monospace',
  },
  retro: {
    // Plex tail retained so Arabic (RTL) runs still fall back per-glyph
    body:    '"VT323","IBM Plex Sans",monospace',
    display: '"Press Start 2P","VT323","IBM Plex Sans",monospace',
  },
};

// on context setup:
ctx.imageSmoothingEnabled = skin === 'retro' ? false : true;

// every existing `ctx.font = \`400 ${px}px ${FONT_FAMILY}\`` becomes:
ctx.font = `400 ${px}px ${fonts.body}`;      // word body → VT323 in retro
// short glyphs (kind marker / gutter labels) may use fonts.display

// shake caps become a per-skin lookup instead of module constants:
const SHAKE_MAX_PX = skin === 'retro' ? 16 : 6;
```

The skin is read from the same `data-skin` on `<html>` that `useSkin.ts` already owns and `SkinToggle.vue` already flips — so this stays one renderer, driven by the same switch as the rest of the app, not a parallel copy. Passing skin down as a prop from the Vue game component (rather than reading `document` inside the hot loop) is the cleaner variant; either satisfies "skin-aware, not hard-forked."

### Juice budget

The VS Code skin ran on a starvation diet to protect the disguise: 6px shake ceiling, no glow, no grid, no flash. Retro spends what vscode had to save — **all of it gated behind `prefers-reduced-motion`**, per the project's must-follow UX rules:

- **Bigger shake** — raise the cap to ~14–18px on impact (the constant is already there; just skin it).
- **Hit-stop** — a 40–80ms freeze on a word-clear or a base hit; cheap, and it makes every clear feel like it *landed*. Forbidden in vscode (an editor doesn't stutter); native to arcade.
- **Pixel particles** — a small burst of a few integer-snapped square sprites when a word is cleared or reaches the gutter. Reuse the `typed`/`danger` colors so particles carry meaning, not just noise.
- **Screen flash** — a one-frame full-field tint (neon-red on base-hit, score-green on a big clear/combo), which vscode's flat calm banned outright.
- **Scanline / CRT overlay** — the optional final composite pass (b/c above).

**Reduced-motion contract:** when `prefers-reduced-motion: reduce` is set, collapse shake to ~0, skip hit-stop, suppress particles and screen flash, and hold the scanline overlay static (no rolling/flicker). The *color* signals — danger red, typed green, the squiggle, the pixel bar — all remain, because they were never motion. That's the point of having kept every cue as shape+color: the retro field can be maximally juicy for players who want it and fully legible, static, and non-nauseating for players who don't, from the same render path.

## Mascot & Sprite Design

> **Implementation note (v1.1):** Volt now uses the owner's hand-made art
> (`public/volt.png`), quantized to its native **32×33** grid and 8-color
> palette in `src/components/game/VoltMascot.vue` — superseding the 16×16
> starter grid below, which remains as the simple hand-drawable reference.
> All poses (idle/bob, blink, hit, celebrate ×2) were rebuilt around the new
> art's face; rendering is still procedural (no PNG shipped at runtime).

### 1. Concept — "Volt," the pocket thundercloud

**Volt** is a small storm‑cloud sprite that lives *inside* the keyboard. Every keystroke feeds it a little charge, so it crackles with a stubby lightning‑bolt tail. Personality: eager, jittery, loyal — a hype‑buddy that lights up when you're on fire and gets comically zapped when a word slips past you.

Role across the UI:
- **Start screen** — Volt floats above the "Press Start" prompt, idling and blinking, inviting the player in.
- **HUD status buddy** — sits in the game‑field corner and *reacts* to play: cheers on combo chains, gets frazzled when a word breaches the gutter, idles otherwise. It is a second read of your run's momentum.
- **Game‑over screen** — freezes on its zapped/hurt pose, then settles into a sad idle. On a new high score it plays the celebrate pose instead.

Volt is deliberately one shape (a rounded cloud + a bolt) so a hobbyist can redraw it from the grid below in minutes.

### 2. Palette — 6 colors + transparent

Tuned to pop on the deep‑navy retro background (`--color-background` ≈ `#0F172A`). The dark outline is used **internally only**; the sprite's outer ring is body/highlight so its silhouette never dissolves into the navy.

| Role | Char | Hex | Notes |
|------|------|-----|-------|
| Outline (ink) | `#` | `#0A1228` | Internal linework + eye pupils |
| Body | `O` | `#5B8DEF` | Storm‑blue cloud fill; high contrast on navy |
| Highlight | `+` | `#BFD8FF` | Top‑left misty rim (light source top‑left) |
| Accent (bolt) | `*` | `#FFD23F` | Lightning yellow — the "storm" pop |
| Spark (eyes) | `o` | `#22D3EE` | Cyan eyes / spark; the "alive" cue |
| Shadow | `:` | `#2B3A66` | Under‑cloud belly shading |
| Transparent | `.` | — | Nothing drawn |

> **5‑color build:** drop cyan `o` and paint the eyes with highlight `+`. You lose a little charm but stay under budget.

### 3. Hand‑drawable 16×16 sprite

Copy this literally, one character = one pixel. Every row is exactly 16 chars. Light comes from the top‑left. Legend is the table above.

```
        col 0123456789012345
row  0     .....######.....
row  1     ...##++++++##...
row  2     ..##++++++++##..
row  3     .##++++OOOO++##.
row  4     ##++OOOOOOOO++##
row  5     #+OOOOOOOOOOOO+#
row  6     #O#oo#OOO#oo#OO#
row  7     #O#o##OOO##o#OO#
row  8     #OOOOOOOOOOOOOO#
row  9     #OOOOO####OOOOO#
row 10     #OO::OO**OO::OO#
row 11     .#OOOO#**#OOOO#.
row 12     .......**.......
row 13     ......**........
row 14     ......****......
row 15     ........**......
```

Reading it: rows 0–2 are the puffy cloud crown (highlight‑lit), rows 6–7 are two cyan eyes with inward‑facing pupils (`#`) that give Volt its cute cross‑look, row 9 is a small mouth, rows 10–11 close the cloud belly with `:` shadow, and rows 12–15 are the zig‑zag lightning tail (`*`) striking down out of the cloud.

**32×32 note (secondary — keep 16×16 as the shippable asset):** Scale the same silhouette up and add only these details — (a) a second, smaller cloud bump top‑right so the crown reads as two puffs; (b) one mid‑tone ring (`#3A5AA8`, between outline and body) on the outer corners to soften the pixel stair‑stepping; (c) a 1px white specular dot in each eye; (d) a subtle square keycap notch embossed on the belly (2×2 highlight + shadow) to sell the keyboard theme; (e) a longer, two‑segment bolt tail. Do **not** feel obliged to author all 1024 cells by hand — 32×32 is a nice‑to‑have; the clean 16×16 is the priority.

### 4. Animation frames (low frame counts)

**Idle — 2 frames (subtle bob).** Frame A = grid as drawn. Frame B = shift the entire sprite **down 1px** and flicker the bolt tip (row 15 `*` → transparent for that frame). Loop ~700ms/frame. That's the whole idle.

**Blink — 2 frames.** Hold idle, then for ~120ms swap eye rows 6–7 to a squint line:

```
row  6     #OOOOOOOOOOOOOO#      (eyes vanish into body)
row  7     #O####OOO####OO#      (two short dark lashes)
```

Trigger randomly every 3–6s while idle.

**Hit / hurt — 2 frames (word breaches the gutter).** Replace the face (rows 6–9) with X‑eyes + an open mouth, jolt the sprite **down 2px**, and tint the body cells `O` → `--color-error` for both frames. The bolt tail scatters (spread rows 12–15 outward by 1px). ~500ms total, then return to idle.

```
row  6     #O#O#OOOO#O#OOO#      X-eyes, top diagonals
row  7     #OO#OOOOOO#OOOO#      X-eyes, centers
row  8     #O#O#OOOO#O#OOO#      X-eyes, bottom diagonals
row  9     #OOOOOO##OOOOOO#      open "ouch" mouth
```

**Celebrate / combo — 3 frames (player chains clears).** Eyes become upward happy arcs, mouth widens to a big grin, and 2–3 accent‑yellow sparkle pixels pop in the empty corners (rows 0–2 and 3–5 sides), **alternating positions each frame** so they twinkle. The bolt tail brightens (all `*`) and gains a second `*` beside the first. ~180ms/frame ×3, then idle. Face reference:

```
row  6     #OoOO#OOO#OOoO#      arcs turning up
row  7     #OO##OOOO##OOOO#      (eyes closed-happy)
row  9     #OO#*OOOO*#OO#O#      wide grin
```

### 5. Placement & sizing spec (integer scaling only)

Render Volt on an offscreen 16×16 buffer, then blit with `image-rendering: pixelated` and `ctx.imageSmoothingEnabled = false`. **Only integer scales** — no fractional zoom, ever.

| Surface | Location | Scale | Behavior |
|---------|----------|-------|----------|
| Start screen | Centered, directly above the "Press Start" prompt | **6×** = 96px | Idle bob + occasional blink |
| HUD status buddy | Leading top corner of the game‑field frame; **RTL‑aware** (flips to the opposite corner in Arabic layout, and the bolt/sprite is mirrored so it still points into the field) | **3×** = 48px | Event‑driven (below) |
| Game‑over | Centered above the score panel | **5×** = 80px | Freeze on Hit frame → sad idle; Celebrate on new high score |

**Event → state machine** (HUD buddy):
- combo counter increments on a chain clear → **Celebrate** for ~600ms, then fall back to Idle.
- life lost / gutter breach → **Hit** for ~500ms (red flash), then Idle.
- no event → **Idle**, with a random **Blink** every 3–6s.
- States are a simple priority queue: Hit interrupts Celebrate interrupts Idle.

**Reduced motion:** with `prefers-reduced-motion: reduce`, freeze to Idle frame A — no bob, no blink timer, no sparkle twinkle, no bolt flicker. State changes still swap the **static pose** (Idle → Hit pose → Celebrate pose) so the player keeps the read, but nothing tweens or loops. This matches the skin's rule of disabling shake/scanline/flicker.

**Font/renderer caveat carried over:** the sprite is its own pixel buffer and does not touch `renderer.ts`'s canvas `font` string. The only renderer code change the retro skin needs (switching marching words to `Press Start 2P` and setting `imageSmoothingEnabled = false`) is unrelated to Volt — Volt just needs those same crisp‑pixel flags on whatever context blits it.

### 6. Accessibility — decorative, but never the only signal

- The sprite element (canvas or `<img>`) is **`aria-hidden="true"`**. Volt carries no information a screen‑reader user must have.
- Every state Volt expresses is **mirrored by a real text/number readout** in the status bar, so the buddy is purely redundant reinforcement:
  - Combo → live numeric `Combo ×7` text, wrapped in `role="status"` / `aria-live="polite"` announcing milestones (e.g. every ×5).
  - Lives → `Lives: 3` as actual digits, updated on breach; the Hit reaction is the *decoration* of that number changing, not the source of truth.
- **Color is never the only channel** (matches the project's color‑not‑only rule): Hit is read by **X‑eye shape**, Celebrate by **grin + sparkle shape**, Idle by neutral eyes — the red/green/yellow tints are secondary. A colorblind player still distinguishes the three poses by silhouette alone.
- Focus/keyboard: Volt is non‑interactive and not in the tab order. It must never trap focus or steal it during its animations.

## Playability, Juice & Accessibility

The VS Code disguise deliberately starves the game of feedback — a "developer editing a file" cannot flash, shake hard, or spray particles. The `retro` skin lifts that constraint. Everything below is scoped to `html[data-skin='retro']` and gated by the accessibility rules in the last two subsections; none of it fires when `prefers-reduced-motion: reduce` is set.

### Game feel / juice (unlocked by the retro skin)

Each effect has a hard duration ceiling of 400ms and floor of 120ms so the field never freezes long enough to lose a marching word. All are additive over the canvas and driven from the existing render loop; the SFX rows hook `src/game/audio.ts`.

| # | Effect | Trigger | Spec (duration / magnitude / easing) |
|---|--------|---------|--------------------------------------|
| 1 | **Hit-stop (freeze-frame)** | A word is fully cleared | Freeze all enemy motion + spawn ticks for **90ms**, then resume. Kept below the 120ms *visible-animation* floor on purpose — it reads as impact, not lag. Bigger clears (combo ≥ x4) extend to **120ms**. No easing (hard cut in, hard cut out). |
| 2 | **Screen shake** | Enemy reaches the gutter (damage) | Amplitude **14px** decaying to 0 over **260ms**, `ease-out` (exponential decay), random per-frame offset on both axes, clamped so the HUD gutter never leaves the viewport. (Disguise cap was 6px — retro roughly doubles it.) A *word-clear* shake is a lighter **6px / 180ms** variant. |
| 3 | **Pixel-burst particles** | Word cleared | 10–16 square "chunk" particles (2–3px, `image-rendering: pixelated`) emitted from the word's glyph centroid, colored from `--color-accent` / `--color-success`. Life **300ms**, `ease-out` outward velocity + gravity, alpha ramps 1→0 over the last 40%. Particle count scales with word length, capped at 16. |
| 4 | **Screen-flash (damage)** | Player takes a hit | Full-canvas overlay in `--color-error` at **0.35** peak alpha, **160ms**, `ease-out` fade to 0. Single flash per hit; never stacks (new hit resets, does not add). |
| 5 | **Combo popup** | Combo counter increments (≥ x2) | `"x4!"` in **Press Start 2P**, `--color-accent` fill with 2px `--color-background` outline (readability over any token). Rises 12px and fades over **320ms**, `ease-out`; scale **1.3 → 1.0** with an overshoot (`cubic-bezier(.2,1.4,.4,1)`) in the first 120ms. Anchored to HUD, never over the marching lane. |
| 6 | **CRT scanline + vignette** | Ambient (skin active) | Static CSS overlay, **not** animated — horizontal scanlines at **6–8% opacity**, radial vignette darkening edges to ~**18%**. `pointer-events: none`, sits above canvas but below HUD. A *very* slow (8s) 1px scanline drift is optional and is the first thing reduced-motion kills. Because it is effectively static, it does not count against the motion budget. |
| 7 | **Chiptune SFX hooks** | Keystroke / clear / combo / damage | Fire-and-forget calls into `src/game/audio.ts`: `keyHit` (short square blip, ~40ms), `wordClear` (rising arpeggio), `comboUp` (pitch steps with combo), `damage` (descending noise burst). All respect the existing sound toggle; muted state suppresses every hook. Audio has no motion-budget constraint but is gated by the sound toggle, not reduced-motion. |

### Readability under motion (non-negotiable)

The lane where words march must stay the top-priority visual at all times. Fixed compositing order, back to front:

1. **z0 — Background**: `--color-background` navy + CRT/vignette overlay (static, ≤8% / ≤18%).
2. **z1 — Particles**: pixel-bursts render *behind* glyphs, alpha-capped at **0.7 peak** and always decaying. Particles are never emitted *in front of* an un-cleared word.
3. **z2 — Words (canvas glyphs)**: always full opacity, always on top of particles and flash. The damage screen-flash (0.35 alpha) is drawn **beneath** the glyph layer so text never washes out.
4. **z3 — HUD / combo popups (DOM)**: above the canvas, but positioned outside the marching lane's bounding box.

Hard rules: no effect may draw an opaque or >0.7-alpha element over an active word; the screen-flash alpha ceiling is **0.35**; combo popups and particles are spatially excluded from the lane; hit-stop is the only effect allowed to touch the words themselves, and it only pauses them (never hides or covers).

### Accessibility (hard requirements)

These are requirements, not suggestions. Each cites the rule it satisfies.

- **`prefers-reduced-motion: reduce`** → disable screen shake, pixel-bursts, screen-flash, scanline drift, and combo-popup movement (show the combo count statically instead); **freeze the mascot sprite** on frame 0. Hit-stop is already sub-perceptual and may stay, but with no shake attached. *(WCAG 2.3.3 Animation from Interactions; honors the skill's reduced-motion rule.)*
- **Color is never the only signal** → preserve the canvas's existing squiggle underline (mistyped) and strike-through (cleared/decayed) glyph shapes so red/green states are distinguishable without color. *(WCAG 1.4.1 Use of Color.)*
- **Contrast ≥ 4.5:1** for all HUD text (score, WPM, timer, labels) on the `#0F172A` navy. Score green `#22C55E` on navy ≈ 7.3:1 ✓; body text uses `--color-text` verified ≥ 4.5:1. Combo popups add a 2px `--color-background` outline so they pass over any syntax color they overlap. *(WCAG 1.4.3.)*
- **Visible focus rings** → **2px** solid `--color-accent` outline with **2px offset** on every focusable HUD control (language toggle, theme/skin toggles, sound toggle, pause). Never `outline: none` without a replacement. *(WCAG 2.4.7.)*
- **Touch targets ≥ 44×44px** → every HUD button (status-bar controls, pause, skin toggle) has a minimum 44px hit area even if the pixel icon is smaller; pad rather than enlarge the glyph. *(WCAG 2.5.5 / 2.5.8.)*
- **No emoji as structural icons** → all icons are pixel-art or SVG (mute, language, palette/`code-xml` per `SkinToggle.vue`). Emoji glyphs render inconsistently and break the pixel aesthetic. *(Skill UX rule.)*
- **Tabular numerals** → score, WPM, and timer use `font-variant-numeric: tabular-nums` (or a fixed-advance pixel font) so digit changes cause **zero layout shift** and no jitter under the CRT overlay. *(Prevents CLS / visual instability.)*
- **RTL parity** → shake, particle emission, and combo-popup anchoring must mirror correctly for Arabic; particles emit from glyph centroid (direction-agnostic), popups anchor to the HUD side, not a hard-coded left/right.

### Motion tokens

Arcade feel is *snappier* than the disguise: bias toward `ease-out`, short exits, and one playful overshoot reserved for combo pops. Define under `html[data-skin='retro']`.

| Token | Duration | Easing | Used by |
|-------|----------|--------|---------|
| `--motion-hitstop` | 90ms | none (hard cut) | Hit-stop freeze |
| `--motion-flash` | 160ms | ease-out | Damage screen-flash |
| `--motion-shake` | 260ms | ease-out (decay) | Damage shake |
| `--motion-shake-sm` | 180ms | ease-out | Clear shake |
| `--motion-particle` | 300ms | ease-out | Pixel-burst life |
| `--motion-pop` | 320ms | `cubic-bezier(.2,1.4,.4,1)` | Combo popup (overshoot in) |
| `--motion-exit` | 120ms | ease-in | Any element leaving screen |
| `--ease-arcade` | — | `cubic-bezier(.16,1,.3,1)` | Default retro ease-out |
| `--ease-pop` | — | `cubic-bezier(.2,1.4,.4,1)` | Overshoot (combo only) |

Rule of thumb: entrances 260–320ms `ease-out`, exits ≤120ms `ease-in`, nothing between 120ms and 400ms is violated. Continuous animation is allowed **only** for loaders/spinners, never for gameplay chrome.

### "Does it stay playable?" checklist

- [ ] With `prefers-reduced-motion: reduce`, shake / particles / flash / scanline-drift are all off and the mascot is frozen — game is still fully playable.
- [ ] No effect exceeds **400ms** or dips below the **120ms** visible floor (hit-stop's 90ms is the one intentional sub-floor exception, and it only pauses).
- [ ] An active (un-cleared) word is never covered by a particle, flash, or popup — glyph layer always renders on top.
- [ ] Screen-flash alpha never exceeds **0.35**; particle peak alpha never exceeds **0.7**.
- [ ] Screen shake stays clamped inside the viewport — the gutter/HUD never scrolls off-screen at max 14px amplitude.
- [ ] Score / WPM / timer use tabular (fixed-advance) numerals — digits changing causes no layout shift.
- [ ] All HUD text measures ≥ 4.5:1 against navy; combo popups pass over any syntax color via their outline.
- [ ] Every HUD control has a ≥ 44px touch target and a visible 2px focus ring on keyboard focus.
- [ ] No emoji is used as a structural icon — pixel/SVG only.
- [ ] Effects mirror correctly in Arabic (RTL): particle origin, shake, and popup anchoring.
- [ ] The canvas switches to **Press Start 2P** only via the single `FONT_FAMILY` change in `renderer.ts`, with `ctx.imageSmoothingEnabled = false` and `image-rendering: pixelated` set for crisp pixels. *(Only code touch required; palette flows automatically through the CSS-var contract.)*
- [ ] Muting via the existing sound toggle silences every `audio.ts` hook.
- [ ] Toggling back to `data-skin='vscode'` fully suppresses all of the above — the disguise remains a clean, shippable alternative.

## Preserving the VS Code Look

The whole point of the architecture is that **retro is added, never subtracted**. The VS Code disguise stays the default and the fallback; retro becomes a second, opt-in visual language that the user flips to and back at will. Nothing about the vscode skin or its palettes is rewritten.

**The switch is one attribute: `data-skin` on `<html>`.** Everything downstream keys off it. Today `src/composables/useSkin.ts` hard-pins it: `export type Skin = 'vscode'`, `const SKIN: Skin = 'vscode'`, `applySkinAttribute()` writes `data-skin='vscode'` on mount, and `setSkin`/`toggleSkin` are deliberate no-ops (`() => {}`) "retained so existing callers keep working now that there is only one skin." To enable retro you WOULD (spec only, not done here):
- Widen the type to `type Skin = 'vscode' | 'retro'` and make `skin` a real reactive state instead of a pinned constant.
- Restore real `setSkin(next)` / `toggleSkin()` that write `document.documentElement.setAttribute('data-skin', skin.value)` and persist the choice to `localStorage` (mirroring how `useVscodeTheme.ts` already persists the palette, and matching the existing FOUC guard in `index.html` so the attribute is set before first paint — no flash of the wrong skin on reload).
- Read the persisted value back on init, defaulting to `'vscode'` when nothing is stored, so first-time and cleared-storage users always land on the untouched VS Code look.

`src/components/ui/SkinToggle.vue` is **already wired for this** — it calls `const { skin, toggleSkin } = useSkin()`, renders `skinLabel` as `skin === 'vscode' ? 'VS Code' : 'Retro'`, `nextSkinLabel` as its inverse, and swaps the icon `icon-[lucide--code-xml]` (vscode) vs `icon-[lucide--palette]` (retro), with `aria-label="Switch to ${nextSkinLabel} theme"`. The moment `toggleSkin` stops being a no-op, this button becomes the live switch with zero further changes to the component. It already lives in the status bar alongside the language, dark/light, theme-picker, and sound controls.

**The retro palette is a new, sibling CSS block — an addition, not an edit.** In `src/style.css`, `:root` holds the "sticker" defaults (Comic Sans display font, `--shadow-pop` hard 4px offsets, `--text-shadow-pop`), and `html[data-skin='vscode'] { … }` flattens all of them into the editor. Retro is introduced as a **new** `html[data-skin='retro'] { … }` block placed as a sibling to the existing vscode block. It redefines the same CSS-variable contract every component and the canvas already read — the color set (`--color-primary` neon red, `--color-secondary` neon blue, `--color-accent` score-green `#22C55E`, `--color-background` deep navy `#0F172A`, `--color-surface` `#192134`, plus text/border/state vars), the depth tokens (`--shadow-pop*`, `--glow-*`, `--text-shadow-pop`), the `--syntax-*` set the canvas uses to decorate words, and the font tokens (`--font-display: "Press Start 2P"`, `--font-primary/--font-mono: "VT323"`). Because the `html[data-skin='vscode']` block is never opened or touched, the VS Code skin and its palettes are guaranteed intact.

**Three independent layers, and they do not collide:**
- `data-skin` — the **whole visual language**: vscode editor chrome vs retro arcade cabinet. This is the new axis.
- `data-vscode-theme` — palette variants *within* the vscode skin (dracula/monokai/… — all **20** color themes), owned by `src/composables/useVscodeTheme.ts`. These are scoped under the vscode skin and are irrelevant while `data-skin='retro'`.
- `data-theme` — `light` | `dark`, which drives `color-scheme` and light/dark palettes.

Because they are orthogonal attributes, adding retro cannot perturb the vscode themes: the vscode palette selectors are all qualified by the vscode skin, so a retro user simply doesn't match them.

**Light/dark scope for retro:** arcade/CRT is dark-first, and the recommended v1 is **dark-only** — define the retro palette once (deep-navy `#0F172A` ground) and let it apply regardless of `data-theme`, so toggling light while in retro is a no-op rather than a broken half-lit cabinet. A later, optional `retro-light` (or a `html[data-skin='retro'][data-theme='light']` override) can be layered in additively without touching v1. Document this so the light toggle's behavior in retro is intentional, not a bug.

**Bottom line:** the VS Code skin plus all 20 of its color themes remain untouched and default. Retro is purely additive — a new `useSkin` state, a new `data-skin` value, a new CSS block, and one already-built toggle — opt-in and reversible, with vscode as the guaranteed fallback.

## Rollout Plan

**No code has been changed yet — this is the proposed sequence.** It is ordered so the vscode default keeps working after **every** step; you can stop at any point and ship what exists. Each step is tagged **[additive]** (new code/files/CSS blocks only — cannot affect vscode) or **[shared]** (touches code paths the vscode skin also runs).

1. **Add the retro token block** — **[additive].** Append `html[data-skin='retro'] { … }` to `src/style.css` as a sibling of the existing `html[data-skin='vscode']` block, redefining the full CSS-variable contract (colors, `--syntax-*`, `--shadow-pop*`, `--glow-*`, font tokens). Not yet reachable (skin still pins vscode), so zero risk. Verify the vscode default renders unchanged.

2. **Load the pixel fonts** — **[additive].** Add `"Press Start 2P"` (headings) and `"VT323"` (body/terminal) via Google Fonts, wired into `--font-display` / `--font-primary` / `--font-mono` *inside the retro block only*. `font-display: swap` and preconnect to avoid layout jank. vscode font tokens are untouched.

3. **Un-noop `useSkin` + persist** — **[shared].** Widen `type Skin = 'vscode' | 'retro'`, make `skin` real reactive state, implement `setSkin`/`toggleSkin` to write `data-skin` and persist to `localStorage`, and read it back on init defaulting to `'vscode'`. Update the `index.html` FOUC guard to honor the stored value. This is the flip that makes `SkinToggle.vue` live — it needs no edit. Confirm default (no stored value) still lands on vscode.

4. **Skin-aware canvas font + `imageSmoothingEnabled`** — **[shared] — THE ONE RENDERER EDIT.** This is the *only* change to existing game logic. In `src/game/renderer.ts`, `FONT_FAMILY` (line 88) is hard-coded and used in every `ctx.font` string (lines 250, 294, 386, 568, 593, 605, 626, 834) because Canvas 2D font strings cannot resolve CSS `var()`. Make the family skin-aware (read `data-skin` / a computed flag and select `"Press Start 2P"`/`"VT323"` vs the current coding monospaces), and when retro is active set `ctx.imageSmoothingEnabled = false` plus `image-rendering: pixelated` on the canvas element for crisp pixels. All *colors* already flow automatically via `getComputedStyle` on the `--color-*`/`--syntax-*` vars, so no other renderer change is needed. Keep the color-not-only squiggle/strike decorations intact.

5. **Retro chrome** — **[additive] preferred.** Ship the arcade-cabinet frame as a *new* component (e.g. `RetroChrome.vue` / `ArcadeChrome.vue`) rendered when `skin==='retro'`, leaving `src/components/ui/EditorChrome.vue` untouched — cleanest and lowest-risk. If instead you conditionally restyle `EditorChrome.vue`, that becomes **[shared]** and needs regression-checking against vscode. Either way the status bar's real controls (language, dark/light, theme picker, sound, the skin toggle itself) must survive into the retro chrome.

6. **Mascot asset + HUD wiring** — **[additive].** Add the simple hand-drawable Volt pixel sprite (kept low-complexity per the constraint) plus retro HUD elements (score, lives, combo), shown only under the retro skin. New assets/components; vscode unaffected.

7. **Juice / particles behind a reduced-motion guard** — **[additive].** Scanlines, CRT bloom, hit particles, bigger screen shake — all gated on `skin==='retro'` AND `prefers-reduced-motion: no-preference`. Under reduced-motion, disable shake/scanline/flash. (Note the current vscode shake is intentionally tiny ≤6px for the "developer editing a file" disguise — retro is free to exceed it, but only when motion is allowed.)

8. **QA matrix** — full grid before ship: **both skins (vscode, retro) × light/dark × en (LTR)/ar (RTL) × reduced-motion on/off.** Plus targeted checks: vscode default across representative color themes (regression from step 3/4), retro contrast ≥4.5:1 for body text, ≥44px touch targets, visible focus rings, no-FOUC on reload for each skin, and canvas pixel-crispness in retro.

**Shared-code summary:** only steps **3, 4, and (if you restyle rather than add) 5** touch code the vscode skin also executes; everything else is additive and cannot regress the default. Step **4 is the single edit to existing game logic** — the renderer font — and it exists solely because Canvas 2D can't read the CSS font var; every other retro visual is delivered through the additive `data-skin='retro'` token block and new components.

## Open Questions / Decisions for the Owner

- **Retro light mode?** V1 is dark-only (the light toggle is intentionally a no-op in retro). Do we want a later `html[data-skin='retro'][data-theme='light']` override, or keep retro permanently dark and hide/disable the light toggle while in retro?
- **Mascot final name.** "Volt" is the working name for the pocket thundercloud. Keep it, or pick another? (Affects any in-game copy that references the buddy.)
- **Which alt boss palette?** The proposed boss sub-theme is the violet/rose `data-retro-theme='boss'` family. Approve it as-is, tune the hues, or add more than one boss palette (per boss)?
- **Chiptune vs. current SFX.** Do we author new square-wave/chiptune hooks (`keyHit`, `wordClear`, `comboUp`, `damage`) for the retro skin, or reuse the existing `audio.ts` sounds under the arcade paint for v1?
- **Mascot fidelity.** Ship only the 16×16 sprite, or invest in the optional 32×32 version with the extra cloud bump, mid-tone ring, and two-segment bolt?
- **Scanline/CRT overlay default.** On by default with a user toggle, or off by default (opt-in) given eyestrain concerns — and where does the toggle live (sound-adjacent settings)?
- **Retro chrome strategy.** New `RetroChrome.vue` component (additive, preferred) vs. conditionally restyling `EditorChrome.vue` (shared, needs regression coverage) — confirm the additive route.
- **Primary red value consistency.** The token spec brightens `--color-primary` to `#FF4D4D` for WCAG; some prose still references the classic `#DC2626`. Confirm `#FF4D4D` is the canonical retro primary across chrome and canvas.
