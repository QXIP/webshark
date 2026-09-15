export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'webshark.theme';

export function parseThemeMode(raw: string | null | undefined): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'dark') {
    return 'dark';
  }
  if (mode === 'light') {
    return 'light';
  }
  return prefersDark ? 'dark' : 'light';
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'auto') {
    return 'light';
  }
  if (mode === 'light') {
    return 'dark';
  }
  return 'auto';
}

export function themeIcon(mode: ThemeMode): string {
  if (mode === 'light') {
    return 'light_mode';
  }
  if (mode === 'dark') {
    return 'dark_mode';
  }
  return 'brightness_auto';
}

export function themeTooltip(mode: ThemeMode, resolved: ResolvedTheme): string {
  if (mode === 'auto') {
    return `Theme: Auto (${resolved})`;
  }
  return mode === 'dark' ? 'Theme: Dark' : 'Theme: Light';
}

export function prefersDarkScheme(media?: Pick<MediaQueryList, 'matches'> | null): boolean {
  if (media) {
    return !!media.matches;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
