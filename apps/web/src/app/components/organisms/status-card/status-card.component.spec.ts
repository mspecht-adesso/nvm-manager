import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StatusCardComponent } from './status-card.component';
import { NvmApiService } from '../../../services/nvm-api.service';
import { httpErrorInterceptor } from '../../../core/http-error.interceptor';
import { of, throwError } from 'rxjs';
import type { NvmStatus } from '../../../models/nvm.models';

/** A healthy default status payload flushed for the `/api/status` request. */
const HEALTHY_STATUS: NvmStatus = { ok: true, nvmVersion: '0.39.7', nvmDir: '/home/.nvm' };

/**
 * Unit tests for {@link StatusCardComponent}.
 *
 * The nvm status is now fetched via `httpResource`, so it is flushed with
 * {@link HttpTestingController}; only the imperative `openNvmDir` endpoint is
 * mocked through {@link NvmApiService}. Covers the status load lifecycle
 * (loading → value / error), the `updateAvailable` comparison logic, the
 * `nvmUpdate` emission (with `'latest'` fallback), and the `openDir` flow.
 */
describe('StatusCardComponent', () => {
  let httpMock: HttpTestingController;

  /** Builds a mock {@link NvmApiService} with a successful `openNvmDir` by default. */
  function buildSvc(overrides: Partial<InstanceType<typeof NvmApiService>> = {}) {
    return {
      openNvmDir: vi.fn().mockReturnValue(of({ ok: true })),
      ...overrides,
    };
  }

  /**
   * Compiles the component with the HTTP testing backend and a mocked API service.
   * @param svcOverrides - Optional per-method API mock overrides.
   */
  async function setup(svcOverrides?: Partial<InstanceType<typeof NvmApiService>>) {
    const mockSvc = buildSvc(svcOverrides);
    await TestBed.configureTestingModule({
      imports: [StatusCardComponent],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StatusCardComponent);
    httpMock = TestBed.inject(HttpTestingController);
    return { fixture, comp: fixture.componentInstance, mockSvc };
  }

  /**
   * Runs change detection so the resource issues its GET, then flushes a single
   * `/api/status` response (or an error). `httpResource` applies the value on a
   * microtask, so we await stability before propagating it to the template.
   */
  async function flushStatus(
    fixture: ComponentFixture<StatusCardComponent>,
    status: NvmStatus = HEALTHY_STATUS,
    opts?: { error?: string },
  ): Promise<void> {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/status');
    if (opts?.error) {
      req.flush({ error: opts.error }, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(status);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Drain any outstanding status requests (e.g. the unflushed loading-state test).
  afterEach(() => {
    httpMock.match(() => true).forEach((req) => {
      if (!req.cancelled) req.flush(HEALTHY_STATUS);
    });
    httpMock.verify();
  });

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('lädt den Status beim Initialisieren (GET /api/status)', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/status');
    expect(req.request.method).toBe('GET');
    req.flush(HEALTHY_STATUS);
  });

  it('setzt status nach erfolgreichem Laden', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture);

    expect(comp.status()?.ok).toBe(true);
    expect(comp.status()?.nvmVersion).toBe('0.39.7');
  });

  it('setzt loading auf false nach dem Laden', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture);

    expect(comp.loading()).toBe(false);
  });

  it('setzt statusError bei Fehler', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture, HEALTHY_STATUS, { error: 'Verbindungsfehler' });

    expect(comp.status()).toBeUndefined();
    expect(comp.statusError()).toBe('Verbindungsfehler');
    expect(comp.loading()).toBe(false);
  });

  it('startet im Ladezustand', async () => {
    const { fixture, comp } = await setup();
    // Issue the request but leave it pending so loading=true is observable.
    fixture.detectChanges();
    expect(comp.loading()).toBe(true);
  });

  it('updateAvailable ist false wenn nvmLatestVersion fehlt', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture);

    expect(comp.updateAvailable()).toBe(false);
  });

  it('updateAvailable ist false wenn Version identisch', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture, {
      ok: true,
      nvmVersion: '0.40.4',
      nvmLatestVersion: '0.40.4',
      nvmDir: '/home/.nvm',
    });

    expect(comp.updateAvailable()).toBe(false);
  });

  it('updateAvailable ist true wenn neuere Version verfügbar', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture, {
      ok: true,
      nvmVersion: '0.39.3',
      nvmLatestVersion: '0.40.4',
      nvmDir: '/home/.nvm',
    });

    expect(comp.updateAvailable()).toBe(true);
  });

  it('emittiert nvmUpdate-Event mit Zielversion beim Klick', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture, {
      ok: true,
      nvmVersion: '0.39.3',
      nvmLatestVersion: '0.40.4',
      nvmDir: '/home/.nvm',
    });

    let emittedVersion: string | undefined;
    comp.nvmUpdate.subscribe((v: string) => (emittedVersion = v));
    comp.onNvmUpdate();

    expect(emittedVersion).toBe('0.40.4');
  });

  it('emittiert "latest" als Fallback wenn nvmLatestVersion nicht gesetzt', async () => {
    const { fixture, comp } = await setup();
    await flushStatus(fixture);

    let emittedVersion: string | undefined;
    comp.nvmUpdate.subscribe((v: string) => (emittedVersion = v));
    comp.onNvmUpdate();

    expect(emittedVersion).toBe('latest');
  });

  describe('openDir()', () => {
    it('ruft openNvmDir auf und setzt openingDir zurück auf false', async () => {
      const { fixture, comp, mockSvc } = await setup();
      await flushStatus(fixture);

      comp.openDir();

      expect(mockSvc.openNvmDir).toHaveBeenCalledOnce();
      expect(comp.openingDir()).toBe(false);
      expect(comp.openDirError()).toBeNull();
    });

    it('setzt openDirError bei Fehler', async () => {
      const { fixture, comp } = await setup({
        openNvmDir: vi.fn().mockReturnValue(throwError(() => new Error('open fehlgeschlagen'))),
      });
      await flushStatus(fixture);

      comp.openDir();

      expect(comp.openingDir()).toBe(false);
      expect(comp.openDirError()).toBe('open fehlgeschlagen');
    });
  });
});
