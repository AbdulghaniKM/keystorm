<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-mono text-xs text-[var(--color-text)]"
    :dir="dir"
  >
    <span class="flex items-center gap-1 text-[var(--color-text)]">
      <span class="text-[var(--color-warning)]" aria-hidden="true">●</span>
      auth.service.ts
    </span>

    <span class="text-[var(--color-text-secondary)]">Spaces: 2</span>

    <span class="text-[var(--color-text-secondary)]">ops: <span class="text-[var(--color-text)] tabular-nums">{{ cleanWpm }}</span></span>

    <span class="text-[var(--color-text-secondary)]">cov <span class="text-[var(--color-text)] tabular-nums">{{ accuracyLabel }}</span></span>

    <span :class="hasCombo ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'">
      ✓ <span class="tabular-nums">{{ stats.combo }}</span> passing
    </span>

    <span class="flex items-center gap-1 text-[var(--color-text-secondary)]">
      <span
        v-for="heart in hearts"
        :key="heart.key"
        aria-hidden="true"
        :class="heartColor(heart)"
        >{{ heart.filled ? '●' : '○' }}</span
      >
    </span>

    <span class="text-[var(--color-text-secondary)]">Σ <span class="text-[var(--color-text)] tabular-nums">{{ stats.score }}</span></span>

    <span class="sr-only" role="status" aria-live="polite">{{ liveAnnounce }}</span>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { LiveStats } from '@/game/types'

  interface Props {
    stats: LiveStats
  }

  const props = defineProps<Props>()

  const { dir } = useI18n()

  const cleanWpm = computed(() => Math.round(props.stats.cleanWpm))
  const accuracyLabel = computed(() => `${Math.round(props.stats.accuracy * 100)}%`)
  const hasCombo = computed(() => props.stats.combo > 0)
  const isLastLife = computed(() => props.stats.lives === 1)

  // Announced via an sr-only live region only when lives actually change.
  const liveAnnounce = computed(() => {
    const lives = props.stats.lives
    if (lives <= 0) return 'Game over'
    if (lives === 1) return 'Warning: last life remaining'
    return `${lives} lives remaining`
  })

  const TOTAL_HEARTS = 3

  interface Heart {
    key: number
    filled: boolean
  }

  const hearts = computed<Heart[]>(() => {
    const total = Math.max(props.stats.lives, TOTAL_HEARTS)
    return Array.from({ length: total }, (_, index) => ({
      key: index,
      filled: index < props.stats.lives,
    }))
  })

  function heartColor(heart: Heart): string {
    if (!heart.filled) return 'text-[var(--color-border)]'
    if (isLastLife.value) return 'text-[var(--color-error)]'
    return 'text-[var(--color-text-secondary)]'
  }
</script>
