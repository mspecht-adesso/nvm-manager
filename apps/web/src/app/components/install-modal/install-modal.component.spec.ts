import { TestBed } from '@angular/core/testing';
import { InstallModalComponent } from './install-modal.component';
import type { InstallModalState } from '../../models/nvm.models';

/**
 * Synchronously runs any pending Angular `effect()`s.
 *
 * The component's auto-close and focus logic live in effects; this helper forces
 * them to run inside a test without waiting for a full change-detection cycle.
 * `TestBed.flushEffects` is not in the public typings, hence the cast.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flushEffects = () => (TestBed as any).flushEffects?.();

/**
 * Unit tests for {@link InstallModalComponent}.
 *
 * Three areas are covered:
 * - Accessibility & Escape handling (dialog ARIA attributes, Escape closes
 *   except during `running`, focus moves to the close button).
 * - The success auto-close timer (started only for `success`, cancelled on
 *   state change) — verified with Vitest fake timers.
 * - {@link InstallModalComponent.getErrorInstructions} error-message
 *   classification across all action types.
 */
describe('InstallModalComponent', () => {
  /** Compiles the standalone component and returns the fixture + instance. */
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

  describe('Accessibility / Escape', () => {
    it('hat role="dialog" und aria-modal im Fehler-Zustand', async () => {
      const { fixture } = await setup();
      fixture.componentRef.setInput('state', { action: 'install', phase: 'error', version: '22' });
      fixture.detectChanges();

      const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.getAttribute('aria-labelledby')).toBe('modal-title');
    });

    it('schließt bei Escape im Fehler-Zustand', async () => {
      const { fixture, comp } = await setup();
      fixture.componentRef.setInput('state', { action: 'install', phase: 'error', version: '22' });
      fixture.detectChanges();

      let closed = false;
      comp.closed.subscribe(() => (closed = true));
      comp.onEscape();

      expect(closed).toBe(true);
    });

    it('schließt NICHT bei Escape während running', async () => {
      const { fixture, comp } = await setup();
      fixture.componentRef.setInput('state', { action: 'install', phase: 'running', version: '22' });
      fixture.detectChanges();

      let closed = false;
      comp.closed.subscribe(() => (closed = true));
      comp.onEscape();

      expect(closed).toBe(false);
    });

    it('schließt NICHT bei Escape wenn kein Modal offen ist', async () => {
      const { comp } = await setup();
      let closed = false;
      comp.closed.subscribe(() => (closed = true));
      comp.onEscape();
      expect(closed).toBe(false);
    });

    it('fokussiert den Schließen-Button im Fehler-Zustand', async () => {
      const { fixture } = await setup();
      fixture.componentRef.setInput('state', { action: 'install', phase: 'error', version: '22' });
      fixture.detectChanges();
      await fixture.whenStable();

      const btn = (fixture.nativeElement as HTMLElement).querySelector('.modal__close-btn');
      expect(document.activeElement).toBe(btn);
    });
  });

  describe('Auto-Close bei phase: success', () => {
    it('startet Auto-Close-Timer bei phase: success', async () => {
      // Fake timers let us assert the 3s auto-close fires without real waiting.
      vi.useFakeTimers();
      const { fixture, comp } = await setup();

      let closed = false;
      comp.closed.subscribe(() => (closed = true));

      const state: InstallModalState = { action: 'install', phase: 'success', version: '22' };
      fixture.componentRef.setInput('state', state);
      flushEffects();

      // Not closed immediately; only after the timer elapses.
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
      // Switching success → error must cancel the pending auto-close timer so
      // the modal does not close after the error state was shown.
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
