<template>
  <div :dir="dir" :class="isVsCode ? 'h-full' : 'mx-auto max-w-5xl px-4 py-6 sm:py-8'">
    <main :class="isVsCode ? 'h-full' : 'space-y-6'">
      <template v-if="phase === 'idle'">
        <GameStartScreen :best-wpm="bestWpm" @start="begin" />
        <GameKeyboardHeatmap v-if="!isVsCode" :locale="locale" :vector="vector" />
      </template>

      <GameCanvas
        v-else-if="phase === 'playing'"
        :class="
          isVsCode
            ? 'block size-full'
            : 'h-[72vh] min-h-[480px] overflow-hidden rounded-3xl border border-border shadow-xl ring-1 ring-border/40'
        "
        @over="onOver"
      />

      <template v-else-if="result">
        <GameRunSummary :result="result" @replay="begin" />
        <GameKeyboardHeatmap v-if="!isVsCode" :locale="locale" :vector="vector" />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { RunResult } from '@/game/types'
import type { RunPhase } from '@/game/types'
import GameCanvas from '@/components/game/Canvas.vue'
import GameKeyboardHeatmap from '@/components/game/KeyboardHeatmap.vue'
import GameRunSummary from '@/components/game/RunSummary.vue'
import GameStartScreen from '@/components/game/StartScreen.vue'

definePage({ route: '/', head: 'Keystorm' })

const game = useGameStore()
const { locale, dir } = useI18n()
const { skin } = useSkin()

const isVsCode = computed<boolean>(() => skin.value === 'vscode')

const phase = ref<RunPhase>('idle')
const result = ref<RunResult | null>(null)

const bestWpm = computed<number>(() => game.best[locale.value])
const vector = computed(() => game.vectors[locale.value])

function begin(): void {
  result.value = null
  phase.value = 'playing'
}

function onOver(runResult: RunResult): void {
  result.value = runResult
  phase.value = 'over'
}

function handleStartKey(event: KeyboardEvent): void {
  if (phase.value === 'idle' && event.key === 'Enter') begin()
}

onMounted(() => window.addEventListener('keydown', handleStartKey))
onUnmounted(() => window.removeEventListener('keydown', handleStartKey))
</script>
