<template>
  <div
    class="fixed inset-0 z-50 flex justify-center bg-black/30 px-4 pt-[7vh]"
    @click.self="cancel"
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
          <span class="ms-auto text-xs">↑↓ to preview · Enter to keep · Esc to cancel</span>
        </div>
      </div>

      <ul class="max-h-[60vh] overflow-y-auto py-1">
        <li v-for="(theme, index) in themes" :key="theme.id">
          <button
            :ref="(el) => setItemRef(el, index)"
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-text focus-visible:outline-none"
            :class="index === activeIndex ? 'bg-[var(--vscode-selection)]' : ''"
            @mouseenter="preview(index)"
            @click="selectAt(index)"
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

  // The theme active when the picker opened — restored if the user cancels.
  const originalId = themeId.value;
  const startIndex = themes.findIndex((theme) => theme.id === themeId.value);
  const activeIndex = ref(startIndex < 0 ? 0 : startIndex);
  const itemRefs = ref<(HTMLButtonElement | null)[]>([]);

  function setItemRef(el: unknown, index: number): void {
    itemRefs.value[index] = (el as HTMLButtonElement | null) ?? null;
  }

  // Live-preview the theme at an index (wrapping), exactly like VS Code's picker.
  function preview(index: number): void {
    const clamped = (index + themes.length) % themes.length;
    activeIndex.value = clamped;
    setTheme(themes[clamped].id);
    nextTick(() => itemRefs.value[clamped]?.scrollIntoView({ block: 'nearest' }));
  }

  function commit(): void {
    emit('close');
  }

  function cancel(): void {
    setTheme(originalId);
    emit('close');
  }

  function selectAt(index: number): void {
    preview(index);
    commit();
  }

  function onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        preview(activeIndex.value + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        preview(activeIndex.value - 1);
        break;
      case 'Enter':
        event.preventDefault();
        commit();
        break;
      case 'Escape':
        event.preventDefault();
        cancel();
        break;
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>
