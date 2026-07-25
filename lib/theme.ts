/** Theme preference, as chosen by the user. */
export type ThemeMode = "light" | "dark" | "system";

/** The theme actually in effect once "system" has been resolved. */
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  theme: ResolvedTheme;
}

export const THEME_STORAGE_KEY = "qbitui-theme";

export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? systemTheme() : mode;
}

function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function storeTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private browsing / disabled storage — the theme just won't persist.
  }
}

/** Reflect a resolved theme on <html> so the CSS variables switch over. */
export function applyResolvedTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

// ---------------------------------------------------------------------------
// A tiny external store, read through useSyncExternalStore.  Keeping the state
// outside React means the theme can be applied to <html> before hydration and
// simply be observed afterwards.
// ---------------------------------------------------------------------------

const SERVER_STATE: ThemeState = { mode: "system", theme: "dark" };

let state: ThemeState = SERVER_STATE;
let initialized = false;
const listeners = new Set<() => void>();
let mediaQuery: MediaQueryList | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function onSystemThemeChange(): void {
  if (state.mode !== "system") return;
  const theme = systemTheme();
  if (theme === state.theme) return;
  state = { mode: "system", theme };
  applyResolvedTheme(theme);
  emit();
}

export function getThemeSnapshot(): ThemeState {
  if (!initialized && typeof window !== "undefined") {
    const mode = readStoredTheme();
    state = { mode, theme: resolveTheme(mode) };
    initialized = true;
  }
  return state;
}

export function getServerThemeSnapshot(): ThemeState {
  return SERVER_STATE;
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  if (!mediaQuery && typeof window !== "undefined") {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", onSystemThemeChange);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function setThemeMode(mode: ThemeMode): void {
  const theme = resolveTheme(mode);
  state = { mode, theme };
  initialized = true;
  storeTheme(mode);
  applyResolvedTheme(theme);
  emit();
}

/**
 * Runs before first paint (injected inline in the document head) so the page
 * never flashes the wrong theme.  Kept dependency-free and self-contained
 * because it is stringified into a <script> tag.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_STORAGE_KEY}");if(m!=="light"&&m!=="dark"&&m!=="system")m="system";var t=m==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.dataset.theme=t;r.style.colorScheme=t;}catch(e){document.documentElement.classList.add("dark");}})();`;
