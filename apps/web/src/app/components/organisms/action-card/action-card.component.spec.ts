import { TestBed } from '@angular/core/testing';
import { ActionCardComponent } from './action-card.component';

/**
 * Unit tests for {@link ActionCardComponent}.
 *
 * Two focus areas:
 * 1. The `prefillVersion` → `versionInput` `linkedSignal` behaviour (default
 *    `'22'`, prefill overrides, manual edits are preserved when prefill clears).
 * 2. The four action methods, which must trim input and only emit when the
 *    version is non-empty.
 */
describe('ActionCardComponent', () => {
  /** Compiles the standalone component and returns the fixture + instance. */
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [ActionCardComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActionCardComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('hat "22" als Standard-Version', async () => {
    const { comp } = await setup();
    expect(comp.versionInput()).toBe('22');
  });

  it('isLoading ist standardmäßig false', async () => {
    const { comp } = await setup();
    expect(comp.isLoading()).toBe(false);
  });

  describe('prefillVersion (linkedSignal)', () => {
    it('setzt versionInput wenn ein nicht-leerer Wert übergeben wird', async () => {
      const { fixture, comp } = await setup();
      fixture.componentRef.setInput('prefillVersion', '20');
      expect(comp.versionInput()).toBe('20');
    });

    it('überschreibt versionInput nicht wenn ein leerer Wert übergeben wird', async () => {
      const { fixture, comp } = await setup();
      comp.versionInput.set('22');
      fixture.componentRef.setInput('prefillVersion', '');
      expect(comp.versionInput()).toBe('22');
    });

    it('behält manuelle Eingabe wenn prefillVersion danach leer wird', async () => {
      const { fixture, comp } = await setup();
      fixture.componentRef.setInput('prefillVersion', '18');
      expect(comp.versionInput()).toBe('18');
      comp.versionInput.set('16');
      fixture.componentRef.setInput('prefillVersion', '');
      expect(comp.versionInput()).toBe('16');
    });
  });

  describe('onInstall()', () => {
    it('emittiert install mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.install.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('22');
      comp.onInstall();
      expect(emitted).toEqual(['22']);
    });

    it('trimmt Leerzeichen vor dem Emittieren', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.install.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('  22  ');
      comp.onInstall();
      expect(emitted).toEqual(['22']);
    });

    it('emittiert nicht bei leerem Input', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.install.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('');
      comp.onInstall();
      expect(emitted).toHaveLength(0);
    });
  });

  describe('onUse()', () => {
    it('emittiert use mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.use.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('20');
      comp.onUse();
      expect(emitted).toEqual(['20']);
    });

    it('emittiert nicht bei leerem Input', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.use.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('   ');
      comp.onUse();
      expect(emitted).toHaveLength(0);
    });
  });

  describe('onSetDefault()', () => {
    it('emittiert setDefault mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.setDefault.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('18');
      comp.onSetDefault();
      expect(emitted).toEqual(['18']);
    });
  });

  describe('onUninstall()', () => {
    it('emittiert uninstall mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.uninstall.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('16');
      comp.onUninstall();
      expect(emitted).toEqual(['16']);
    });

    it('emittiert nicht bei leerem Input', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.uninstall.subscribe((v: string) => emitted.push(v));
      comp.versionInput.set('');
      comp.onUninstall();
      expect(emitted).toHaveLength(0);
    });
  });
});
