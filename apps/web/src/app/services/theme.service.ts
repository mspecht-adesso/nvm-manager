import { Injectable, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nvm-manager-theme';

/**
 * Manages the UI theme (light/dark) of the application.
 *
 * On first load the system preference is detected via `prefers-color-scheme`;
 * subsequent choices are persisted in `localStorage`.
 * The active theme is applied as a `data-theme` attribute on `<html>`,
 * so CSS Custom Properties in `:root` / `[data-theme="dark"]` take effect.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.resolveInitialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  toggle(): void {
    this.theme.update((current) => (current === 'light' ? 'dark' : 'light'));
    this.applyTheme(this.theme());
    try {
      localStorage.setItem(STORAGE_KEY, this.theme());
    } catch {
      // localStorage may not be available in certain contexts
    }
  }

  private applyTheme(theme: Theme): void {
    this.doc.documentElement.dataset['theme'] = theme;
  }

  private resolveInitialTheme(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
    try {
      return globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
