<template>
  <div
    class="fixed inset-0 z-50 flex justify-center bg-black/30 px-4 pt-[7vh]"
    @click.self="emit('close')"
  >
    <div
      class="h-fit w-full max-w-lg overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-2xl"
    >
      <div class="border-b border-[var(--color-border)] bg-[var(--vscode-titlebar)] p-2">
        <div
          class="flex items-center gap-2 rounded-sm border border-[var(--color-primary)] bg-[var(--color-background)] px-2 py-1 font-mono text-sm text-text-secondary"
        >
          <UiAppIcon name="icon-[lucide--palette]" class="size-4" />
          <span>Color Theme</span>
        </div>
      </div>

      <ul class="max-h-[60vh] overflow-y-auto py-1">
        <li v-for="theme in themes" :key="theme.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-text hover:bg-[var(--vscode-selection)] focus-visible:bg-[var(--vscode-selection)] focus-visible:outline-none"
            @click="choose(theme.id)"
          >
            <UiAppIcon
              :name="theme.mode === 'dark' ? 'icon-[lucide--moon]' : 'icon-[lucide--sun]'"
              class="size-4 shrink-0 text-text-secondary"
            />
            <span class="flex-1 truncate">{{ theme.label }}</span>
            <span class="text-xs text-text-secondary capitalize">{{ theme.mode }}</span>
            <UiAppIcon
              v-if="theme.id === themeId"
              name="icon-[lucide--check]"
              class="size-4 shrink-0 text-[var(--color-primary)]"
            />
            <span v-else class="size-4 shrink-0" aria-hidden="true"></span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useVscodeTheme } from '@/composables/useVscodeTheme';

  const emit = defineEmits<{ close: [] }>();
  const { themes, themeId, setTheme } = useVscodeTheme();

  function choose(id: string): void {
    setTheme(id);
    emit('close');
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      emit('close');
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>
