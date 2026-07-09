<template>
  <!-- data-skin picks the whole visual language: the VS Code editor disguise
       (default) or the 32-bit retro arcade cabinet. Same slot, same controls —
       only the chrome costume changes (docs/design/retro-32bit-skin.md). -->
  <UiRetroChrome v-if="skin === 'retro'">
    <slot />
  </UiRetroChrome>
  <UiEditorChrome v-else>
    <slot />
  </UiEditorChrome>
</template>

<script setup lang="ts">
  const { skin } = useSkin();
</script>
