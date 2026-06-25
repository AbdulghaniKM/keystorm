import { ref, type Ref } from 'vue';

/** Visual skin. The app now ships a single VS Code editor skin. */
export type Skin = 'vscode';

const SKIN: Skin = 'vscode';

// The VS Code skin is always active, so `data-skin` is pinned on the root for the
// stylesheet to key off (mirrors the FOUC guard in index.html).
const applySkinAttribute = (): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-skin', SKIN);
};

const skin: Ref<Skin> = ref(SKIN);

applySkinAttribute();

// `setSkin`/`toggleSkin` are retained as no-ops so existing callers keep working
// now that there is only one skin to show.
export const useSkin = () => {
  const setSkin = (): void => {};
  const toggleSkin = (): void => {};

  return { skin, skins: [SKIN] as readonly Skin[], setSkin, toggleSkin };
};
