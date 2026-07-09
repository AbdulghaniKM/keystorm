<script setup lang="ts">
import { GameEngine } from '@/game/engine';
import { GameRenderer, readRenderColors } from '@/game/renderer';
import type { RenderColors } from '@/game/renderer';
import { ComboAudio } from '@/game/audio';
import type { GameEvent, LiveStats, RunResult } from '@/game/types';
import type { RunModifier } from '@/game/modifiers';
import { useVscodeTheme } from '@/composables/useVscodeTheme';
import GameCommandPalette from '@/components/game/CommandPalette.vue';
import GameHud from '@/components/game/Hud.vue';
import GameVoltMascot from '@/components/game/VoltMascot.vue';

const SHATTER_SHAKE_MS = 180;
const MISS_SHAKE_MS = 90;
const BREACH_SHAKE_MS = 220;
const SHAKE_DECAY_PER_MS = 1;
const SHIELD_FLASH_MS = 420;
const BOSS_BANNER_MS = 2600;

const emit = defineEmits<{ over: [result: RunResult] }>();

const { locale } = useI18n();
const settings = useSettingsStore();
const gameStore = useGameStore();
const { skin } = useSkin();

const field = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const stats = ref<LiveStats>(createInitialStats());
const paused = ref(false);
const drafting = ref(false);
const offers = ref<RunModifier[]>([]);
const wave = ref(0);
const shieldFlash = ref(false);
const bossBanner = ref('');

// Respect the OS reduced-motion setting on the canvas (templates already use the
// motion-reduce: variant; the canvas shake has to be gated in script).
const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let engine: GameEngine | null = null;
let renderer: GameRenderer | null = null;
let audio: ComboAudio | null = null;
let colors: RenderColors | null = null;
let shakeMs = 0;
let audioResumed = false;

const loop = useGameLoop(tick);

function createInitialStats(): LiveStats {
  return {
    grossWpm: 0,
    cleanWpm: 0,
    accuracy: 1,
    combo: 0,
    maxCombo: 0,
    lives: 0,
    score: 0,
    elapsedMs: 0,
    enemiesDestroyed: 0,
  };
}

function tick(dtMs: number): void {
  if (!engine || !renderer || !colors) return;
  engine.update(dtMs);
  decayShake(dtMs);
  renderer.draw(engine, locale.value, colors, shakeMs);
}

function decayShake(dtMs: number): void {
  shakeMs = Math.max(0, shakeMs - dtMs * SHAKE_DECAY_PER_MS);
}

function handleEvent(event: GameEvent): void {
  if (!audio) return;
  switch (event.type) {
    case 'hit':
      audio.keyTap();
      audio.hit(event.combo);
      break;
    case 'shatter':
      audio.shatter();
      if (!reducedMotion) shakeMs = SHATTER_SHAKE_MS;
      break;
    case 'miss':
      audio.miss();
      if (!reducedMotion) shakeMs = Math.max(shakeMs, MISS_SHAKE_MS);
      break;
    case 'breach':
      audio.loseLife();
      if (!reducedMotion) shakeMs = Math.max(shakeMs, BREACH_SHAKE_MS);
      break;
    case 'wavestart':
      audio.keyTap();
      break;
    case 'shield':
      audio.shield();
      flashShield();
      break;
    case 'bossstart':
      audio.bossStart();
      showBossBanner(bossBannerText(event.kind));
      break;
    case 'bosscleared':
      audio.bossCleared();
      bossBanner.value = '';
      break;
    case 'wavecomplete':
      drafting.value = true;
      offers.value = engine?.offers() ?? [];
      wave.value = event.wave;
      break;
    case 'gameover':
      audio.death();
      endRun();
      break;
  }
}

function flashShield(): void {
  if (reducedMotion) return;
  shieldFlash.value = true;
  window.setTimeout(() => {
    shieldFlash.value = false;
  }, SHIELD_FLASH_MS);
}

function bossBannerText(kind: string): string {
  if (kind === 'merge') return 'Resolving merge conflict…';
  if (kind === 'stacktrace') return 'Tracing stack…';
  return 'Resolving…';
}

function showBossBanner(text: string): void {
  bossBanner.value = text;
  window.setTimeout(() => {
    if (bossBanner.value === text) bossBanner.value = '';
  }, BOSS_BANNER_MS);
}

function endRun(): void {
  loop.stop();
  if (!engine) return;
  const result = engine.result();
  gameStore.commitRun(result, engine.weakness);
  emit('over', result);
}

