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
  { id: 'light-modern', label: 'Light Modern', mode: 'light' },
  { id: 'github-light', label: 'GitHub Light', mode: 'light' },
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
