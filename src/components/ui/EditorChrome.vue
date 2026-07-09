<template>
  <div class="flex min-h-screen flex-col bg-background text-text">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
    >
      Skip to content
    </a>

    <!-- Title bar -->
    <div
      class="relative flex h-8 shrink-0 items-center justify-between bg-[var(--vscode-titlebar)] px-3 text-xs text-text select-none"
    >
      <div class="flex items-center gap-3" aria-hidden="true">
        <UiAppIcon name="icon-[lucide--code-xml]" class="size-4 text-primary" />
        <span
          v-for="menu in menus"
          :key="menu"
          class="hidden cursor-default rounded px-1 py-0.5 hover:bg-[var(--vscode-hover)] lg:inline"
        >
          {{ menu }}
        </span>
      </div>
      <span class="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-text/90">
        auth.service.ts — keystorm — Visual Studio Code
      </span>
      <div class="flex items-center gap-4" aria-hidden="true">
        <UiAppIcon name="icon-[lucide--minus]" class="size-3.5" />
        <UiAppIcon name="icon-[lucide--square]" class="size-3" />
        <UiAppIcon name="icon-[lucide--x]" class="size-3.5 hover:text-error" />
      </div>
    </div>

    <!-- Body: activity bar + explorer + editor column -->
    <div class="flex min-h-0 flex-1">
      <!-- Activity bar -->
      <nav
        class="flex w-12 shrink-0 flex-col items-center bg-[var(--vscode-activitybar)] py-1 text-text-secondary"
        aria-hidden="true"
      >
        <div
          v-for="action in activityActions"
          :key="action.icon"
          class="relative flex h-12 w-full items-center justify-center"
          :class="action.active ? 'text-text' : 'hover:text-text'"
        >
          <span v-if="action.active" class="absolute inset-y-0 start-0 w-0.5 bg-text"></span>
          <UiAppIcon :name="action.icon" class="size-6" />
          <span
            v-if="action.badge"
            class="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-white"
          >
            {{ action.badge }}
          </span>
        </div>
        <div class="mt-auto flex flex-col items-center gap-1">
          <UiAppIcon name="icon-[lucide--user-round]" class="size-6 hover:text-text" />
          <UiAppIcon name="icon-[lucide--settings]" class="size-6 hover:text-text" />
        </div>
      </nav>

      <!-- Explorer side bar -->
      <aside
        class="hidden w-60 shrink-0 flex-col bg-surface text-[13px] select-none md:flex"
        aria-hidden="true"
      >
        <div
          class="flex items-center justify-between px-4 pt-2 pb-1 text-[11px] tracking-wide text-text-secondary"
        >
          <span>EXPLORER</span>
          <UiAppIcon name="icon-[lucide--ellipsis]" class="size-4" />
        </div>

        <div
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-bold tracking-wide text-text"
        >
          <UiAppIcon name="icon-[lucide--chevron-down]" class="size-4 text-text-secondary" />
          <span>KEYSTORM</span>
        </div>

        <div class="flex-1 overflow-y-auto pb-2">
          <div
            v-for="(row, index) in explorerRows"
            :key="index"
            class="flex h-[22px] items-center gap-1 pe-2 text-text"
            :class="row.active ? 'bg-[var(--vscode-selection)]' : 'hover:bg-[var(--vscode-hover)]'"
            :style="{ paddingInlineStart: `${row.depth * 12 + 12}px` }"
          >
            <UiAppIcon
              v-if="row.kind === 'folder-open'"
              name="icon-[lucide--chevron-down]"
              class="size-4 shrink-0 text-text-secondary"
            />
            <UiAppIcon
              v-else-if="row.kind === 'folder'"
              name="icon-[lucide--chevron-right]"
              class="size-4 shrink-0 text-text-secondary"
            />
            <span v-else class="w-4 shrink-0"></span>

            <UiAppIcon
              :name="iconFor(row.kind)"
              class="size-4 shrink-0"
              :style="{ color: colorFor(row.kind) }"
            />
            <span class="truncate" :class="row.dirty ? 'text-[#e2c08d]' : ''">{{ row.name }}</span>
            <span v-if="row.dirty" class="ms-auto text-[11px] font-semibold text-[#e2c08d]">M</span>
          </div>
        </div>
      </aside>

      <!-- Editor column -->
      <div class="flex min-w-0 flex-1 flex-col bg-background">
        <!-- Tab strip -->
        <div class="flex h-9 shrink-0 items-stretch bg-surface text-[13px] select-none">
          <div
            v-for="tab in editorTabs"
            :key="tab.name"
            class="flex items-center gap-2 border-e border-background px-3"
            :class="
              tab.active
                ? 'bg-background text-text'
                : 'bg-[var(--vscode-tab-inactive)] text-text-secondary hover:bg-[var(--vscode-hover)]'
            "
          >
            <UiAppIcon
              :name="iconFor(tab.kind)"
              class="size-4 shrink-0"
              :style="{ color: colorFor(tab.kind) }"
              aria-hidden="true"
            />
            <span>{{ tab.name }}</span>
            <span v-if="tab.dirty" class="size-2 rounded-full bg-text" aria-hidden="true"></span>
            <UiAppIcon
              v-else
              name="icon-[lucide--x]"
              class="size-3.5 text-text-secondary hover:text-text"
              aria-hidden="true"
            />
          </div>
        </div>

        <!-- Breadcrumbs -->
        <div
          class="flex h-6 shrink-0 items-center gap-1 bg-background px-4 text-xs text-text-secondary select-none"
          aria-hidden="true"
        >
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb">
            <span class="hover:text-text">{{ crumb }}</span>
            <UiAppIcon
              v-if="index < breadcrumbs.length - 1"
              name="icon-[lucide--chevron-right]"
              class="size-3.5"
            />
          </template>
        </div>

        <!-- Editor area: the active screen renders its own editor body -->
        <main id="main" class="flex min-h-0 flex-1 overflow-auto bg-background font-mono">
          <div class="min-w-0 flex-1">
            <slot />
          </div>
        </main>
      </div>
    </div>

    <!-- Status bar -->
    <footer
      class="vscode-statusbar flex h-[22px] shrink-0 items-center justify-between text-xs select-none"
    >
      <div class="flex h-full items-center" aria-hidden="true">
        <span class="vscode-statusbar-item flex h-full items-center gap-1 px-2">
          <UiAppIcon name="icon-[lucide--git-branch]" class="size-3.5" />
          main
          <UiAppIcon name="icon-[lucide--refresh-cw]" class="ms-1 size-3" />
        </span>
        <span class="vscode-statusbar-item flex h-full items-center gap-1.5 px-2">
          <span class="flex items-center gap-0.5">
            <UiAppIcon name="icon-[lucide--circle-x]" class="size-3.5" />0
          </span>
          <span class="flex items-center gap-0.5">
            <UiAppIcon name="icon-[lucide--triangle-alert]" class="size-3.5" />0
          </span>
        </span>
      </div>

      <div class="flex h-full items-center">
        <span class="hidden px-2 md:inline" aria-hidden="true">Ln 24, Col 12</span>
        <span class="hidden px-2 lg:inline" aria-hidden="true">UTF-8</span>

        <!-- Visible settings cluster: language / theme toggle / theme picker / sound. -->
        <span class="mx-1 hidden h-3.5 w-px self-center bg-current opacity-30 sm:block" aria-hidden="true"></span>

        <!-- Language switch -->
        <button
          type="button"
          class="vscode-statusbar-item flex h-full items-center gap-1 px-2"
          :title="locale === 'ar' ? t('english') : t('arabic')"
          :aria-label="locale === 'ar' ? t('english') : t('arabic')"
          @click="toggleLocale"
        >
          <UiAppIcon name="icon-[lucide--languages]" class="size-3.5" />
          <span>{{ locale === 'ar' ? 'عربي' : 'EN' }}</span>
        </button>

        <!-- Quick dark/light toggle -->
        <button
          type="button"
          class="vscode-statusbar-item flex h-full items-center px-2"
          :title="`Toggle ${themeMode === 'dark' ? 'light' : 'dark'} mode`"
          :aria-label="`Toggle ${themeMode === 'dark' ? 'light' : 'dark'} mode`"
          @click="toggleMode"
        >
          <UiAppIcon :name="themeMode === 'dark' ? 'icon-[lucide--moon]' : 'icon-[lucide--sun]'" class="size-3.5" />
        </button>

        <!-- Color theme picker -->
        <button
          type="button"
          class="vscode-statusbar-item flex h-full items-center gap-1 px-2"
          :title="`Color theme: ${themeLabel}`"
          aria-label="Select color theme"
          @click="showThemePicker = true"
        >
          <UiAppIcon name="icon-[lucide--palette]" class="size-3.5" />
          <span class="hidden md:inline">{{ themeLabel }}</span>
        </button>

        <!-- Sound toggle -->
        <button
          type="button"
          class="vscode-statusbar-item flex h-full items-center px-2"
          :title="settings.audioEnabled ? t('audioOn') : t('audioOff')"
          :aria-label="settings.audioEnabled ? t('audioOn') : t('audioOff')"
          @click="settings.toggleAudio()"
        >
          <UiAppIcon
            :name="settings.audioEnabled ? 'icon-[lucide--volume-2]' : 'icon-[lucide--volume-x]'"
            class="size-3.5"
          />
        </button>

        <!-- Skin switch: flip the whole app into the 32-bit retro cabinet -->
        <button
          type="button"
          class="vscode-statusbar-item flex h-full items-center px-2"
          title="Switch to Retro theme"
          aria-label="Switch to Retro theme"
          @click="toggleSkin"
        >
          <UiAppIcon name="icon-[lucide--gamepad-2]" class="size-3.5" />
        </button>
      </div>
    </footer>

    <UiThemePicker v-if="showThemePicker" @close="showThemePicker = false" />
  </div>
