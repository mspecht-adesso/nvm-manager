import { TestBed } from '@angular/core/testing';
import { AppHeaderComponent } from './app-header.component';
import { ThemeService } from '../../../services/theme.service';
import type { InstalledNodeVersion } from '../../../models/nvm.models';
import { signal } from '@angular/core';

/** Sample active version used to assert the header's version badge. */
const ACTIVE_VERSION: InstalledNodeVersion = {
  version: '22.11.0',
  active: true,
  default: true,
  system: false,
  stable: false,
  unstable: false,
  iojs: false,
};

/**
 * Builds a lightweight ThemeService stand-in backed by a real Signal, so tests
 * can both observe the current theme and verify that `toggle()` was called.
 * The mocked `toggle` flips the signal to mirror the real service's behaviour.
 *
 * @param initialTheme - Theme the mock should start in.
 */
function makeThemeServiceMock(initialTheme: 'light' | 'dark' = 'light') {
  const themeSignal = signal<'light' | 'dark'>(initialTheme);
  return {
    theme: themeSignal,
    toggle: vi.fn(() => {
      themeSignal.update((t) => (t === 'light' ? 'dark' : 'light'));
    }),
  };
}

/**
 * Unit tests for {@link AppHeaderComponent}.
 *
 * Covers the app title, the conditional active-version badge, and the
 * theme-toggle button (icon, aria-label, and delegation to ThemeService.toggle).
 */
describe('AppHeaderComponent', () => {
  /**
   * Compiles the component with a mocked ThemeService.
   *
   * @param themeOverride - Initial theme for the mocked service.
   */
  async function setup(themeOverride: 'light' | 'dark' = 'light') {
    const themeServiceMock = makeThemeServiceMock(themeOverride);

    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppHeaderComponent);
    return { fixture, comp: fixture.componentInstance, themeServiceMock };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('zeigt den App-Titel "nvm Manager" an', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('nvm Manager');
  });

  it('zeigt kein Versions-Badge wenn keine aktive Version vorhanden', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('activeVersion', undefined);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.header__active-badge')).toBeNull();
  });

  it('zeigt das Versions-Badge wenn eine aktive Version übergeben wird', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('activeVersion', ACTIVE_VERSION);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const badge = el.querySelector('.header__active-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('22.11.0');
  });

  it('activeVersion ist standardmäßig undefined', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeVersion()).toBeUndefined();
  });

  describe('Theme-Toggle', () => {
    it('zeigt den Toggle-Button an', async () => {
      const { fixture } = await setup();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.header__theme-toggle')).toBeTruthy();
    });

    it('zeigt Mond-Symbol im hellen Modus', async () => {
      const { fixture } = await setup('light');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const icon = el.querySelector('.header__theme-icon');
      expect(icon?.textContent?.trim()).toBe('☾');
    });

    it('zeigt Sonnen-Symbol im dunklen Modus', async () => {
      const { fixture } = await setup('dark');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const icon = el.querySelector('.header__theme-icon');
      expect(icon?.textContent?.trim()).toBe('☀');
    });

    it('ruft themeService.toggle() bei Klick auf den Button auf', async () => {
      const { fixture, themeServiceMock } = await setup();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const btn = el.querySelector<HTMLButtonElement>('.header__theme-toggle');
      btn?.click();

      expect(themeServiceMock.toggle).toHaveBeenCalledOnce();
    });

    it('zeigt aria-label "Zum dunklen Modus wechseln" im hellen Modus', async () => {
      const { fixture } = await setup('light');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const btn = el.querySelector('.header__theme-toggle');
      expect(btn?.getAttribute('aria-label')).toBe('Zum dunklen Modus wechseln');
    });

    it('zeigt aria-label "Zum hellen Modus wechseln" im dunklen Modus', async () => {
      const { fixture } = await setup('dark');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const btn = el.querySelector('.header__theme-toggle');
      expect(btn?.getAttribute('aria-label')).toBe('Zum hellen Modus wechseln');
    });

    it('aktualisiert das Icon nach Toggle', async () => {
      const { fixture, themeServiceMock } = await setup('light');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const btn = el.querySelector<HTMLButtonElement>('.header__theme-toggle');
      btn?.click();
      fixture.detectChanges();

      const icon = el.querySelector('.header__theme-icon');
      expect(icon?.textContent?.trim()).toBe('☀');
      expect(themeServiceMock.theme()).toBe('dark');
    });
  });
});
