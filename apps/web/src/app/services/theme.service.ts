import { Injectable, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** The two supported UI themes. */
export type Theme = 'light' | 'dark';

/** `localStorage` key used to persist the user's theme preference across page loads. */
const STORAGE_KEY = 'nvm-manager-theme';

/**
 * Manages the UI theme (light / dark) of the application.
 *
 * ## Resolution order on first load
 * 1. Persisted user choice in `localStorage` (key: `nvm-manager-theme`)
 * 2. OS / browser preference via `prefers-color-scheme: dark`
 * 3. Fallback: `'light'`
 *
 * ## How the theme is applied
 * The chosen theme is set as a `data-theme` attribute on the `<html>` element.
 * Global SCSS uses `[data-theme="dark"] { ... }` selectors so that all CSS Custom
 * Properties update without any JavaScript involvement in individual components.
 *
 * ## Usage in templates
 * ```html
 * <button (click)="themeService.toggle()">
 *   {{ themeService.theme() === 'dark' ? 'Light mode' : 'Dark mode' }}
 * </button>
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Injected via the DI token to keep the service SSR-compatible (no direct `document` reference). */
  private readonly doc = inject(DOCUMENT);

  /**
   * The currently active theme as a reactive Signal.
   * Read in templates or computed signals; never set directly from outside – use {@link toggle} instead.
   */
  readonly theme = signal<Theme>(this.resolveInitialTheme());

  constructor() {
    // Apply the resolved theme immediately so there is no flash of unstyled content
    // between Angular bootstrap and the first change-detection cycle.
    this.applyTheme(this.theme());
  }

  /**
   * Switches between light and dark mode and persists the new preference.
   *
   * `localStorage` writes are wrapped in try/catch because storage access can
   * be blocked in private-browsing mode or sandboxed iframes.
   */
  toggle(): void {
    this.theme.update((current) => (current === 'light' ? 'dark' : 'light'));
    this.applyTheme(this.theme());
    try {
      localStorage.setItem(STORAGE_KEY, this.theme());
    } catch {
      // localStorage may not be available in certain contexts (e.g. private mode)
    }
  }

  /**
   * Writes the `data-theme` attribute to `<html>` so that CSS selectors pick it up.
   *
   * @param theme - The theme to activate.
   */
  private applyTheme(theme: Theme): void {
    this.doc.documentElement.dataset['theme'] = theme;
  }

  /**
   * Determines the initial theme using the resolution order described in the class TSDoc.
   *
   * All reads are wrapped individually so that a failure in one step
   * (e.g. `localStorage` blocked) does not prevent the fallback from running.
   *
   * @returns The resolved {@link Theme} value.
   */
  private resolveInitialTheme(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // localStorage blocked – proceed to media-query check
    }
    try {
      return globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
    } catch {
      // matchMedia not available (e.g. SSR or unsupported browser)
      return 'light';
    }
  }
}
