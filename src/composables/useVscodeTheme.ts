import { ref, watch, type Ref } from 'vue';

export type VscodeThemeMode = 'dark' | 'light';

export interface VscodeTheme {
  id: string;
  label: string;
  mode: VscodeThemeMode;
}

/** Curated set of modern, popular VS Code color themes. */
export const VSCODE_THEMES: readonly VscodeTheme[] = [
  { id: 'dark-modern', label: 'Dark Modern', mode: 'dark' },
  { id: 'one-dark-pro', label: 'One Dark Pro', mode: 'dark' },
  { id: 'dracula', label: 'Dracula', mode: 'dark' },
  { id: 'monokai', label: 'Monokai', mode: 'dark' },
  { id: 'tokyo-night', label: 'Tokyo Night', mode: 'dark' },
  { id: 'night-owl', label: 'Night Owl', mode: 'dark' },
  { id: 'nord', label: 'Nord', mode: 'dark' },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', mode: 'dark' },
  { id: 'synthwave-84', label: "SynthWave '84", mode: 'dark' },
  { id: 'palenight', label: 'Palenight', mode: 'dark' },
  { id: 'cobalt2', label: 'Cobalt2', mode: 'dark' },
  { id: 'ayu-mirage', label: 'Ayu Mirage', mode: 'dark' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', mode: 'dark' },
  { id: 'solarized-dark', label: 'Solarized Dark', mode: 'dark' },
  { id: 'light-modern', label: 'Light Modern', mode: 'light' },
  { id: 'github-light', label: 'GitHub Light', mode: 'light' },
  { id: 'solarized-light', label: 'Solarized Light', mode: 'light' },
  { id: 'quiet-light', label: 'Quiet Light', mode: 'light' },
  { id: 'ayu-light', label: 'Ayu Light', mode: 'light' },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', mode: 'light' },
];

const THEME_KEY = 'app-vscode-theme';
const DEFAULT_THEME_ID = 'dark-modern';

const themeById = new Map(VSCODE_THEMES.map((theme) => [theme.id, theme]));
const isThemeId = (value: string | null): value is string =>
  value !== null && themeById.has(value);

// Remember the last theme chosen in each mode so the dark/light toggle restores
// the user's actual pick instead of snapping back to a default.
const lastByMode: Record<VscodeThemeMode, string> = {
  dark: 'dark-modern',
  light: 'light-modern',
};

const readStored = (): string => {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME_ID;
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
};

const resolve = (id: string): VscodeTheme => themeById.get(id) ?? VSCODE_THEMES[0];

const applyTheme = (id: string): void => {
  if (typeof document === 'undefined') return;
  const theme = resolve(id);
  const root = document.documentElement;
  root.setAttribute('data-vscode-theme', theme.id);
  root.style.colorScheme = theme.mode;
};

const themeId: Ref<string> = ref(readStored());
lastByMode[resolve(themeId.value).mode] = themeId.value;
applyTheme(themeId.value);

watch(themeId, (id) => {
  lastByMode[resolve(id).mode] = id;
  applyTheme(id);
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* Persistence is best-effort. */
  }
});

export const useVscodeTheme = () => {
  const setTheme = (id: string): void => {
    if (themeById.has(id)) themeId.value = id;
  };

  const current = (): VscodeTheme => resolve(themeId.value);

  /** Quick dark/light switch — restores the last theme used in the other mode. */
  const toggleMode = (): void => {
    const nextMode: VscodeThemeMode = current().mode === 'dark' ? 'light' : 'dark';
    themeId.value = lastByMode[nextMode];
  };

  return { themeId, themes: VSCODE_THEMES, setTheme, current, toggleMode };
};
