import { ref, watch, type Ref } from 'vue';

/** Visual skin: the VS Code editor disguise (default) or the 32-bit retro
 *  arcade cabinet (spec: docs/design/retro-32bit-skin.md). */
export type Skin = 'vscode' | 'retro';

const SKIN_KEY = 'app-skin';
const DEFAULT_SKIN: Skin = 'vscode';
const SKINS: readonly Skin[] = ['vscode', 'retro'];

const isSkin = (value: string | null): value is Skin =>
  value === 'vscode' || value === 'retro';

// First-time and cleared-storage users always land on the VS Code look.
const readStored = (): Skin => {
  if (typeof localStorage === 'undefined') return DEFAULT_SKIN;
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    return isSkin(raw) ? raw : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
};

// `data-skin` on the root is the single switch every stylesheet block and the
// canvas renderer key off (mirrors the FOUC guard in index.html).
const applySkinAttribute = (value: Skin): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-skin', value);
};

const skin: Ref<Skin> = ref(readStored());

applySkinAttribute(skin.value);

watch(skin, (next) => {
  applySkinAttribute(next);
  try {
    localStorage.setItem(SKIN_KEY, next);
  } catch {
    /* Persistence is best-effort. */
  }
});

export const useSkin = () => {
  const setSkin = (next: Skin): void => {
    if (SKINS.includes(next)) skin.value = next;
  };

  const toggleSkin = (): void => {
    skin.value = skin.value === 'vscode' ? 'retro' : 'vscode';
  };

  return { skin, skins: SKINS, setSkin, toggleSkin };
};
