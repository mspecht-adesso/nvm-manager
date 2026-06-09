import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { NvmStateService } from './nvm-state.service';
import { NvmApiService } from './nvm-api.service';
import { httpErrorInterceptor } from '../core/http-error.interceptor';
import type { InstalledVersionsResponse } from '../models/nvm.models';

/** Canned installed-versions response with one active/default version and one inactive. */
const INSTALLED_VERSION_RESPONSE: InstalledVersionsResponse = {
  stdout: '-> v22.11.0 (default)',
  stderr: '',
  versions: [
    { version: '22.11.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
    { version: '20.5.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
  ],
};

/**
 * Builds a mock {@link NvmApiService} whose *mutation* methods return synchronous,
 * successful observables (`of(...)`) by default. The installed-versions list is
 * fetched via `httpResource`, so it is flushed with {@link HttpTestingController}
 * rather than mocked here.
 *
 * Note: because the mocks resolve synchronously, an action like `onInstall`
 * progresses through `running → success` within a single tick, so assertions
 * made right after the call already observe the `success` phase.
 *
 * @param overrides - Per-method replacements (e.g. a `throwError` observable).
 */
function makeApiMock(overrides: Partial<Record<keyof NvmApiService, unknown>> = {}) {
  return {
    installVersion: vi.fn().mockReturnValue(of({ stdout: 'installed', stderr: '' })),
    useVersion: vi.fn().mockReturnValue(of({ stdout: 'now using', stderr: '' })),
    setDefaultVersion: vi.fn().mockReturnValue(of({ stdout: 'default set', stderr: '' })),
    uninstallVersion: vi.fn().mockReturnValue(of({ stdout: 'uninstalled', stderr: '' })),
    updateNvm: vi.fn().mockReturnValue(of({ stdout: 'nvm upgraded', stderr: '' })),
    ...overrides,
  };
}

/**
 * Unit tests for {@link NvmStateService}, the central state facade.
 *
 * Covers the initial state, the auto-loading installed-versions `httpResource`
 * (incl. error logging), every `on*` action handler (modal lifecycle, logging,
 * refresh triggers), modal control, and the activity log's ordering and
 * 20-entry cap. Mutations use a mocked {@link NvmApiService}; the GET resource is
 * flushed via {@link HttpTestingController}.
 */
describe('NvmStateService', () => {
  let service: NvmStateService;
  let apiMock: ReturnType<typeof makeApiMock>;
  let httpMock: HttpTestingController;
  let appRef: ApplicationRef;

  /**
   * Configures the testing module with a fresh API mock and injects the service.
   * @param overrides - Per-method API mock overrides (e.g. to force errors).
   */
  function setup(overrides: Partial<Record<keyof NvmApiService, unknown>> = {}) {
    apiMock = makeApiMock(overrides);
    TestBed.configureTestingModule({
      providers: [
        NvmStateService,
        { provide: NvmApiService, useValue: apiMock },
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(NvmStateService);
    httpMock = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
  }

  /**
   * Lets the auto-loading `httpResource` issue its request, flushes it, then
   * awaits stability so the result propagates into computed signals / effects.
   * `httpResource` applies its value on a microtask, so callers must `await` this.
   */
  async function flushInstalled(
    response: InstalledVersionsResponse = INSTALLED_VERSION_RESPONSE,
    opts?: { error?: boolean },
  ): Promise<void> {
    appRef.tick();
    const req = httpMock.expectOne('/api/versions/installed');
    if (opts?.error) {
      req.flush({ error: 'Netzwerkfehler' }, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(response);
    }
    await appRef.whenStable();
  }

  // Drain any installed-versions requests triggered by reloads so each test
  // ends with no outstanding HTTP expectations.
  afterEach(() => {
    httpMock.match(() => true).forEach((req) => {
      if (!req.cancelled) req.flush(INSTALLED_VERSION_RESPONSE);
    });
    httpMock.verify();
  });

  describe('Initialzustand', () => {
    it('log ist leer', () => {
      setup();
      expect(service.log()).toEqual([]);
    });

    it('isLoading ist false', () => {
      setup();
      expect(service.isLoading()).toBe(false);
    });

    it('installedVersions ist leer', () => {
      setup();
      expect(service.installedVersions()).toEqual([]);
    });

    it('installModal ist null', () => {
      setup();
      expect(service.installModal()).toBeNull();
    });

    it('activeVersion ist undefined wenn keine Versionen geladen', () => {
      setup();
      expect(service.activeVersion()).toBeUndefined();
    });
  });

  describe('loadInstalledVersions (httpResource)', () => {
    it('setzt installedVersions nach erfolgreichem Laden', async () => {
      setup();
      await flushInstalled();
      expect(service.installedVersions()).toHaveLength(2);
      expect(service.installedVersions()[0].version).toBe('22.11.0');
    });

    it('setzt installedRaw nach erfolgreichem Laden', async () => {
      setup();
      await flushInstalled();
      expect(service.installedRaw()).toBe('-> v22.11.0 (default)');
    });

    it('berechnet activeVersion nach dem Laden', async () => {
      setup();
      await flushInstalled();
      expect(service.activeVersion()?.version).toBe('22.11.0');
    });

    it('installedLoading ist false nach abgeschlossenem Laden', async () => {
      setup();
      await flushInstalled();
      expect(service.installedLoading()).toBe(false);
    });

    it('reload() löst einen erneuten Abruf aus', async () => {
      setup();
      await flushInstalled();

      service.loadInstalledVersions();
      appRef.tick();
      const req = httpMock.expectOne('/api/versions/installed');
      expect(req.request.method).toBe('GET');
      req.flush(INSTALLED_VERSION_RESPONSE);
    });

    it('schreibt Fehler ins Log wenn das Laden fehlschlägt', async () => {
      setup();
      await flushInstalled(undefined, { error: true });
      expect(service.log().length).toBeGreaterThan(0);
      expect(service.log()[0].type).toBe('error');
    });

    it('installedLoading ist false nach Fehler', async () => {
      setup();
      await flushInstalled(undefined, { error: true });
      expect(service.installedLoading()).toBe(false);
    });
  });

  describe('onInstall', () => {
    it('öffnet Modal mit action=install und phase=running', () => {
      setup();
      service.onInstall('22.11.0');
      // The mocked install resolves synchronously, so the modal has already
      // advanced from 'running' to 'success' by the time we assert here.
      expect(service.installModal()).toMatchObject({ action: 'install', phase: 'success', version: '22.11.0' });
    });

    it('setzt Modal auf success nach erfolgreicher Installation', () => {
      setup();
      service.onInstall('22.11.0');
      expect(service.installModal()).toMatchObject({ action: 'install', phase: 'success' });
    });

    it('setzt Modal auf error und schreibt Log bei Fehler', () => {
      setup({ installVersion: vi.fn().mockReturnValue(throwError(() => new Error('install failed'))) });
      service.onInstall('22.11.0');
      expect(service.installModal()).toMatchObject({ action: 'install', phase: 'error' });
      expect(service.log().some((e) => e.type === 'error')).toBe(true);
    });

    it('isLoading ist false nach erfolgter Installation', () => {
      setup();
      service.onInstall('22.11.0');
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('onUse', () => {
    it('aktiviert eine Version und loggt Erfolg', () => {
      setup();
      service.onUse('20.5.0');
      expect(apiMock.useVersion).toHaveBeenCalledWith('20.5.0');
      expect(service.log().some((e) => e.type === 'success')).toBe(true);
    });

    it('schreibt Fehler ins Log bei API-Fehler', () => {
      setup({ useVersion: vi.fn().mockReturnValue(throwError(() => new Error('use failed'))) });
      service.onUse('20.5.0');
      expect(service.log().some((e) => e.type === 'error')).toBe(true);
    });
  });

  describe('onUseFromList', () => {
    it('setzt prefillVersion auf die gewählte Version', () => {
      setup();
      service.onUseFromList('20.5.0');
      expect(service.prefillVersion()).toBe('20.5.0');
    });

    it('öffnet Modal mit action=use', () => {
      setup();
      service.onUseFromList('20.5.0');
      expect(service.installModal()).toMatchObject({ action: 'use', phase: 'success' });
    });

    it('erhöht aliasesRefreshTrigger nach erfolgreichem Use', () => {
      setup();
      const before = service.aliasesRefreshTrigger();
      service.onUseFromList('20.5.0');
      expect(service.aliasesRefreshTrigger()).toBe(before + 1);
    });
  });

  describe('onSetDefault', () => {
    it('setzt Default-Version und loggt Erfolg', () => {
      setup();
      service.onSetDefault('22.11.0');
      expect(apiMock.setDefaultVersion).toHaveBeenCalledWith('22.11.0');
      expect(service.log().some((e) => e.type === 'success')).toBe(true);
    });

    it('erhöht aliasesRefreshTrigger nach Erfolg', () => {
      setup();
      const before = service.aliasesRefreshTrigger();
      service.onSetDefault('22.11.0');
      expect(service.aliasesRefreshTrigger()).toBe(before + 1);
    });
  });

  describe('onUninstall', () => {
    it('öffnet Modal mit action=uninstall', () => {
      setup();
      service.onUninstall('20.5.0');
      expect(service.installModal()).toMatchObject({ action: 'uninstall', phase: 'success' });
    });

    it('setzt Modal auf error bei API-Fehler', () => {
      setup({ uninstallVersion: vi.fn().mockReturnValue(throwError(() => new Error('uninstall failed'))) });
      service.onUninstall('20.5.0');
      expect(service.installModal()).toMatchObject({ action: 'uninstall', phase: 'error' });
    });
  });

  describe('onNvmUpdate', () => {
    it('öffnet Modal mit action=nvm-update und phase=running, dann success', () => {
      setup();
      service.onNvmUpdate('0.40.4');
      expect(service.installModal()).toMatchObject({ action: 'nvm-update', phase: 'success', version: '0.40.4' });
    });

    it('setzt Modal auf error bei fehlgeschlagenem Update', () => {
      setup({ updateNvm: vi.fn().mockReturnValue(throwError(() => new Error('upgrade failed'))) });
      service.onNvmUpdate('0.40.4');
      expect(service.installModal()).toMatchObject({ action: 'nvm-update', phase: 'error' });
      expect(service.log().some((e) => e.type === 'error')).toBe(true);
    });

    it('isLoading ist false nach Abschluss', () => {
      setup();
      service.onNvmUpdate('0.40.4');
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('closeInstallModal', () => {
    it('setzt installModal auf null', () => {
      setup();
      service.installModal.set({ action: 'install', phase: 'running', version: '22' });
      service.closeInstallModal();
      expect(service.installModal()).toBeNull();
    });
  });

  describe('onLogged', () => {
    it('fügt einen Log-Eintrag hinzu', () => {
      setup();
      service.onLogged({ message: 'Test-Nachricht', type: 'info' });
      expect(service.log().some((e) => e.message === 'Test-Nachricht')).toBe(true);
    });

    it('Log-Einträge haben einen Timestamp', () => {
      setup();
      service.onLogged({ message: 'mit Timestamp', type: 'success' });
      const entry = service.log().find((e) => e.message === 'mit Timestamp');
      expect(entry?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Log-Begrenzung', () => {
    it('begrenzt den Log auf maximal 20 Einträge', () => {
      setup();
      for (let i = 0; i < 25; i++) {
        service.onLogged({ message: `Eintrag ${i}`, type: 'info' });
      }
      expect(service.log().length).toBeLessThanOrEqual(20);
    });

    it('enthält immer die neuesten Einträge zuerst', () => {
      setup();
      service.onLogged({ message: 'erster', type: 'info' });
      service.onLogged({ message: 'zweiter', type: 'info' });
      expect(service.log()[0].message).toBe('zweiter');
    });
  });

  describe('activeVersion (computed)', () => {
    it('gibt undefined zurück wenn keine aktive Version vorhanden', async () => {
      setup();
      await flushInstalled({
        stdout: '',
        stderr: '',
        versions: [
          { version: '20.5.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
        ],
      });
      expect(service.activeVersion()).toBeUndefined();
    });

    it('gibt die aktive Version zurück', async () => {
      setup();
      await flushInstalled();
      expect(service.activeVersion()?.version).toBe('22.11.0');
    });
  });
});
