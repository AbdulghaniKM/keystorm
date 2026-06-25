import type { Locale } from '@/game/types'

interface PersistedSettings {
  locale: Locale
  audioEnabled: boolean
}

const STORAGE_KEY = 'keystorm:settings'

function loadSettings(): PersistedSettings {
  const defaults: PersistedSettings = { locale: 'en', audioEnabled: true }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      locale: parsed.locale === 'ar' ? 'ar' : 'en',
      audioEnabled: parsed.audioEnabled !== false,
    }
  } catch {
    return defaults
  }
}

function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Persistence is best-effort; ignore storage failures.
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadSettings()
  const locale = ref<Locale>(initial.locale)
  const audioEnabled = ref<boolean>(initial.audioEnabled)

  const dir = computed<'rtl' | 'ltr'>(() => (locale.value === 'ar' ? 'rtl' : 'ltr'))

  function setLocale(next: Locale): void {
    locale.value = next
  }

  function toggleAudio(): void {
    audioEnabled.value = !audioEnabled.value
  }

  function setAudio(on: boolean): void {
    audioEnabled.value = on
  }

  watch(
    [locale, audioEnabled],
    ([currentLocale, currentAudio]) => {
      saveSettings({ locale: currentLocale, audioEnabled: currentAudio })
    },
  )

  return { locale, audioEnabled, dir, setLocale, toggleAudio, setAudio }
})
