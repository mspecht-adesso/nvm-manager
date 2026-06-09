import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RemoteVersionsCardComponent } from './remote-versions-card.component';
import { httpErrorInterceptor } from '../../../core/http-error.interceptor';
import type { InstalledNodeVersion, LogEvent } from '../../../models/nvm.models';

/**
 * 40 synthetic remote versions (spanning majors 22–25, alternating LTS/non-LTS)
 * used to exercise filtering and the 30/100 result caps.
 */
const REMOTE_VERSIONS = Array.from({ length: 40 }, (_, i) => ({
  version: `${22 + Math.floor(i / 10)}.${i % 10}.0`,
  lts: i % 2 === 0 ? 'Jod' : null,
}));

/** Single installed version, used to verify it is filtered out of the remote list. */
const INSTALLED: InstalledNodeVersion[] = [
  { version: '22.0.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
];

/**
 * Unit tests for {@link RemoteVersionsCardComponent}.
 *
 * The remote list is now fetched via `httpResource`, so requests are intercepted
 * and flushed with `HttpTestingController` rather than mocking a service method.
 * Verifies lazy loading via `load()` (first call loads, subsequent calls reload),
 * error forwarding to the `logged` output, and the `filteredVersions` /
 * `availableCount` computed logic.
 */
describe('RemoteVersionsCardComponent', () => {
  /** Compiles the component with the HTTP testing backend. */
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [RemoteVersionsCardComponent],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RemoteVersionsCardComponent);
    const httpMock = TestBed.inject(HttpTestingController);
    return { fixture, comp: fixture.componentInstance, httpMock };
  }

  /**
   * Runs change detection so the lazy resource issues its GET, then flushes a
   * single `/api/versions/remote` response (or an error). `httpResource` applies
   * the value on a microtask, so we await stability before propagating it.
   */
  async function flushRemote(
    fixture: ComponentFixture<RemoteVersionsCardComponent>,
    httpMock: HttpTestingController,
    versions: { version: string; lts: string | null }[] = REMOTE_VERSIONS,
    opts?: { error?: string },
  ): Promise<void> {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/versions/remote');
    if (opts?.error) {
      req.flush({ error: opts.error }, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush({ stdout: '', stderr: '', versions });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('hat eine leere Remote-Versionsliste als Default', async () => {
    const { comp } = await setup();
    expect(comp.remoteVersions()).toHaveLength(0);
  });

  it('isLoading ist standardmäßig false', async () => {
    const { comp } = await setup();
    expect(comp.isLoading()).toBe(false);
  });

  // ── load() ──────────────────────────────────────────────────────────────────

  it('lädt Remote-Versionen und setzt loading zurück', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);

    expect(comp.remoteVersions()).toHaveLength(40);
    expect(comp.loading()).toBe(false);
  });

  it('lädt bei wiederholtem load() erneut (reload)', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);
    expect(comp.remoteVersions()).toHaveLength(40);

    // A second load() reloads the resource, issuing a fresh request.
    comp.load();
    await flushRemote(fixture, httpMock);
    expect(comp.remoteVersions()).toHaveLength(40);
  });

  it('emittiert Fehler-Log wenn das Laden fehlschlägt', async () => {
    const { fixture, comp, httpMock } = await setup();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.load();
    await flushRemote(fixture, httpMock, [], { error: 'Timeout' });

    expect(logged[0].type).toBe('error');
    expect(logged[0].message).toContain('Timeout');
    expect(comp.loading()).toBe(false);
  });

  // ── filteredVersions (computed) ──────────────────────────────────────────────

  it('filtert installierte Versionen heraus', async () => {
    const { fixture, comp, httpMock } = await setup();
    fixture.componentRef.setInput('installedVersions', INSTALLED);
    comp.load();
    await flushRemote(fixture, httpMock);

    const versions = comp.filteredVersions();
    expect(versions.find((v) => v.version === '22.0.0')).toBeUndefined();
  });

  it('begrenzt ohne Suche auf 30 Einträge', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);

    expect(comp.filteredVersions().length).toBeLessThanOrEqual(30);
  });

  it('gibt bis zu 100 Treffer bei aktiver Suche zurück', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);

    comp.remoteSearch.set('2');
    expect(comp.filteredVersions().length).toBeGreaterThan(0);
    expect(comp.filteredVersions().length).toBeLessThanOrEqual(100);
  });

  it('filtert nach Versionsnummer', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);

    comp.remoteSearch.set('22');
    const result = comp.filteredVersions();
    expect(result.every((v) => v.version.includes('22'))).toBe(true);
  });

  it('zeigt bei alleinigem "v" alle verfügbaren Versionen', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);

    comp.remoteSearch.set('v');
    const result = comp.filteredVersions();
    expect(result.length).toBe(REMOTE_VERSIONS.length);
    expect(result.length).toBeGreaterThan(30);
  });

  it('filtert mit "v19" nur Versionen, die mit "19." beginnen', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock, [
      { version: '19.0.0', lts: null },
      { version: '19.9.0', lts: null },
      { version: '1.19.0', lts: null },
      { version: '20.0.0', lts: null },
    ]);

    comp.remoteSearch.set('v19');
    const result = comp.filteredVersions();
    expect(result.map((v) => v.version)).toEqual(['19.0.0', '19.9.0']);
  });

  it('filtert nach LTS-Codename', async () => {
    const { fixture, comp, httpMock } = await setup();
    comp.load();
    await flushRemote(fixture, httpMock);

    comp.remoteSearch.set('jod');
    const result = comp.filteredVersions();
    expect(result.every((v) => v.lts?.toLowerCase().includes('jod'))).toBe(true);
  });

  // ── availableCount (computed) ────────────────────────────────────────────────

  it('berechnet die Anzahl nicht installierter Versionen', async () => {
    const { fixture, comp, httpMock } = await setup();
    fixture.componentRef.setInput('installedVersions', INSTALLED);
    comp.load();
    await flushRemote(fixture, httpMock);

    expect(comp.availableCount()).toBe(39);
  });

  it('availableCount ist 0 ohne geladene Versionen', async () => {
    const { comp } = await setup();
    expect(comp.availableCount()).toBe(0);
  });

  // ── install output ───────────────────────────────────────────────────────────

  it('stellt install als Output bereit', async () => {
    const { comp } = await setup();
    expect(comp.install).toBeDefined();
  });
});
