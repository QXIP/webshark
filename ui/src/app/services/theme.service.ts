import { Injectable, NgZone, OnDestroy, Optional } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject } from 'rxjs';
import {
  THEME_STORAGE_KEY,
  ThemeMode,
  ResolvedTheme,
  nextThemeMode,
  parseThemeMode,
  prefersDarkScheme,
  resolveTheme,
  themeIcon,
  themeTooltip
} from '@app/helper/theme';

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly modeSubject = new BehaviorSubject<ThemeMode>(this.readStoredMode());
  private readonly resolvedSubject = new BehaviorSubject<ResolvedTheme>('light');
  private media?: MediaQueryList;
  private mediaListener?: (event: MediaQueryListEvent) => void;

  readonly mode$ = this.modeSubject.asObservable();
  readonly resolved$ = this.resolvedSubject.asObservable();

  constructor(
    @Optional() private overlay?: OverlayContainer,
    @Optional() private ngZone?: NgZone
  ) {
    this.attachMediaListener();
    this.apply(this.resolved);
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  get resolved(): ResolvedTheme {
    return resolveTheme(this.mode, prefersDarkScheme(this.media));
  }

  get icon(): string {
    return themeIcon(this.mode);
  }

  get tooltip(): string {
    return themeTooltip(this.mode, this.resolved);
  }

  setMode(mode: string): void {
    const next = parseThemeMode(mode);
    this.persist(next);
    this.modeSubject.next(next);
    this.apply(this.resolved);
  }

  cycle(): void {
    this.setMode(nextThemeMode(this.mode));
  }

  ngOnDestroy(): void {
    if (this.media && this.mediaListener) {
      this.media.removeEventListener('change', this.mediaListener);
    }
  }

  private readStoredMode(): ThemeMode {
    try {
      return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return 'auto';
    }
  }

  private persist(mode: ThemeMode): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* private mode / blocked storage */
    }
  }

  private attachMediaListener(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaListener = () => {
      if (this.mode !== 'auto') {
        return;
      }
      const apply = () => this.apply(this.resolved);
      this.ngZone ? this.ngZone.run(apply) : apply();
    };
    this.media.addEventListener('change', this.mediaListener);
  }

  private apply(resolved: ResolvedTheme): void {
    const dark = resolved === 'dark';
    const root = document.documentElement;
    root.classList.toggle('theme-dark', dark);
    root.style.colorScheme = resolved;
    document.body?.classList.toggle('theme-dark', dark);
    this.overlay?.getContainerElement()?.classList.toggle('theme-dark', dark);
    this.resolvedSubject.next(resolved);
  }
}
