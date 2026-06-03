import { TestBed } from '@angular/core/testing';
import { InstallModalComponent } from './install-modal.component';
import type { InstallModalState } from '../../models/nvm.models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flushEffects = () => (TestBed as any).flushEffects?.();

describe('InstallModalComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [InstallModalComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(InstallModalComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('hat state: null als Default', async () => {
    const { comp } = await setup();
    expect(comp.state()).toBeNull();
  });

  describe('close()', () => {
    it('emittiert closed-Event', async () => {
      const { comp } = await setup();
      let closed = false;
      comp.closed.subscribe(() => (closed = true));
      comp.close();
      expect(closed).toBe(true);
    });
  });

  describe('Auto-Close bei phase: success', () => {
    it('startet Auto-Close-Timer bei phase: success', async () => {
      vi.useFakeTimers();
      const { fixture, comp } = await setup();

      let closed = false;
      comp.closed.subscribe(() => (closed = true));

      const state: InstallModalState = { action: 'install', phase: 'success', version: '22' };
      fixture.componentRef.setInput('state', state);
      flushEffects();

      expect(closed).toBe(false);
      vi.advanceTimersByTime(3000);
      expect(closed).toBe(true);

      vi.useRealTimers();
    });

    it('startet keinen Timer bei phase: running', async () => {
      vi.useFakeTimers();
      const { fixture, comp } = await setup();
      let closed = false;
      comp.closed.subscribe(() => (closed = true));

      const state: InstallModalState = { action: 'install', phase: 'running', version: '22' };
      fixture.componentRef.setInput('state', state);
      flushEffects();

      vi.advanceTimersByTime(5000);
      expect(closed).toBe(false);

      vi.useRealTimers();
    });

    it('löscht vorherigen Timer bei erneutem State-Wechsel', async () => {
      vi.useFakeTimers();
      const { fixture, comp } = await setup();
      let closeCount = 0;
      comp.closed.subscribe(() => closeCount++);

      const successState: InstallModalState = { action: 'install', phase: 'success', version: '22' };
      fixture.componentRef.setInput('state', successState);
      flushEffects();

      const errorState: InstallModalState = { action: 'install', phase: 'error', version: '22' };
      fixture.componentRef.setInput('state', errorState);
      flushEffects();

      vi.advanceTimersByTime(5000);
      expect(closeCount).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('getErrorInstructions()', () => {
    it('gibt Fallback-Text ohne Fehlermeldung zurück', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('install', undefined);
      expect(result).toContain('Log-Bereich');
    });

    it('erkennt nicht installierte Version bei use-Aktion', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('use', 'Version not installed');
      expect(result).toContain('nicht installiert');
    });

    it('erkennt "not found" bei use-Aktion', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('use', 'nvm: version not found');
      expect(result).toContain('nicht installiert');
    });

    it('gibt generischen Text bei unbekanntem use-Fehler zurück', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('use', 'Unbekannter Fehler');
      expect(result).toContain('Log-Bereich');
    });

    it('erkennt npm_config_prefix-Fehler bei install-Aktion', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('install', 'npm_config_prefix is set');
      expect(result).toContain('unset npm_config_prefix');
    });

    it('erkennt Netzwerkfehler ETIMEDOUT', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('install', 'ETIMEDOUT connect');
      expect(result).toContain('Internetverbindung');
    });

    it('erkennt Netzwerkfehler ENOTFOUND', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('install', 'ENOTFOUND nodejs.org');
      expect(result).toContain('Internetverbindung');
    });

    it('erkennt "already installed"', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('install', 'already installed');
      expect(result).toContain('bereits installiert');
    });

    it('gibt generischen Text bei unbekanntem install-Fehler zurück', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('install', 'Unbekannter Fehler');
      expect(result).toContain('Log-Bereich');
    });

    it('erkennt Netzwerkfehler bei nvm-update-Aktion', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('nvm-update', 'ETIMEDOUT connect');
      expect(result).toContain('Internetverbindung');
    });

    it('erkennt "not a git repository"-Fehler bei nvm-update-Aktion', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('nvm-update', 'fatal: not a git repository');
      expect(result).toContain('manuell');
    });

    it('erkennt git-Fehler bei nvm-update-Aktion', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('nvm-update', 'git fetch failed');
      expect(result).toContain('git');
    });

    it('gibt generischen Text mit manueller Anleitung bei unbekanntem nvm-update-Fehler zurück', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('nvm-update', 'Unbekannter Fehler');
      expect(result).toContain('manuell');
    });

    it('gibt Fallback-Text ohne Fehlermeldung bei nvm-update zurück', async () => {
      const { comp } = await setup();
      const result = comp.getErrorInstructions('nvm-update', undefined);
      expect(result).toContain('Log-Bereich');
    });
  });
});