</template>

<script setup lang="ts">
  import type { Locale } from '@/game/types';
  import { useVscodeTheme } from '@/composables/useVscodeTheme';

  const { locale, setLocale, t } = useI18n();
  const settings = useSettingsStore();
  const { current, toggleMode } = useVscodeTheme();
  const { toggleSkin } = useSkin();

  const showThemePicker = ref(false);
  const themeMode = computed(() => current().mode);
  const themeLabel = computed(() => current().label);

  const menus = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];

  const activityActions = [
    { icon: 'icon-[lucide--files]', active: true, badge: '' },
    { icon: 'icon-[lucide--search]', active: false, badge: '' },
    { icon: 'icon-[lucide--git-branch]', active: false, badge: '3' },
    { icon: 'icon-[lucide--bug]', active: false, badge: '' },
    { icon: 'icon-[lucide--blocks]', active: false, badge: '' },
  ];

  type FileKind = 'folder-open' | 'folder' | 'ts' | 'json' | 'md';

  interface ExplorerRow {
    name: string;
    depth: number;
    kind: FileKind;
    active?: boolean;
    dirty?: boolean;
  }

  const explorerRows: ExplorerRow[] = [
    { name: 'src', depth: 0, kind: 'folder-open' },
    { name: 'components', depth: 1, kind: 'folder-open' },
    { name: 'game', depth: 2, kind: 'folder' },
    { name: 'ui', depth: 2, kind: 'folder' },
    { name: 'services', depth: 1, kind: 'folder-open' },
    { name: 'auth.service.ts', depth: 2, kind: 'ts', active: true, dirty: true },
    { name: 'api.service.ts', depth: 2, kind: 'ts' },
    { name: 'stores', depth: 1, kind: 'folder-open' },
    { name: 'game.store.ts', depth: 2, kind: 'ts' },
    { name: 'utils', depth: 1, kind: 'folder-open' },
    { name: 'validation.ts', depth: 2, kind: 'ts' },
    { name: 'main.ts', depth: 1, kind: 'ts' },
    { name: 'package.json', depth: 0, kind: 'json' },
    { name: 'tsconfig.json', depth: 0, kind: 'json' },
    { name: 'vite.config.ts', depth: 0, kind: 'ts' },
    { name: 'README.md', depth: 0, kind: 'md' },
  ];

  interface EditorTab {
    name: string;
    kind: FileKind;
    active?: boolean;
    dirty?: boolean;
  }

  const editorTabs: EditorTab[] = [
    { name: 'auth.service.ts', kind: 'ts', active: true, dirty: true },
    { name: 'api.service.ts', kind: 'ts' },
    { name: 'game.store.ts', kind: 'ts' },
    { name: 'vite.config.ts', kind: 'ts' },
    { name: 'README.md', kind: 'md' },
  ];

  const breadcrumbs = ['keystorm', 'src', 'services', 'auth.service.ts'];

  // File-type icon colors are intentionally theme-independent (they read as the
  // familiar VS Code file-icon hues on both light and dark themes).
  const FILE_ICONS: Record<FileKind, string> = {
    'folder-open': 'icon-[lucide--folder-open]',
    folder: 'icon-[lucide--folder]',
    ts: 'icon-[lucide--file-code-2]',
    json: 'icon-[lucide--file-json]',
    md: 'icon-[lucide--file-text]',
  };

  const FILE_COLORS: Record<FileKind, string> = {
    'folder-open': '#c09553',
    folder: '#c09553',
    ts: '#519aba',
    json: '#cbcb41',
    md: '#519aba',
  };

  function iconFor(kind: FileKind): string {
    return FILE_ICONS[kind];
  }

  function colorFor(kind: FileKind): string {
    return FILE_COLORS[kind];
  }

  function toggleLocale(): void {
    const next: Locale = locale.value === 'ar' ? 'en' : 'ar';
    setLocale(next);
  }
</script>
