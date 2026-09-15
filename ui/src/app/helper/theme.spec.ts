import {
  nextThemeMode,
  parseThemeMode,
  prefersDarkScheme,
  resolveTheme,
  themeIcon,
  themeTooltip
} from './theme';

describe('theme', () => {
  it('defaults unknown storage values to auto', () => {
    expect(parseThemeMode(null)).toBe('auto');
    expect(parseThemeMode('sepia')).toBe('auto');
    expect(parseThemeMode('dark')).toBe('dark');
  });

  it('follows the system preference only in auto mode', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('cycles auto → light → dark → auto', () => {
    expect(nextThemeMode('auto')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('auto');
  });

  it('labels the toolbar control from the selected mode', () => {
    expect(themeIcon('auto')).toBe('brightness_auto');
    expect(themeIcon('light')).toBe('light_mode');
    expect(themeIcon('dark')).toBe('dark_mode');
    expect(themeTooltip('auto', 'dark')).toBe('Theme: Auto (dark)');
    expect(themeTooltip('light', 'light')).toBe('Theme: Light');
  });

  it('reads prefers-color-scheme from a media query list', () => {
    expect(prefersDarkScheme({ matches: true })).toBeTrue();
    expect(prefersDarkScheme({ matches: false })).toBeFalse();
  });
});
