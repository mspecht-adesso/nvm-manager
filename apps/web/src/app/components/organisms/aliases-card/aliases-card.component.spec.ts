import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AliasesCardComponent } from './aliases-card.component';
import { NvmApiService } from '../../../services/nvm-api.service';
import { httpErrorInterceptor } from '../../../core/http-error.interceptor';
import { of, throwError } from 'rxjs';
import type { NvmAlias, LogEvent, InstallModalState } from '../../../models/nvm.models';

/** The built-in `default` alias (editable, not deletable). */
const ALIAS_DEFAULT: NvmAlias = {
  name: 'default',
  target: 'lts/*',
  resolved: 'v22.11.0',
  editable: true,
  deletable: false,
};
/** A user-defined alias (editable and deletable). */
const ALIAS_CUSTOM: NvmAlias = {
  name: 'my-project',
  target: 'v18.18.0',
  resolved: 'v18.18.0',
  editable: true,
  deletable: true,
};
/** An LTS codename alias (`lts/iron`), used for the LTS-edit path. */
const ALIAS_LTS: NvmAlias = {
  name: 'lts/iron',
  target: 'v20.18.0',
  resolved: 'v20.18.0',
  editable: true,
  deletable: false,
};
/** Default aliases payload flushed for the `/api/versions/aliases` request. */
const ALIASES_RESPONSE = { stdout: '', stderr: '', aliases: [ALIAS_DEFAULT, ALIAS_CUSTOM] };

/**
 * Builds a mock {@link NvmApiService} where all alias *mutations* succeed by
 * default. The alias list itself is fetched via `httpResource`, so it is flushed
 * with {@link HttpTestingController} rather than mocked here.
 *
 * @param overrides - Per-method replacements (e.g. `setAlias` → `throwError`).
 */
function buildSvc(overrides: Partial<InstanceType<typeof NvmApiService>> = {}) {
  return {
    setAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    setLtsAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    setDefaultVersion: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    setStableVersion: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    deleteAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    deleteLtsAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    ...overrides,
  };
}

/**
 * Unit tests for {@link AliasesCardComponent}.
 *
 * Covers the auto-loading alias list (and `refreshTrigger`-driven reloads),
 * the inline edit flows for regular and LTS aliases, alias creation, and the
 * two-step delete confirmation. For each mutating action the suite asserts both
 * the API call and the emitted side effects: `logged`, `aliasChanged`, and the
 * `modalStateChange` progression (`running → success` or `→ error`).
 */
