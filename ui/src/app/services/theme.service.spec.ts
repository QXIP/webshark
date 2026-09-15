import { OverlayContainer } from '@angular/cdk/overlay';
import { THEME_STORAGE_KEY } from '@app/helper/theme';
import { ThemeService } from './theme.service';

class OverlayStub {
  el = document.createElement('div');
  getContainerElement() {
    return this.el;
  }
}

describe('ThemeService', () => {
  let overlay: OverlayStub;
  let originalMatchMedia: typeof window.matchMedia;
  let prefersDark = false;

  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove('theme-dark');
    document.body.classList.remove('theme-dark');
    overlay = new OverlayStub();
    originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove('theme-dark');
    document.body.classList.remove('theme-dark');
  });

  function service(): ThemeService {
    return new ThemeService(overlay as unknown as OverlayContainer);
  }

  it('applies the system dark preference in auto mode', () => {
    prefersDark = true;
    const theme = service();
    expect(theme.mode).toBe('auto');
    expect(theme.resolved).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBeTrue();
    expect(overlay.el.classList.contains('theme-dark')).toBeTrue();
    expect(document.documentElement.style.colorScheme).toBe('dark');
    theme.ngOnDestroy();
  });

  it('stores an explicit light choice and does not follow the system', () => {
    prefersDark = true;
    const theme = service();
    theme.setMode('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(theme.resolved).toBe('light');
    expect(document.documentElement.classList.contains('theme-dark')).toBeFalse();
    theme.ngOnDestroy();
  });

  it('restores a stored dark preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    prefersDark = false;
    const theme = service();
    expect(theme.mode).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBeTrue();
    theme.ngOnDestroy();
  });
});