function measureViewport(): { width: number; height: number } {
  const host = field.value;
  if (!host) return { width: 0, height: 0 };
  return { width: host.clientWidth, height: host.clientHeight };
}

function syncCanvasSize(): void {
  if (!renderer || !engine) return;
  const { width, height } = measureViewport();
  if (width <= 0 || height <= 0) return;
  renderer.resize(width, height, window.devicePixelRatio || 1);
  engine.resize(width, height);
}

function refreshColors(): void {
  if (canvas.value) colors = readRenderColors(canvas.value);
}

function resumeAudioOnce(): void {
  if (audioResumed || !audio) return;
  audio.resume();
  audioResumed = true;
}

function isPrintableStroke(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.length === 1;
}

function togglePause(): void {
  if (!engine) return;
  if (engine.isPaused) engine.resume();
  else engine.pause();
  paused.value = engine.isPaused;
}

function chooseModifier(id: string): void {
  if (!engine) return;
  engine.chooseModifier(id);
  drafting.value = false;
  offers.value = [];
}

function handlePaletteKey(event: KeyboardEvent): boolean {
  if (!engine || engine.phase !== 'drafting') return false;
  const index = Number(event.key) - 1;
  const list = engine.offers();
  if (Number.isInteger(index) && index >= 0 && index < list.length) {
    event.preventDefault();
    chooseModifier(list[index].id);
  }
  return true;
}

function handleKeydown(event: KeyboardEvent): void {
  resumeAudioOnce();
  if (!engine) return;
  if (handlePaletteKey(event)) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    togglePause();
    return;
  }
  if (paused.value) return;
  if (event.key === 'Backspace') {
    event.preventDefault();
    engine.clearActiveWord();
    return;
  }
  if (!isPrintableStroke(event)) return;
  if (event.key === ' ') event.preventDefault();
  engine.handleChar(event.key);
}

function createEngine(): GameEngine {
  const activeLocale = settings.locale;
  const { width, height } = measureViewport();
  return new GameEngine({
    locale: activeLocale,
    weakness: gameStore.vectorFor(activeLocale),
    width,
    height,
    onStats: (next) => {
      stats.value = { ...next };
    },
    onEvent: handleEvent,
  });
}

useResizeObserver(field, syncCanvasSize);

watch(
  () => settings.audioEnabled,
  (enabled) => audio?.setEnabled(enabled),
);

// The canvas caches theme colors (CSS vars can't be read per-frame cheaply), so
// re-read them whenever the active VS Code theme changes — otherwise the play
// field keeps the old palette until a reload.
const { themeId } = useVscodeTheme();
watch(themeId, () => nextTick(refreshColors));

onMounted(() => {
  const context = canvas.value?.getContext('2d');
  if (!context) return;

  engine = createEngine();
  renderer = new GameRenderer(context);
  audio = new ComboAudio();
  audio.setEnabled(settings.audioEnabled);

  refreshColors();
  syncCanvasSize();

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('pointerdown', resumeAudioOnce);

  engine.start();
  loop.start();
});

onUnmounted(() => {
  loop.stop();
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('pointerdown', resumeAudioOnce);
});
</script>

<template>
  <div class="flex size-full flex-col overflow-hidden">
    <GameHud :stats="stats" class="z-10 shrink-0" />
    <div ref="field" class="relative min-h-0 flex-1 bg-background">
      <canvas ref="canvas" class="block size-full" />
      <!-- Retro-only HUD buddy: reacts to combo/lives; decorative (aria-hidden
           inside), the real readouts live in GameHud. -->
      <GameVoltMascot
        v-if="skin === 'retro'"
        :combo="stats.combo"
        :lives="stats.lives"
        :scale="2"
        class="absolute end-2 top-2 z-10"
      />
      <div
        v-if="shieldFlash"
        class="pointer-events-none absolute inset-0 bg-success/10 transition-opacity duration-300 motion-reduce:hidden"
        aria-hidden="true"
      />
      <div
        v-if="bossBanner"
        class="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--vscode-titlebar)] px-3 py-1 font-mono text-xs text-[var(--color-text-secondary)]"
      >
        <span class="icon-[lucide--git-merge] size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ bossBanner }}</span>
      </div>
      <div
        v-if="paused"
        class="absolute inset-0 flex items-center justify-center bg-background/70 font-mono text-sm text-success"
      >
        <span>// paused — press Esc to resume</span>
      </div>
      <GameCommandPalette
        v-if="drafting"
        :offers="offers"
        :wave="wave"
        @choose="chooseModifier"
      />
    </div>
  </div>
</template>