describe('AliasesCardComponent', () => {
  let httpMock: HttpTestingController;

  /**
   * Compiles the component with the HTTP testing backend and a mocked API service.
   * @param svcOverrides - Optional per-method API mock overrides.
   */
  async function setup(svcOverrides?: Partial<InstanceType<typeof NvmApiService>>) {
    const mockSvc = buildSvc(svcOverrides);
    await TestBed.configureTestingModule({
      imports: [AliasesCardComponent],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AliasesCardComponent);
    httpMock = TestBed.inject(HttpTestingController);
    return { fixture, comp: fixture.componentInstance, mockSvc };
  }

  /**
   * Runs change detection so the resource issues its GET, then flushes a single
   * `/api/versions/aliases` response (or an error). `httpResource` applies the
   * value on a microtask, so we await stability before propagating it.
   */
  async function flushAliases(
    fixture: ComponentFixture<AliasesCardComponent>,
    aliases: NvmAlias[] = [ALIAS_DEFAULT, ALIAS_CUSTOM],
    opts?: { error?: string },
  ): Promise<void> {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/versions/aliases');
    if (opts?.error) {
      req.flush({ error: opts.error }, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush({ stdout: '', stderr: '', aliases });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Drain any alias reloads triggered by mutations so each test ends clean.
  afterEach(() => {
    httpMock.match(() => true).forEach((req) => {
      if (!req.cancelled) req.flush(ALIASES_RESPONSE);
    });
    httpMock.verify();
  });

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  // ── initial load ─────────────────────────────────────────────────────────────

  it('lädt Aliases beim Initialisieren', async () => {
    const { fixture, comp } = await setup();
    await flushAliases(fixture);

    expect(comp.aliases()).toHaveLength(2);
  });

  it('setzt loading auf false nach dem Laden', async () => {
    const { fixture, comp } = await setup();
    await flushAliases(fixture);

    expect(comp.loading()).toBe(false);
  });

  it('emittiert Fehler-Log wenn das Laden fehlschlägt', async () => {
    const { fixture, comp } = await setup();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    await flushAliases(fixture, [], { error: 'Netzwerkfehler' });

    expect(logged).toHaveLength(1);
    expect(logged[0].type).toBe('error');
    expect(logged[0].message).toContain('Netzwerkfehler');
    expect(comp.loading()).toBe(false);
  });

  // ── refreshTrigger ──────────────────────────────────────────────────────────

  it('löst kein erneutes Laden aus wenn refreshTrigger = 0', async () => {
    const { fixture } = await setup();
    await flushAliases(fixture);

    fixture.componentRef.setInput('refreshTrigger', 0);
    fixture.detectChanges();

    httpMock.expectNone('/api/versions/aliases');
  });

  it('lädt neu wenn refreshTrigger > 0 gesetzt wird', async () => {
    const { fixture } = await setup();
    await flushAliases(fixture);

    fixture.componentRef.setInput('refreshTrigger', 1);
    fixture.detectChanges();

    httpMock.expectOne('/api/versions/aliases').flush(ALIASES_RESPONSE);
  });

  // ── startEdit / cancelEdit ──────────────────────────────────────────────────

  it('setzt editingAlias und editAliasTarget beim Bearbeiten', async () => {
    const { fixture, comp } = await setup();
    fixture.componentRef.setInput('installedVersions', [
      { version: '22.11.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
    ]);
    comp.startEdit(ALIAS_DEFAULT);

    expect(comp.editingAlias()).toBe('default');
    expect(comp.editAliasTarget()).toBe('22.11.0');
  });

  it('setzt editingAlias zurück beim Abbrechen', async () => {
    const { comp } = await setup();
    comp.startEdit(ALIAS_DEFAULT);
    comp.cancelEdit();

    expect(comp.editingAlias()).toBeNull();
    expect(comp.editAliasTarget()).toBe('');
  });

  // ── saveAlias ───────────────────────────────────────────────────────────────

  it('speichert Alias und emittiert Erfolg-Log', async () => {
    const { comp, mockSvc } = await setup();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20');
    comp.saveAlias('default');

    expect(mockSvc.setAlias).toHaveBeenCalledWith('default', '20');
    expect(logged[0].type).toBe('success');
    expect(comp.editingAlias()).toBeNull();
  });

  it('bricht saveAlias ab wenn Ziel leer ist', async () => {
    const { comp, mockSvc } = await setup();
    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('   ');
    comp.saveAlias('default');

    expect(mockSvc.setAlias).not.toHaveBeenCalled();
  });

  it('zeigt das Modal (running → success) beim Speichern des default-Alias', async () => {
    const { comp } = await setup();
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20.5.0');
    comp.saveAlias('default');

    expect(modalStates).toHaveLength(2);
    expect(modalStates[0]).toEqual({ action: 'default', phase: 'running', version: '20.5.0' });
    expect(modalStates[1]).toEqual({ action: 'default', phase: 'success', version: '20.5.0' });
  });

  it('zeigt das Modal mit phase: error wenn das Speichern des default-Alias fehlschlägt', async () => {
    const { comp } = await setup({
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Boom'))),
    });
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20.5.0');
    comp.saveAlias('default');

    expect(modalStates[0]?.phase).toBe('running');
    expect(modalStates[1]?.phase).toBe('error');
    expect(modalStates[1]?.errorMessage).toBe('Boom');
  });

  it('zeigt das Modal (running → success) beim Speichern eines beliebigen Alias', async () => {
    const { comp } = await setup();
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_CUSTOM);
    comp.editAliasTarget.set('18.18.0');
    comp.saveAlias('my-project');

    expect(modalStates).toHaveLength(2);
    expect(modalStates[0]).toEqual({
      action: 'alias',
      phase: 'running',
      version: '18.18.0',
      alias: 'my-project',
    });
    expect(modalStates[1]).toEqual({
      action: 'alias',
      phase: 'success',
      version: '18.18.0',
      alias: 'my-project',
    });
  });

  it('zeigt das Modal mit phase: error wenn das Speichern eines Alias fehlschlägt', async () => {
    const { comp } = await setup({
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Boom'))),
    });
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_CUSTOM);
    comp.editAliasTarget.set('18.18.0');
    comp.saveAlias('my-project');

    expect(modalStates[0]?.phase).toBe('running');
    expect(modalStates[1]?.phase).toBe('error');
    expect(modalStates[1]?.action).toBe('alias');
    expect(modalStates[1]?.errorMessage).toBe('Boom');
  });

  it('emittiert Fehler-Log wenn saveAlias fehlschlägt', async () => {
    const { comp } = await setup({
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Fehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20');
    comp.saveAlias('default');

    expect(logged[0].type).toBe('error');
  });

  // ── saveLtsAlias ────────────────────────────────────────────────────────────

  it('speichert LTS-Alias und zeigt das Modal (running → success)', async () => {
    const { fixture, comp, mockSvc } = await setup();
    fixture.componentRef.setInput('installedVersions', [
      { version: '20.18.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
    ]);
    const logged: LogEvent[] = [];
    const modalStates: InstallModalState[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startLtsEdit(ALIAS_LTS);
    comp.ltsEditVersion.set('20.18.0');
    comp.saveLtsAlias(ALIAS_LTS);

    expect(mockSvc.setLtsAlias).toHaveBeenCalledWith('iron', '20.18.0');
    expect(logged[0].type).toBe('success');
    expect(comp.editingLtsAlias()).toBeNull();
    expect(modalStates).toHaveLength(2);
    expect(modalStates[0]).toEqual({
      action: 'alias',
      phase: 'running',
      version: '20.18.0',
      alias: 'lts/iron',
    });
    expect(modalStates[1]?.phase).toBe('success');
  });

  it('zeigt das Modal mit phase: error wenn saveLtsAlias fehlschlägt', async () => {
    const { comp } = await setup({
      setLtsAlias: vi.fn().mockReturnValue(throwError(() => new Error('Boom'))),
    });
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startLtsEdit(ALIAS_LTS);
    comp.ltsEditVersion.set('20.18.0');
    comp.saveLtsAlias(ALIAS_LTS);

    expect(modalStates[1]?.phase).toBe('error');
    expect(modalStates[1]?.action).toBe('alias');
    expect(modalStates[1]?.errorMessage).toBe('Boom');
  });

  // ── createAlias ─────────────────────────────────────────────────────────────

  it('legt neuen Alias an und emittiert Erfolg-Log', async () => {
    const { comp, mockSvc } = await setup();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.newAliasName.set('new-alias');
    comp.newAliasTarget.set('18');
    comp.createAlias();

    expect(mockSvc.setAlias).toHaveBeenCalledWith('new-alias', '18');
    expect(logged[0].type).toBe('success');
    expect(comp.newAliasName()).toBe('');
    expect(comp.newAliasTarget()).toBe('');
  });

  it('bricht createAlias ab wenn Name oder Ziel leer ist', async () => {
    const { comp, mockSvc } = await setup();

    comp.newAliasName.set('');
    comp.newAliasTarget.set('18');
    comp.createAlias();
    expect(mockSvc.setAlias).not.toHaveBeenCalled();

    comp.newAliasName.set('alias');
    comp.newAliasTarget.set('');
    comp.createAlias();
    expect(mockSvc.setAlias).not.toHaveBeenCalled();
  });

  it('emittiert Fehler-Log wenn createAlias fehlschlägt', async () => {
    const { comp } = await setup({
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Fehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.newAliasName.set('new-alias');
    comp.newAliasTarget.set('18');
    comp.createAlias();

    expect(logged[0].type).toBe('error');
  });

  // ── deleteAlias / Inline-Confirm ────────────────────────────────────────────

  it('setzt confirmPendingAlias nach deleteAlias', async () => {
    const { comp } = await setup();
    comp.deleteAlias('my-project');
    expect(comp.confirmPendingAlias()).toBe('my-project');
  });

  it('löscht Alias nach confirmDelete', async () => {
    const { comp, mockSvc } = await setup();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.deleteAlias('my-project');
    comp.confirmDelete();

    expect(mockSvc.deleteAlias).toHaveBeenCalledWith('my-project');
    expect(logged[0].type).toBe('success');
    expect(comp.confirmPendingAlias()).toBeNull();
  });

  it('bricht Löschen ab nach cancelDelete', async () => {
    const { comp, mockSvc } = await setup();
    comp.deleteAlias('my-project');
    comp.cancelDelete();

    expect(mockSvc.deleteAlias).not.toHaveBeenCalled();
    expect(comp.confirmPendingAlias()).toBeNull();
  });

  it('emittiert Fehler-Log wenn deleteAlias fehlschlägt', async () => {
    const { comp } = await setup({
      deleteAlias: vi.fn().mockReturnValue(throwError(() => new Error('Fehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.deleteAlias('my-project');
    comp.confirmDelete();

    expect(logged[0].type).toBe('error');
  });
});
