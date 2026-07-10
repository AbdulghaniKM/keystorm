<script setup lang="ts">
import GameVoltMascot from '@/components/game/VoltMascot.vue'

const props = defineProps<{ bestWpm: number }>()

const emit = defineEmits<{ start: [] }>()

const { t, locale } = useI18n()
const { skin } = useSkin()

const lineNumbers = Array.from({ length: 18 }, (_value, index) => index + 1)

function startRun(): void {
  emit('start')
}
</script>

<template>
  <button
    type="button"
    :dir="skin === 'retro' && locale === 'ar' ? 'rtl' : 'ltr'"
    class="relative block w-full cursor-text overflow-hidden bg-[var(--color-background)] text-left font-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#007acc]"
    :aria-label="t('start')"
    @click="startRun"
  >
    <!-- Retro-only: Volt idles above the prompt, inviting the player in. -->
    <GameVoltMascot v-if="skin === 'retro'" :scale="4" class="absolute right-6 top-6" />

    <!-- Retro skin: arcade attract screen instead of the fake editor. -->
    <div
      v-if="skin === 'retro'"
      class="flex min-h-72 flex-col items-center justify-center gap-6 px-6 py-16 text-center [font-family:var(--font-display)]"
    >
      <span class="retro-blink text-xl text-[var(--color-primary)] sm:text-2xl">
        {{ t('pressToStart').toUpperCase() }}
      </span>
      <span v-if="props.bestWpm > 0" class="text-sm text-[var(--color-text-secondary)] tabular-nums">
        {{ t('bestWpm') }}: {{ props.bestWpm }}
      </span>
    </div>

    <div v-else class="flex">
      <div
        aria-hidden="true"
        class="select-none py-3 pl-4 pr-3 text-right tabular-nums text-[var(--color-text-secondary)]"
      >
        <div v-for="lineNumber in lineNumbers" :key="lineNumber">{{ lineNumber }}</div>
      </div>

      <pre class="overflow-x-auto py-3 pr-4"><code><span class="text-[var(--syntax-comment)]">// {{ t('pressToStart') }} </span><span class="text-[var(--syntax-comment)]">&#9655;</span>
<span v-if="props.bestWpm > 0" class="text-[var(--syntax-comment)]">// {{ t('bestWpm') }}: {{ props.bestWpm }}</span><span v-else class="text-[var(--syntax-comment)]">// {{ t('noRunsYet') }}</span>
<span class="text-[var(--syntax-control)]">import</span> <span class="text-[var(--syntax-punctuation)]">{</span> <span class="text-[var(--syntax-variable)]">TokenStream</span> <span class="text-[var(--syntax-punctuation)]">}</span> <span class="text-[var(--syntax-control)]">from</span> <span class="text-[var(--syntax-string)]">'./token-stream'</span>

<span class="text-[var(--syntax-control)]">export</span> <span class="text-[var(--syntax-keyword)]">class</span> <span class="text-[var(--syntax-type)]">AuthService</span> <span class="text-[var(--syntax-punctuation)]">{</span>
  <span class="text-[var(--syntax-keyword)]">private</span> <span class="text-[var(--syntax-keyword)]">readonly</span> <span class="text-[var(--syntax-variable)]">stream</span><span class="text-[var(--syntax-punctuation)]">:</span> <span class="text-[var(--syntax-type)]">TokenStream</span>

  <span class="text-[var(--syntax-keyword)]">constructor</span><span class="text-[var(--syntax-punctuation)]">(</span><span class="text-[var(--syntax-variable)]">stream</span><span class="text-[var(--syntax-punctuation)]">:</span> <span class="text-[var(--syntax-type)]">TokenStream</span><span class="text-[var(--syntax-punctuation)]">)</span> <span class="text-[var(--syntax-punctuation)]">{</span>
    <span class="text-[var(--syntax-keyword)]">this</span><span class="text-[var(--syntax-punctuation)]">.</span><span class="text-[var(--syntax-variable)]">stream</span> <span class="text-[var(--syntax-punctuation)]">=</span> <span class="text-[var(--syntax-variable)]">stream</span>
  <span class="text-[var(--syntax-punctuation)]">}</span>

  <span class="text-[var(--syntax-keyword)]">public</span> <span class="text-[var(--syntax-keyword)]">async</span> <span class="text-[var(--syntax-function)]">authenticate</span><span class="text-[var(--syntax-punctuation)]">(</span><span class="text-[var(--syntax-variable)]">token</span><span class="text-[var(--syntax-punctuation)]">:</span> <span class="text-[var(--syntax-keyword)]">string</span><span class="text-[var(--syntax-punctuation)]">)</span><span class="text-[var(--syntax-punctuation)]">:</span> <span class="text-[var(--syntax-type)]">Promise</span><span class="text-[var(--syntax-punctuation)]">&lt;</span><span class="text-[var(--syntax-keyword)]">boolean</span><span class="text-[var(--syntax-punctuation)]">&gt;</span> <span class="text-[var(--syntax-punctuation)]">{</span>
    <span class="text-[var(--syntax-control)]">if</span> <span class="text-[var(--syntax-punctuation)]">(</span><span class="text-[var(--syntax-punctuation)]">!</span><span class="text-[var(--syntax-variable)]">token</span><span class="text-[var(--syntax-punctuation)]">.</span><span class="text-[var(--syntax-function)]">trim</span><span class="text-[var(--syntax-punctuation)]">())</span> <span class="text-[var(--syntax-control)]">return</span> <span class="text-[var(--syntax-keyword)]">false</span>

    <span class="text-[var(--syntax-keyword)]">const</span> <span class="text-[var(--syntax-variable)]">verified</span> <span class="text-[var(--syntax-punctuation)]">=</span> <span class="text-[var(--syntax-control)]">await</span> <span class="text-[var(--syntax-keyword)]">this</span><span class="text-[var(--syntax-punctuation)]">.</span><span class="text-[var(--syntax-variable)]">stream</span><span class="text-[var(--syntax-punctuation)]">.</span><span class="text-[var(--syntax-function)]">verify</span><span class="text-[var(--syntax-punctuation)]">(</span><span class="text-[var(--syntax-variable)]">token</span><span class="text-[var(--syntax-punctuation)]">)</span>
    <span class="text-[var(--syntax-control)]">return</span> <span class="text-[var(--syntax-variable)]">verified</span><span class="text-[var(--syntax-punctuation)]">.</span><span class="text-[var(--syntax-variable)]">ok</span><span class="text-[var(--color-text)] ks-caret motion-reduce:[animation:none]">&nbsp;</span>
  <span class="text-[var(--syntax-punctuation)]">}</span>
<span class="text-[var(--syntax-punctuation)]">}</span></code></pre>
    </div>
  </button>
</template>

<style scoped>
.ks-caret {
  border-left: 2px solid var(--color-text);
  animation: ks-caret-blink 1s step-end infinite;
}

@keyframes ks-caret-blink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}
</style>
