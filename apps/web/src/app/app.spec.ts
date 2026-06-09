import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { App } from './app';
import { NvmStateService } from './services/nvm-state.service';
import type { InstalledNodeVersion, InstallModalState, LogEntry } from './models/nvm.models';

/**
 * Builds a full stand-in for {@link NvmStateService} exposing every signal and
 * action method the root template binds to. State is backed by real Signals so
 * the component can render, while action methods are `vi.fn()` spies so tests
 * can assert the App never calls them on its own.
 */
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

/**
 * Unit tests for the root {@link App} component.
 *
 * The App is a composition shell, so these tests confirm it instantiates,
 * renders without throwing, exposes the injected state, and notably does NOT
 * kick off a manual data load (the state service's rxResource loads on its own).
 */
describe('App', () => {
  /**
   * Compiles the root component with a mocked NvmStateService.
   *
   * @param stateMock - Optional pre-built state mock; a fresh one is created by default.
   */
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

  it('triggert keinen manuellen Initial-Load (rxResource lädt selbst)', async () => {
    const { fixture, stateMock } = await setup();
    fixture.detectChanges();
    // Die installierten Versionen werden im NvmStateService via rxResource
    // automatisch geladen – die App-Komponente stößt nichts manuell an.
    expect(stateMock.loadInstalledVersions).not.toHaveBeenCalled();
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
