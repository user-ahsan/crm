import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        // Any explicit choice stops following the OS preference.
        systemFollowActive = false;
        set({ theme });
      },
      toggleTheme: () => {
        // Any explicit toggle stops following the OS preference.
        systemFollowActive = false;
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light';
          return { theme: next };
        });
      },
    }),
    { name: 'nexuscrm-theme' }
  )
);

/* ── System preference detection (FEATURES 22) ────────────────────
 * First-time visitors (no persisted `nexuscrm-theme`) inherit the OS
 * prefers-color-scheme and keep following it live while no explicit choice
 * has been made. Once the user toggles or setTheme()s, the explicit choice
 * is persisted and takes over. The FOUC-prevention script in
 * lib/constants.ts is untouched — it still applies a persisted dark class
 * before first paint; system-detection applies on the client after mount. */
let systemThemeMedia: MediaQueryList | null = null;
let systemFollowActive = false;
let systemThemeInitDone = false;

function applySystemTheme() {
  if (!systemFollowActive || !systemThemeMedia) return;
  useThemeStore.setState({ theme: systemThemeMedia.matches ? 'dark' : 'light' });
}

function startSystemThemeSync() {
  if (systemThemeInitDone || typeof window === 'undefined') return;
  systemThemeInitDone = true;
  try {
    systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    // Only follow the OS while the user has no explicit persisted preference.
    if (localStorage.getItem('nexuscrm-theme') === null) {
      systemFollowActive = true;
      applySystemTheme();
      systemThemeMedia.addEventListener('change', applySystemTheme);
    }
  } catch {
    // Best-effort: if matchMedia/localStorage is unavailable, fall back to
    // the persisted theme. Explicit toggling still works.
    systemFollowActive = false;
  }
}
startSystemThemeSync();
