<template>
  <!-- Decorative only: every state Volt shows is mirrored by a real readout
       (combo count, lives) elsewhere, so it is never the only signal. -->
  <canvas
    ref="el"
    :width="GRID_W * scale"
    :height="GRID_H * scale"
    :style="{ width: `${GRID_W * scale}px`, height: `${GRID_H * scale}px` }"
    class="pointer-events-none select-none"
    :class="dir === 'rtl' ? '-scale-x-100' : ''"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
  // ─── Volt, the pocket thundercloud ─────────────────────────────────────────
  // Keystorm's retro-skin mascot (spec: docs/design/retro-32bit-skin.md §Mascot).
  // The grid below is quantized from the hand-made art in public/volt.png
  // (native 32×33 pixel grid, majority-vote downsample, palette-snapped) — one
  // char = one pixel, drawn cell-by-cell at an integer scale with no smoothing.
  // States: idle (bob) / blink / hit / celebrate, driven by combo & lives props.
  // Under prefers-reduced-motion nothing loops — the static pose still swaps so
  // the read survives without motion.

  interface Props {
    /** Live combo count — an increase triggers the celebrate pose. */
    combo?: number;
    /** Remaining lives — a decrease triggers the hit pose. */
    lives?: number;
    /** Integer pixel scale (32px sprite × scale). 2 = HUD buddy, 4 = start screen. */
    scale?: number;
  }

  const props = withDefaults(defineProps<Props>(), { combo: 0, lives: 0, scale: 2 });

  const { dir } = useI18n();
  const el = ref<HTMLCanvasElement | null>(null);

  const GRID_W = 32;
  // Two spare rows so the bob (+1) and hit jolt (+2) never clip the bolt tail.
  const GRID_H = 35;
  const { scale } = toRefs(props);

  // 8-color palette lifted from public/volt.png (pops on the deep-navy field).
  const PALETTE: Record<string, string> = {
    '#': '#0f172e', // ink outline / pupils
    O: '#5b8def', // storm-blue body
    '+': '#bfd8ff', // top-left highlight rim
    ':': '#4168b8', // under-cloud shade
    o: '#38d3e3', // cyan pupils + cheek blush
    '*': '#ffd23f', // bolt gold
    x: '#e39a33', // bolt shade
    w: '#f2f7ff', // eye glint
  };
  const HURT_BODY = '#f87171'; // body tint while zapped (matches --color-error)

  // Base grid — 33 rows × 32 chars, '.' = transparent. Quantized from the
  // source art; face rows hand-cleaned for symmetry.
  const BASE: readonly string[] = [
    '............#######.............',
    '...........#+++++++#............',
    '..........#++OOOOO++#...........',
    '......####++OOOOOOO++####.......',
    '.....#+++#+OOOOOOOOO++++#.......',
    '....#+OOO+OOOOOOOOOOOOOOO##.....',
    '...#+OOOOOOOOOOOOOOOOOOOO+##....',
    '...#++OOOOOOOOOOOOOOOOOOO++#....',
    '.#++OOOOOOOO##OOOOOO##OOOOOO++..',
    '.#+OOOOOOOOOwoOOOOOOwoOOOOOOO+#.',
    '#+OOOOOOOOOOooOOOOOOooOOOOOOO++#',
    '#+OOOOooOOOO##OOOOOO##OOooOOOO+#',
    '#OOOOOOOOOOOOOO#OOO#OOOOOOOOOOO#',
    '#:OOOOOOOOOOOOOO###OOOOOOOOOOO:#',
    '.#OOOOOOOOOOOOOOOOOOOOOOOOOOO:#.',
    '.#::OOOOOOOOOOO:::OOOOOOOOOO::#.',
    '.#:::OOOOOOOOO:::::OOOOOOOO::#..',
    '...#:::::::::::OOO:::::::::##...',
    '....#######################.....',
    '............#xxxxx##............',
    '...........#xx***x##............',
    '...........#x****x####..........',
    '..........#x*********x#.........',
    '.........#x*********x#..........',
    '.........######x***x#...........',
    '.............##***x#............',
    '..............#***#.............',
    '.............##**x#.............',
    '.............#**x#..............',
    '............##*x#...............',
    '............#*x#................',
    '............#x#.................',
    '............##..................',
  ];

  function withRows(rows: Record<number, string>): string[] {
    return BASE.map((row, index) => rows[index] ?? row);
  }

  interface Pose {
    grid: readonly string[];
    /** Whole-sprite downward jolt, in sprite pixels. */
    offsetY: number;
    /** Body cells repainted (hit tint). */
    tint?: Record<string, string>;
  }

  const POSES: Record<string, Pose> = {
    idleA: { grid: BASE, offsetY: 0 },
    // Bob down one pixel, bolt tip flickers off.
    idleB: { grid: withRows({ 32: '................................' }), offsetY: 1 },
    // Eyes close into a single lash line.
    blink: {
      grid: withRows({
        8: '.#++OOOOOOOOOOOOOOOOOOOOOOOO++..',
        9: '.#+OOOOOOOOOOOOOOOOOOOOOOOOOO+#.',
        10: '#+OOOOOOOOOO##OOOOOO##OOOOOOO++#',
        11: '#+OOOOooOOOOOOOOOOOOOOOOooOOOO+#',
      }),
      offsetY: 0,
    },
    // X-eyes + open "ouch" mouth, jolted down, body zapped red.
    hit: {
      grid: withRows({
        8: '.#++OOOOOOO#OO#OOOO#OO#OOOOO++..',
        9: '.#+OOOOOOOOO##OOOOOO##OOOOOOO+#.',
        10: '#+OOOOOOOOOO##OOOOOO##OOOOOOO++#',
        11: '#+OOOOooOOO#OO#OOOO#OO#OooOOOO+#',
        12: '#OOOOOOOOOOOOOO#####OOOOOOOOOOO#',
      }),
      offsetY: 2,
      tint: { O: HURT_BODY },
    },
    // Closed-happy arc eyes + wide grin; sparkles alternate corners per frame.
    celebA: {
      grid: withRows({
        2: '......*...#++OOOOO++#...........',
        5: '....#+OOO+OOOOOOOOOOOOOOO##.*...',
        8: '.#++OOOOOOOOOOOOOOOOOOOOOOOO++..',
        9: '.#+OOOOOOOOO##OOOOOO##OOOOOOO+#.',
        10: '#+OOOOOOOOOOOOOOOOOOOOOOOOOOO++#',
        11: '#+OOOOooOOOOOOOOOOOOOOOOooOOOO+#',
        13: '#:OOOOOOOOOOOOO#####OOOOOOOOOO:#',
      }),
      offsetY: 0,
    },
    celebB: {
      grid: withRows({
        1: '...........#+++++++#...*........',
        6: '.*.#+OOOOOOOOOOOOOOOOOOOO+##....',
        8: '.#++OOOOOOOOOOOOOOOOOOOOOOOO++..',
        9: '.#+OOOOOOOOO##OOOOOO##OOOOOOO+#.',
        10: '#+OOOOOOOOOOOOOOOOOOOOOOOOOOO++#',
        11: '#+OOOOooOOOOOOOOOOOOOOOOooOOOO+#',
        13: '#:OOOOOOOOOOOOO#####OOOOOOOOOO:#',
      }),
      offsetY: 0,
    },
  };

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HIT_MS = 500;
  const CELEBRATE_MS = 600;
  const TICK_MS = 140;
  const BOB_TICKS = 5; // ≈700ms per idle frame
  const BLINK_MS = 120;

  let hitUntil = 0;
  let celebrateUntil = 0;
  let blinkUntil = 0;
  let nextBlinkAt = 0;
  let tickCount = 0;
  let intervalId = 0;

  function currentPose(now: number): Pose {
    // Priority: hit interrupts celebrate interrupts blink interrupts idle.
    if (now < hitUntil) return POSES.hit;
    if (now < celebrateUntil) {
      if (reducedMotion) return POSES.celebA;
      return tickCount % 2 === 0 ? POSES.celebA : POSES.celebB;
    }
    if (reducedMotion) return POSES.idleA;
    if (now < blinkUntil) return POSES.blink;
    return Math.floor(tickCount / BOB_TICKS) % 2 === 0 ? POSES.idleA : POSES.idleB;
  }

  function draw(): void {
    const canvas = el.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const cell = props.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pose = currentPose(performance.now());
    for (let row = 0; row < pose.grid.length; row++) {
      const line = pose.grid[row];
      for (let col = 0; col < GRID_W; col++) {
        const char = line[col];
        if (char === '.') continue;
        const color = pose.tint?.[char] ?? PALETTE[char];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(col * cell, (row + pose.offsetY) * cell, cell, cell);
      }
    }
  }

  function tick(): void {
    tickCount++;
    const now = performance.now();
    // Random blink every 3–6s while idling.
    if (now >= hitUntil && now >= celebrateUntil && now >= nextBlinkAt) {
      blinkUntil = now + BLINK_MS;
      nextBlinkAt = now + 3000 + Math.random() * 3000;
    }
    draw();
  }

  // Combo chain → celebrate; life lost → hit. State is decoration only — the
  // HUD's real combo/lives readouts stay the source of truth.
  watch(
    () => props.combo,
    (next, prev) => {
      if (next > (prev ?? 0) && next > 1) {
        celebrateUntil = performance.now() + CELEBRATE_MS;
        if (reducedMotion) scheduleStaticReset(CELEBRATE_MS);
        draw();
      }
    },
  );

  watch(
    () => props.lives,
    (next, prev) => {
      if (prev !== undefined && next < prev) {
        hitUntil = performance.now() + HIT_MS;
        if (reducedMotion) scheduleStaticReset(HIT_MS);
        draw();
      }
    },
  );

  // Reduced motion: no loop runs, so poses need a one-shot redraw to fall back
  // to the frozen idle frame once a reaction window ends.
  function scheduleStaticReset(afterMs: number): void {
    window.setTimeout(draw, afterMs + 20);
  }

  onMounted(() => {
    nextBlinkAt = performance.now() + 3000 + Math.random() * 3000;
    draw();
    if (!reducedMotion) intervalId = window.setInterval(tick, TICK_MS);
  });

  onUnmounted(() => {
    if (intervalId) window.clearInterval(intervalId);
  });

  watch(scale, () => nextTick(draw));
</script>
