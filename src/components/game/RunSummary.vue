<template>
  <article
    class="flex flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-background)] font-mono text-[0.8125rem] leading-relaxed text-text [box-shadow:var(--shadow-pop)]"
  >
    <div
      class="flex items-stretch gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[0.6875rem] tracking-wide text-text-secondary uppercase"
    >
      <span
        v-for="tab in panelTabs"
        :key="tab.id"
        class="border-b border-transparent px-3 py-2"
        :class="
          tab.active
            ? 'border-b-primary text-text'
            : 'text-text-secondary'
        "
      >
        {{ tab.label }}
      </span>
    </div>

    <div class="flex flex-col gap-0.5 px-4 py-3">
      <p
        v-for="(line, index) in outputLines"
        :key="index"
        class="whitespace-pre-wrap tabular-nums"
        :class="lineColor(line.tone)"
      >
        {{ line.text }}
      </p>

      <button
        ref="replayButton"
        type="button"
        class="mt-3 flex w-fit items-center gap-2 rounded-sm px-1 py-0.5 text-left text-link transition-colors hover:text-[var(--color-link-hover)] hover:underline focus-visible:ring-1 focus-visible:ring-link focus-visible:outline-none motion-reduce:transition-none"
        @click="emit('replay')"
      >
        <span class="text-text-secondary">$</span>
        <span>npm run dev</span>
        <span class="text-text-secondary" aria-hidden="true">↵</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
  import type { BigramDelta, RunResult } from '@/game/types'

  type LineTone = 'text' | 'muted' | 'success' | 'error'

  interface OutputLine {
    text: string
    tone: LineTone
  }

  const props = defineProps<{ result: RunResult }>()
  const emit = defineEmits<{ replay: [] }>()

  const { t } = useI18n()

  // Move focus to Replay when the debrief appears so keyboard players can re-run.
  const replayButton = ref<HTMLButtonElement | null>(null)
  onMounted(() => replayButton.value?.focus())

  const roundedCleanWpm = computed(() => Math.round(props.result.cleanWpm))

  const panelTabs = computed(() => [
    { id: 'problems', label: 'PROBLEMS', active: false },
    { id: 'output', label: 'OUTPUT', active: false },
    { id: 'terminal', label: 'TERMINAL', active: true },
    { id: 'debug', label: 'DEBUG CONSOLE', active: false },
  ])

  const summaryLines = computed<OutputLine[]>(() => [
    {
      text: `✓ src/auth.service.ts (${props.result.enemiesDestroyed} tests)`,
      tone: 'success',
    },
    { text: `ops/s: ${roundedCleanWpm.value}`, tone: 'text' },
    { text: `coverage: ${formatErrorRate(props.result.accuracy)}`, tone: 'text' },
    { text: `max streak: ${props.result.maxCombo}`, tone: 'text' },
    { text: `tokens cleared: ${props.result.enemiesDestroyed}`, tone: 'text' },
    { text: `score: ${props.result.score}`, tone: 'text' },
  ])

  const bigramLines = computed<OutputLine[]>(() => {
    const improved = props.result.mostImproved.map(toPassLine)
    const weak = props.result.weakest.map(toFailLine)
    if (improved.length === 0 && weak.length === 0) {
      return [{ text: t('noBigramData'), tone: 'muted' }]
    }
    return [...improved, ...weak]
  })

  const outputLines = computed<OutputLine[]>(() => [
    ...summaryLines.value,
    { text: '', tone: 'muted' },
    ...bigramLines.value,
  ])

  function toPassLine(delta: BigramDelta): OutputLine {
    return {
      text: `✓ pass: ${delta.bigram}  (-${formatErrorDrop(delta)})`,
      tone: 'success',
    }
  }

  function toFailLine(delta: BigramDelta): OutputLine {
    return {
      text: `✗ fail: ${delta.bigram}  (${formatErrorRate(delta.errorRateAfter)})`,
      tone: 'error',
    }
  }

  function lineColor(tone: LineTone): string {
    if (tone === 'success') return 'text-success'
    if (tone === 'error') return 'text-error'
    if (tone === 'muted') return 'text-text-secondary'
    return 'text-text'
  }

  function formatPercent(ratio: number): string {
    return `${Math.round(ratio * 100)}%`
  }

  function formatErrorRate(ratio: number): string {
    return formatPercent(ratio)
  }

  function formatErrorDrop(delta: BigramDelta): string {
    const drop = Math.max(0, delta.errorRateBefore - delta.errorRateAfter)
    return formatPercent(drop)
  }
</script>
