<script setup lang="ts">
import { KEYBOARD_LAYOUTS } from '@/game/keyboards'
import { errorRate } from '@/game/bigrams'
import type { Locale, WeaknessVector } from '@/game/types'

const props = defineProps<{ locale: Locale; vector: WeaknessVector }>()

const { t } = useI18n()

const DANGER_HUE = 8
const MASTERED_HUE = 150
const HEAT_SATURATION = 26
const LEGEND_STEPS = 6

interface KeyHeat {
  glyph: string
  attempts: number
  errorRate: number
}

const rows = computed(() => KEYBOARD_LAYOUTS[props.locale].rows)

const heatByKey = computed<Map<string, KeyHeat>>(() => {
  const layoutKeys = rows.value.flat()
  return new Map(layoutKeys.map((key) => [key, measureKey(key)]))
})

// Discrete weak→mastered swatches (no gradient); flex + dir flips them for RTL.
const legendSwatches = computed<string[]>(() =>
  Array.from({ length: LEGEND_STEPS }, (_, step) => heatColor(1 - step / (LEGEND_STEPS - 1))),
)

function measureKey(key: string): KeyHeat {
  let attempts = 0
  let errors = 0
  for (const [bigram, stat] of Object.entries(props.vector)) {
    if (!bigram.includes(key)) continue
    attempts += stat.attempts
    errors += stat.errors
  }
  return { glyph: key, attempts, errorRate: errorRate({ attempts, errors }) }
}

function heatHue(rate: number): number {
  return DANGER_HUE + (MASTERED_HUE - DANGER_HUE) * (1 - rate)
}

// Muted editor-widget lightness: dark, low-contrast swatches (no bright neon).
function heatLightness(hue: number): number {
  const midProximity = 1 - Math.abs(hue - 70) / 70
  return 34 - 6 * Math.max(midProximity, 0)
}

function heatColor(rate: number): string {
  const hue = heatHue(rate)
  return `hsl(${hue} ${HEAT_SATURATION}% ${heatLightness(hue)}%)`
}

function hasData(heat: KeyHeat): boolean {
  return heat.attempts > 0
}

function tileFill(heat: KeyHeat): string {
  return hasData(heat) ? heatColor(heat.errorRate) : 'var(--color-surface-elevated)'
}

function glyphInk(heat: KeyHeat): string {
  if (!hasData(heat)) return 'var(--color-text-secondary)'
  return 'var(--color-text)'
}
</script>

<template>
  <section :dir="locale === 'ar' ? 'rtl' : 'ltr'" class="flex flex-col gap-2">
    <h3 class="font-mono uppercase tracking-[0.18em] text-[0.6rem] text-text-secondary text-start">
      {{ t('accuracy') }}
    </h3>
    <p class="font-mono text-[0.65rem] text-text-secondary text-start">// keystroke coverage</p>
    <div class="flex h-2 w-full gap-px overflow-hidden rounded-sm border border-border">
      <span
        v-for="(swatch, step) in legendSwatches"
        :key="step"
        class="h-full flex-1"
        :style="{ backgroundColor: swatch }"
      ></span>
    </div>
    <div class="flex flex-col items-center gap-1">
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        class="flex gap-1"
      >
        <span
          v-for="heat in row.map((key) => heatByKey.get(key)!)"
          :key="heat.glyph"
          class="grid size-8 place-items-center rounded-sm font-mono text-sm"
          :class="hasData(heat)
            ? 'border border-border'
            : 'border border-dashed border-border'"
          :style="{ backgroundColor: tileFill(heat), color: glyphInk(heat) }"
        >
          {{ heat.glyph }}
        </span>
      </div>
    </div>
  </section>
</template>
