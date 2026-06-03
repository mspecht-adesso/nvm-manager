import { Injectable, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nvm-manager-theme';

/**
 * Verwaltet das UI-Theme (hell/dunkel) der Anwendung.
 *
 * Beim ersten Aufruf wird die System-Präferenz via `prefers-color-scheme`
 * erkannt; spätere Wahl wird in `localStorage` persistiert.
 * Das aktive Theme wird als `data-theme`-Attribut auf `<html>` gesetzt,
 * sodass CSS Custom Properties in `:root` / `[data-theme="dark"]` greifen.
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
      // localStorage kann in bestimmten Kontexten nicht verfügbar sein
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
