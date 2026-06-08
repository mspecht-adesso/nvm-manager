import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RemoteVersionsCardComponent } from './remote-versions-card.component';
import { NvmApiService } from '../../../services/nvm-api.service';
import { of, throwError } from 'rxjs';
import type { InstalledNodeVersion, LogEvent } from '../../../models/nvm.models';

const REMOTE_VERSIONS = Array.from({ length: 40 }, (_, i) => ({
  version: `${22 + Math.floor(i / 10)}.${i % 10}.0`,
  lts: i % 2 === 0 ? 'Jod' : null,
}));

const INSTALLED: InstalledNodeVersion[] = [
  { version: '22.0.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
];

function buildSvc(overrides: Partial<InstanceType<typeof NvmApiService>> = {}) {
  return {
    getRemoteVersions: vi.fn().mockReturnValue(
      of({ stdout: '', stderr: '', versions: REMOTE_VERSIONS }),
    ),
    ...overrides,
  };
}

describe('RemoteVersionsCardComponent', () => {
  async function setup(svcOverrides?: Partial<InstanceType<typeof NvmApiService>>) {
    const mockSvc = buildSvc(svcOverrides);
    await TestBed.configureTestingModule({
      imports: [RemoteVersionsCardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RemoteVersionsCardComponent);
    return { fixture, comp: fixture.componentInstance, mockSvc };
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
    const { fixture, comp } = await setup();
    comp.load();
    await fixture.whenStable();

    expect(comp.remoteVersions()).toHaveLength(40);
    expect(comp.loading()).toBe(false);
  });

  it('lädt bei wiederholtem load() erneut (reload)', async () => {
    const { fixture, comp, mockSvc } = await setup();
    comp.load();
    await fixture.whenStable();
    expect(comp.remoteVersions()).toHaveLength(40);
    expect(mockSvc.getRemoteVersions).toHaveBeenCalledTimes(1);

    comp.load();
    await fixture.whenStable();
    expect(mockSvc.getRemoteVersions).toHaveBeenCalledTimes(2);
  });

  it('emittiert Fehler-Log wenn getRemoteVersions fehlschlägt', async () => {
    const { fixture, comp } = await setup({
      getRemoteVersions: vi.fn().mockReturnValue(throwError(() => new Error('Timeout'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.load();
    await fixture.whenStable();

    expect(logged[0].type).toBe('error');
    expect(logged[0].message).toContain('Timeout');
    expect(comp.loading()).toBe(false);
  });

  // ── filteredVersions (computed) ──────────────────────────────────────────────

  it('filtert installierte Versionen heraus', async () => {
    const { fixture, comp } = await setup();
    fixture.componentRef.setInput('installedVersions', INSTALLED);
    comp.load();
    await fixture.whenStable();

    const versions = comp.filteredVersions();
    expect(versions.find((v) => v.version === '22.0.0')).toBeUndefined();
  });

  it('begrenzt ohne Suche auf 30 Einträge', async () => {
    const { fixture, comp } = await setup();
    comp.load();
    await fixture.whenStable();

    expect(comp.filteredVersions().length).toBeLessThanOrEqual(30);
  });

  it('gibt bis zu 100 Treffer bei aktiver Suche zurück', async () => {
    const { fixture, comp } = await setup();
    comp.load();
    await fixture.whenStable();

    comp.remoteSearch.set('2');
    expect(comp.filteredVersions().length).toBeGreaterThan(0);
    expect(comp.filteredVersions().length).toBeLessThanOrEqual(100);
  });

  it('filtert nach Versionsnummer', async () => {
    const { fixture, comp } = await setup();
    comp.load();
    await fixture.whenStable();

    comp.remoteSearch.set('22');
    const result = comp.filteredVersions();
    expect(result.every((v) => v.version.includes('22'))).toBe(true);
  });

  it('zeigt bei alleinigem "v" alle verfügbaren Versionen', async () => {
    const { fixture, comp } = await setup();
    comp.load();
    await fixture.whenStable();

    comp.remoteSearch.set('v');
    const result = comp.filteredVersions();
    expect(result.length).toBe(REMOTE_VERSIONS.length);
    expect(result.length).toBeGreaterThan(30);
  });

  it('filtert mit "v19" nur Versionen, die mit "19." beginnen', async () => {
    const { fixture, comp } = await setup({
      getRemoteVersions: vi.fn().mockReturnValue(
        of({
          stdout: '',
          stderr: '',
          versions: [
            { version: '19.0.0', lts: null },
            { version: '19.9.0', lts: null },
            { version: '1.19.0', lts: null },
            { version: '20.0.0', lts: null },
          ],
        }),
      ),
    });
    comp.load();
    await fixture.whenStable();

    comp.remoteSearch.set('v19');
    const result = comp.filteredVersions();
    expect(result.map((v) => v.version)).toEqual(['19.0.0', '19.9.0']);
  });

  it('filtert nach LTS-Codename', async () => {
    const { fixture, comp } = await setup();
    comp.load();
    await fixture.whenStable();

    comp.remoteSearch.set('jod');
    const result = comp.filteredVersions();
    expect(result.every((v) => v.lts?.toLowerCase().includes('jod'))).toBe(true);
  });

  // ── availableCount (computed) ────────────────────────────────────────────────

  it('berechnet die Anzahl nicht installierter Versionen', async () => {
    const { fixture, comp } = await setup();
    fixture.componentRef.setInput('installedVersions', INSTALLED);
    comp.load();
    await fixture.whenStable();

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
