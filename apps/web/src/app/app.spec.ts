import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { NvmApiService } from './services/nvm-api.service';
import { of, throwError } from 'rxjs';
import type { InstalledVersionsResponse } from './models/nvm.models';

function mockNvmApiService(overrides: Partial<InstanceType<typeof NvmApiService>> = {}) {
  const defaultInstalledResponse: InstalledVersionsResponse = {
    stdout: '',
    stderr: '',
    versions: [
      { version: '22.11.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
    ],
  };
  return {
    getInstalledVersions: vi.fn().mockReturnValue(of(defaultInstalledResponse)),
    getStatus: vi.fn().mockReturnValue(of({ ok: true, nvmVersion: '0.39.7' })),
    installVersion: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    useVersion: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    setDefaultVersion: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    uninstallVersion: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    getAliases: vi.fn().mockReturnValue(of({ stdout: '', stderr: '', aliases: [] })),
    setAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    deleteAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    getRemoteVersions: vi.fn().mockReturnValue(of({ stdout: '', stderr: '', versions: [] })),
    ...overrides,
  };
}

describe('App', () => {
  it('erstellt die Komponente', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('lädt installierte Versionen beim Start', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(mockSvc.getInstalledVersions).toHaveBeenCalledOnce();
  });

  it('setzt installedVersions nach erfolgreichem Laden', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.installedVersions()).toHaveLength(1);
    expect(fixture.componentInstance.installedVersions()[0].version).toBe('22.11.0');
  });

  it('berechnet activeVersion korrekt', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.activeVersion()?.version).toBe('22.11.0');
  });

  it('schreibt Fehlermeldung ins Log wenn Laden fehlschlägt', async () => {
    const mockSvc = mockNvmApiService({
      getInstalledVersions: vi.fn().mockReturnValue(throwError(() => new Error('Netzwerkfehler'))),
    });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const log = fixture.componentInstance.log();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].type).toBe('error');
  });

  it('schließt das Install-Modal', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const comp = fixture.componentInstance;
    comp.installModal.set({ action: 'install', phase: 'running', version: '22' });

    comp.closeInstallModal();

    expect(comp.installModal()).toBeNull();
  });

  it('fügt Log-Einträge über onLogged hinzu', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const comp = fixture.componentInstance;
    comp.onLogged({ message: 'Test-Event', type: 'info' });

    const log = comp.log();
    expect(log.some((e) => e.message === 'Test-Event')).toBe(true);
  });

  it('begrenzt den Log auf 20 Einträge', async () => {
    const mockSvc = mockNvmApiService();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const comp = fixture.componentInstance;
    for (let i = 0; i < 25; i++) {
      comp.onLogged({ message: `Eintrag ${i}`, type: 'info' });
    }

    expect(comp.log().length).toBeLessThanOrEqual(20);
  });
});
