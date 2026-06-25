<script setup lang="ts">
import type { Locale } from '@/game/types'

const { locale, setLocale, t } = useI18n()

interface LanguageOption {
  value: Locale
  label: string
}

const options = computed<LanguageOption[]>(() => [
  { value: 'en', label: t('english') === 'English' ? 'EN' : t('english') },
  { value: 'ar', label: 'ع' },
])

function selectLocale(value: Locale): void {
  if (locale.value !== value) setLocale(value)
}

function isActive(value: Locale): boolean {
  return locale.value === value
}
</script>

<template>
  <div class="inline-flex items-center gap-1 rounded-full bg-surface p-1 border-2 border-border">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="isActive(option.value)"
      :aria-label="option.value === 'ar' ? t('arabic') : t('english')"
      class="rounded-full px-3 py-1 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      :class="
        isActive(option.value)
          ? 'bg-primary text-background'
          : 'bg-transparent text-text-secondary hover:text-text'
      "
      @click="selectLocale(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
