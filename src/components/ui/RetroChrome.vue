<template>
  <div class="flex min-h-screen flex-col bg-background text-text">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-[#05070d]"
    >
      Skip to content
    </a>

    <!-- Marquee: the lit cabinet header (was: VS Code title bar). -->
    <header
      class="flex h-14 shrink-0 items-center justify-between border-b-2 border-border bg-[var(--color-muted)] px-4 select-none"
    >
      <div class="flex items-center gap-3">
        <UiAppIcon name="icon-[lucide--zap]" class="size-5 text-emphasis" aria-hidden="true" />
        <span
          class="text-sm tracking-wider text-primary sm:text-base [font-family:var(--font-display)] [text-shadow:var(--text-shadow-pop)]"
        >
          KEYSTORM
        </span>
      </div>
      <div
        class="flex items-center gap-2 text-lg text-emphasis [font-family:var(--font-primary)]"
        aria-hidden="true"
      >
        <UiAppIcon name="icon-[lucide--circle-dollar-sign]" class="retro-blink size-4" />
        <span class="tabular-nums">CREDIT 01</span>
      </div>
    </header>

    <!-- Stage strip: run context (was: tab strip + breadcrumbs). -->
    <div
      class="flex h-8 shrink-0 items-center gap-3 border-b-2 border-border bg-surface px-4 text-lg select-none [font-family:var(--font-primary)]"
    >
      <span
        class="border-2 border-border bg-surface-elevated px-2 py-0.5 text-[10px] text-text [box-shadow:var(--shadow-pop-active)] [font-family:var(--font-display)]"
      >
        STAGE 1-1
      </span>
      <span class="text-text-secondary">
        HI <span class="text-emphasis tabular-nums">{{ bestWpm }}</span> WPM
      </span>
    </div>

    <!-- Play-field: the active screen renders here, full width (no explorer —
         the fake src/ tree was pure disguise; retro reclaims the space). -->
    <main id="main" class="flex min-h-0 flex-1 overflow-auto bg-background">
      <div class="min-w-0 flex-1">
        <slot />
      </div>
    </main>

    <!-- HUD control panel (was: status bar) — the REAL controls survive:
         same handlers, same order, only the costume changes. -->
    <footer
      class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t-2 border-border bg-[var(--color-muted)] px-3 py-1.5 text-lg select-none [font-family:var(--font-primary)]"
    >
      <div class="flex items-center gap-4 text-text-secondary" aria-hidden="true">
        <span class="hidden sm:inline">INSERT COIN</span>
        <span>
          BEST <span class="text-emphasis tabular-nums">{{ bestWpm }}</span>
        </span>
      </div>

      <div class="flex items-center gap-2">
        <!-- Language switch -->
        <button
          type="button"
          class="retro-btn flex min-h-9 items-center gap-1.5 px-2.5"
          :title="locale === 'ar' ? t('english') : t('arabic')"
          :aria-label="locale === 'ar' ? t('english') : t('arabic')"
          @click="toggleLocale"
        >
          <UiAppIcon name="icon-[lucide--languages]" class="size-4" />
          <span>{{ locale === 'ar' ? 'عربي' : 'EN' }}</span>
        </button>

        <!-- Sound toggle -->
        <button
          type="button"
          class="retro-btn flex min-h-9 items-center gap-1.5 px-2.5"
          :title="settings.audioEnabled ? t('audioOn') : t('audioOff')"
          :aria-label="settings.audioEnabled ? t('audioOn') : t('audioOff')"
          @click="settings.toggleAudio()"
        >
          <UiAppIcon
            :name="settings.audioEnabled ? 'icon-[lucide--volume-2]' : 'icon-[lucide--volume-x]'"
            class="size-4"
          />
          <span class="hidden sm:inline" aria-hidden="true">
            {{ settings.audioEnabled ? 'SOUND ▮▮▮' : 'SOUND ▯▯▯' }}
          </span>
        </button>

        <!-- Back to the VS Code skin -->
        <button
          type="button"
          class="retro-btn flex min-h-9 items-center gap-1.5 px-2.5"
          title="Switch to VS Code theme"
          aria-label="Switch to VS Code theme"
          @click="toggleSkin"
        >
          <UiAppIcon name="icon-[lucide--code-xml]" class="size-4" />
          <span class="hidden sm:inline">VS CODE</span>
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
  import type { Locale } from '@/game/types';

  const { locale, setLocale, t } = useI18n();
  const settings = useSettingsStore();
  const game = useGameStore();
  const { toggleSkin } = useSkin();

  const bestWpm = computed(() => Math.round(game.best[locale.value] ?? 0));

  function toggleLocale(): void {
    const next: Locale = locale.value === 'ar' ? 'en' : 'ar';
    setLocale(next);
  }
</script>
