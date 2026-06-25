<script setup lang="ts">
import type { RunModifier } from '@/game/modifiers'

defineProps<{ offers: RunModifier[]; wave: number }>()
const emit = defineEmits<{ choose: [id: string] }>()

function pick(id: string): void {
  emit('choose', id)
}
</script>

<template>
  <div class="absolute inset-0 z-20 flex justify-center bg-[var(--color-background)]/70 px-4 pt-[8vh]" dir="ltr">
    <div
      class="h-fit w-full max-w-2xl overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
    >
      <div class="border-b border-[var(--color-border)] bg-[var(--vscode-titlebar)] p-2">
        <div
          class="flex items-center gap-2 rounded-sm border border-[var(--color-primary)] bg-[var(--color-background)] px-2 py-1 font-mono text-sm"
        >
          <span class="text-[var(--color-text-secondary)]">&gt;</span>
          <span class="text-[var(--color-text-secondary)]">Configure run — wave {{ wave + 1 }} (pick a command)</span>
        </div>
      </div>

      <ul class="max-h-[60vh] overflow-y-auto py-1">
        <li v-for="(mod, index) in offers" :key="mod.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--vscode-selection)] focus-visible:bg-[var(--vscode-selection)] focus-visible:outline-none"
            @click="pick(mod.id)"
          >
            <span
              class="grid size-5 shrink-0 place-items-center rounded-sm bg-[var(--vscode-activitybar)] text-[0.625rem] font-semibold text-[var(--color-text-secondary)]"
              >{{ index + 1 }}</span
            >
            <UiAppIcon :name="mod.icon" class="size-4 shrink-0 text-[var(--color-text)]" />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-mono text-[13px] text-[var(--color-text)]">{{ mod.label }}</span>
              <span class="block truncate text-xs text-[var(--color-text-secondary)]">{{ mod.detail }}</span>
            </span>
            <span class="shrink-0 text-xs text-[var(--color-text-secondary)]">{{ mod.hint }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
