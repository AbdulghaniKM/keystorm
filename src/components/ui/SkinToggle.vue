<template>
  <button
    type="button"
    :aria-label="`Switch to ${nextSkinLabel} theme`"
    :title="`Theme: ${skinLabel}`"
    class="inline-flex size-10 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    @click="toggleSkin"
  >
    <UiAppIcon :name="iconName" :size="1.125" />
  </button>
</template>

<script setup lang="ts">
  const { skin, toggleSkin } = useSkin();

  const skinLabel = computed(() => (skin.value === 'vscode' ? 'VS Code' : 'Retro'));
  const nextSkinLabel = computed(() => (skin.value === 'vscode' ? 'Retro' : 'VS Code'));
  const iconName = computed(() =>
    skin.value === 'vscode' ? 'icon-[lucide--code-xml]' : 'icon-[lucide--palette]',
  );
</script>
