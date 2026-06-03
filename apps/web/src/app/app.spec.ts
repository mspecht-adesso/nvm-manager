import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { App } from './app';
import { NvmStateService } from './services/nvm-state.service';
import type { InstalledNodeVersion, InstallModalState, LogEntry } from './models/nvm.models';

function makeStateMock() {
  const installedVersions = signal<InstalledNodeVersion[]>([]);
  return {
    log: signal<LogEntry[]>([]),
    isLoading: signal(false),
    installedVersions,
    installedRaw: signal(''),
    installedLoading: signal(false),
    installModal: signal<InstallModalState>(null),
    prefillVersion: signal(''),
    aliasesRefreshTrigger: signal(0),
    activeVersion: computed(() => installedVersions().find((v) => v.active)),
    loadInstalledVersions: vi.fn(),
    onInstall: vi.fn(),
    onUseFromList: vi.fn(),
    onUse: vi.fn(),
    onSetDefault: vi.fn(),
    onUninstall: vi.fn(),
    onNvmUpdate: vi.fn(),
    closeInstallModal: vi.fn(),
    onLogged: vi.fn(),
  };
}

describe('App', () => {
  async function setup(stateMock = makeStateMock()) {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: NvmStateService, useValue: stateMock }],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    return { fixture, comp: fixture.componentInstance, stateMock };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('ruft loadInstalledVersions beim Start auf', async () => {
    const { fixture, stateMock } = await setup();
    fixture.detectChanges();
    expect(stateMock.loadInstalledVersions).toHaveBeenCalledOnce();
  });

  it('stellt den NvmStateService bereit', async () => {
    const { comp } = await setup();
    expect(comp['state']).toBeDefined();
  });

  it('rendert die Hauptstruktur ohne Fehler', async () => {
    const { fixture } = await setup();
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
