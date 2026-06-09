import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ThemeService, type Theme } from './theme.service';

/**
 * Creates a minimal `Document` stub exposing only `documentElement.dataset`,
 * which is all the service touches when applying the `data-theme` attribute.
 */
function makeDoc() {
  const dataset: Record<string, string> = {};
  return {
    documentElement: {
      dataset,
    },
  } as unknown as Document;
}

/**
 * Unit tests for {@link ThemeService}.
 *
 * The browser APIs the service relies on are stubbed per test:
 * - `localStorage` is backed by an in-memory record via `Storage.prototype` spies.
 * - `matchMedia` is defined manually (jsdom lacks it) and its dark-mode result
 *   is controlled through {@link matchMediaResult}.
 *
 * This lets the suite drive the full theme-resolution order and toggle/persist logic.
 */
describe('ThemeService', () => {
  /** In-memory backing store standing in for `localStorage`. */
  let localStorageMock: Record<string, string>;
  /** Controls what `matchMedia('(prefers-color-scheme: dark)')` reports. */
  let matchMediaResult: boolean;

  beforeEach(() => {
    localStorageMock = {};
    matchMediaResult = false;

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => { localStorageMock[key] = value; },
    );

    // matchMedia is not defined in jsdom by default, so define a controllable stub.
    Object.defineProperty(globalThis, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' && matchMediaResult,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Instantiates the service with a stubbed DOCUMENT. The service resolves its
   * initial theme in the constructor, so the localStorage/matchMedia stubs must
   * be configured before calling this.
   *
   * @param docOverride - Optional custom Document stub.
   */
  function setup(docOverride?: Partial<Document>) {
    const doc = makeDoc();
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: DOCUMENT, useValue: docOverride ?? doc },
      ],
    });
    return { service: TestBed.inject(ThemeService), doc };
  }

  describe('initialisierung', () => {
    it('verwendet gespeichertes Theme aus localStorage', () => {
      localStorageMock['nvm-manager-theme'] = 'dark';
      const { service } = setup();
      expect(service.theme()).toBe('dark');
    });

    it('erkennt System-Präferenz "dunkel" wenn kein localStorage-Wert vorhanden', () => {
      matchMediaResult = true;
      const { service } = setup();
      expect(service.theme()).toBe('dark');
    });

    it('fällt auf "light" zurück wenn keine Präferenz gespeichert und System hell', () => {
      matchMediaResult = false;
      const { service } = setup();
      expect(service.theme()).toBe('light');
    });

    it('ignoriert ungültige localStorage-Werte', () => {
      localStorageMock['nvm-manager-theme'] = 'invalid';
      matchMediaResult = false;
      const { service } = setup();
      expect(service.theme()).toBe('light');
    });

    it('setzt data-theme auf dem HTML-Element bei der Initialisierung', () => {
      localStorageMock['nvm-manager-theme'] = 'dark';
      const { doc } = setup();
      expect(doc.documentElement.dataset['theme']).toBe('dark');
    });
  });

  describe('toggle()', () => {
    it('wechselt von "light" zu "dark"', () => {
      const { service } = setup();
      expect(service.theme()).toBe('light');
      service.toggle();
      expect(service.theme()).toBe('dark');
    });

    it('wechselt von "dark" zu "light"', () => {
      localStorageMock['nvm-manager-theme'] = 'dark';
      const { service } = setup();
      service.toggle();
      expect(service.theme()).toBe('light');
    });

    it('persistiert das neue Theme in localStorage', () => {
      const { service } = setup();
      service.toggle();
      expect(localStorageMock['nvm-manager-theme']).toBe('dark');
    });

    it('persistiert "light" nach zweimaligem Toggle', () => {
      const { service } = setup();
      service.toggle();
      service.toggle();
      expect(localStorageMock['nvm-manager-theme']).toBe('light');
    });

    it('aktualisiert data-theme auf dem HTML-Element nach Toggle', () => {
      const { service, doc } = setup();
      service.toggle();
      expect(doc.documentElement.dataset['theme']).toBe('dark');
    });
  });

  describe('theme()-Signal', () => {
    it('ist ein gültiges Theme', () => {
      const { service } = setup();
      const validThemes: Theme[] = ['light', 'dark'];
      expect(validThemes).toContain(service.theme());
    });
  });
});
