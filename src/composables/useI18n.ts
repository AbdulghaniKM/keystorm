import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { messages } from '@/i18n'
import { useSettingsStore } from '@/stores/settings.store'
import type { Locale } from '@/game/types'

interface I18nApi {
  t: (key: string, vars?: Record<string, string | number>) => string
  locale: ComputedRef<Locale>
  dir: ComputedRef<'rtl' | 'ltr'>
  setLocale: (locale: Locale) => void
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (token, name) =>
    name in vars ? String(vars[name]) : token,
  )
}

function syncDocument(locale: Locale, dir: 'rtl' | 'ltr'): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = dir
}

export function useI18n(): I18nApi {
  const settings = useSettingsStore()
  const locale = computed<Locale>(() => settings.locale)
  const dir = computed<'rtl' | 'ltr'>(() => (locale.value === 'ar' ? 'rtl' : 'ltr'))

  function t(key: string, vars?: Record<string, string | number>): string {
    const bag = messages[locale.value] as Record<string, string>
    const template = bag[key] ?? key
    return interpolate(template, vars)
  }

  function setLocale(next: Locale): void {
    settings.setLocale(next)
  }

  watch(
    locale,
    () => syncDocument(locale.value, dir.value),
    { immediate: true },
  )

  return { t, locale, dir, setLocale }
}
