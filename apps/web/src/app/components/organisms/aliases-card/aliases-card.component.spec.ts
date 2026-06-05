import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AliasesCardComponent } from './aliases-card.component';
import { NvmApiService } from '../../../services/nvm-api.service';
import { of, throwError } from 'rxjs';
import type { NvmAlias, LogEvent, InstallModalState } from '../../../models/nvm.models';

const ALIAS_DEFAULT: NvmAlias = {
  name: 'default',
  target: 'lts/*',
  resolved: 'v22.11.0',
  editable: true,
  deletable: false,
};
const ALIAS_CUSTOM: NvmAlias = {
  name: 'my-project',
  target: 'v18.18.0',
  resolved: 'v18.18.0',
  editable: true,
  deletable: true,
};
const ALIASES_RESPONSE = { stdout: '', stderr: '', aliases: [ALIAS_DEFAULT, ALIAS_CUSTOM] };

function buildSvc(overrides: Partial<InstanceType<typeof NvmApiService>> = {}) {
  return {
    getAliases: vi.fn().mockReturnValue(of(ALIASES_RESPONSE)),
    setAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    deleteAlias: vi.fn().mockReturnValue(of({ stdout: '', stderr: '' })),
    ...overrides,
  };
}

describe('AliasesCardComponent', () => {
  async function setup(svcOverrides?: Partial<InstanceType<typeof NvmApiService>>) {
    const mockSvc = buildSvc(svcOverrides);
    await TestBed.configureTestingModule({
      imports: [AliasesCardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AliasesCardComponent);
    return { fixture, comp: fixture.componentInstance, mockSvc };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  // ── ngOnInit / load ─────────────────────────────────────────────────────────

  it('lädt Aliases beim Initialisieren', async () => {
    const { fixture, comp, mockSvc } = await setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockSvc.getAliases).toHaveBeenCalledOnce();
    expect(comp.aliases()).toHaveLength(2);
  });

  it('setzt loading auf false nach dem Laden', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.loading()).toBe(false);
  });

  it('emittiert Fehler-Log wenn getAliases fehlschlägt', async () => {
    const { fixture, comp } = await setup({
      getAliases: vi.fn().mockReturnValue(throwError(() => new Error('Netzwerkfehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(logged).toHaveLength(1);
    expect(logged[0].type).toBe('error');
    expect(logged[0].message).toContain('Netzwerkfehler');
    expect(comp.loading()).toBe(false);
  });

  // ── refreshTrigger ──────────────────────────────────────────────────────────

  it('löst kein erneutes Laden aus wenn refreshTrigger = 0', async () => {
    const { fixture, mockSvc } = await setup();
    fixture.detectChanges();
    await fixture.whenStable();

    vi.clearAllMocks();
    fixture.componentRef.setInput('refreshTrigger', 0);

    expect(mockSvc.getAliases).not.toHaveBeenCalled();
  });

  it('lädt neu wenn refreshTrigger > 0 gesetzt wird', async () => {
    const { fixture, mockSvc } = await setup();
    fixture.detectChanges();
    await fixture.whenStable();

    vi.clearAllMocks();
    fixture.componentRef.setInput('refreshTrigger', 1);
    await fixture.whenStable();

    expect(mockSvc.getAliases).toHaveBeenCalledOnce();
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
    const { fixture, comp, mockSvc } = await setup();
    fixture.detectChanges();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20');
    comp.saveAlias('default');
    await fixture.whenStable();

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
    const { fixture, comp } = await setup();
    fixture.detectChanges();
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20.5.0');
    comp.saveAlias('default');
    await fixture.whenStable();

    expect(modalStates).toHaveLength(2);
    expect(modalStates[0]).toEqual({ action: 'default', phase: 'running', version: '20.5.0' });
    expect(modalStates[1]).toEqual({ action: 'default', phase: 'success', version: '20.5.0' });
  });

  it('zeigt das Modal mit phase: error wenn das Speichern des default-Alias fehlschlägt', async () => {
    const { fixture, comp } = await setup({
      getAliases: vi.fn().mockReturnValue(of(ALIASES_RESPONSE)),
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Boom'))),
    });
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20.5.0');
    comp.saveAlias('default');
    await fixture.whenStable();

    expect(modalStates[0]?.phase).toBe('running');
    expect(modalStates[1]?.phase).toBe('error');
    expect(modalStates[1]?.errorMessage).toBe('Boom');
  });

  it('zeigt kein Modal beim Speichern eines nicht-default Alias', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();
    const modalStates: InstallModalState[] = [];
    comp.modalStateChange.subscribe((s: InstallModalState) => modalStates.push(s));

    comp.startEdit(ALIAS_CUSTOM);
    comp.editAliasTarget.set('18.18.0');
    comp.saveAlias('my-project');
    await fixture.whenStable();

    expect(modalStates).toHaveLength(0);
  });

  it('emittiert Fehler-Log wenn saveAlias fehlschlägt', async () => {
    const { fixture, comp } = await setup({
      getAliases: vi.fn().mockReturnValue(of(ALIASES_RESPONSE)),
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Fehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.startEdit(ALIAS_DEFAULT);
    comp.editAliasTarget.set('20');
    comp.saveAlias('default');
    await fixture.whenStable();

    expect(logged[0].type).toBe('error');
  });

  // ── createAlias ─────────────────────────────────────────────────────────────

  it('legt neuen Alias an und emittiert Erfolg-Log', async () => {
    const { fixture, comp, mockSvc } = await setup();
    fixture.detectChanges();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.newAliasName.set('new-alias');
    comp.newAliasTarget.set('18');
    comp.createAlias();
    await fixture.whenStable();

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
    const { fixture, comp } = await setup({
      getAliases: vi.fn().mockReturnValue(of(ALIASES_RESPONSE)),
      setAlias: vi.fn().mockReturnValue(throwError(() => new Error('Fehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.newAliasName.set('new-alias');
    comp.newAliasTarget.set('18');
    comp.createAlias();
    await fixture.whenStable();

    expect(logged[0].type).toBe('error');
  });

  // ── deleteAlias / Inline-Confirm ────────────────────────────────────────────

  it('setzt confirmPendingAlias nach deleteAlias', async () => {
    const { comp } = await setup();
    comp.deleteAlias('my-project');
    expect(comp.confirmPendingAlias()).toBe('my-project');
  });

  it('löscht Alias nach confirmDelete', async () => {
    const { fixture, comp, mockSvc } = await setup();
    fixture.detectChanges();
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.deleteAlias('my-project');
    comp.confirmDelete();
    await fixture.whenStable();

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
    const { fixture, comp } = await setup({
      getAliases: vi.fn().mockReturnValue(of(ALIASES_RESPONSE)),
      deleteAlias: vi.fn().mockReturnValue(throwError(() => new Error('Fehler'))),
    });
    const logged: LogEvent[] = [];
    comp.logged.subscribe((e: LogEvent) => logged.push(e));

    comp.deleteAlias('my-project');
    comp.confirmDelete();
    await fixture.whenStable();

    expect(logged[0].type).toBe('error');
  });
});
