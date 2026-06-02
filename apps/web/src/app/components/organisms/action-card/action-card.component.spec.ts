import { TestBed } from '@angular/core/testing';
import { ActionCardComponent } from './action-card.component';

describe('ActionCardComponent', () => {
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
    expect(comp.versionInput).toBe('22');
  });

  it('isLoading ist standardmäßig false', async () => {
    const { comp } = await setup();
    expect(comp.isLoading).toBe(false);
  });

  describe('prefillVersion', () => {
    it('setzt versionInput wenn ein nicht-leerer Wert übergeben wird', async () => {
      const { comp } = await setup();
      comp.prefillVersion = '20';
      expect(comp.versionInput).toBe('20');
    });

    it('setzt versionInput nicht wenn ein leerer Wert übergeben wird', async () => {
      const { comp } = await setup();
      comp.versionInput = '22';
      comp.prefillVersion = '';
      expect(comp.versionInput).toBe('22');
    });
  });

  describe('onInstall()', () => {
    it('emittiert install mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.install.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '22';
      comp.onInstall();
      expect(emitted).toEqual(['22']);
    });

    it('trimmt Leerzeichen vor dem Emittieren', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.install.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '  22  ';
      comp.onInstall();
      expect(emitted).toEqual(['22']);
    });

    it('emittiert nicht bei leerem Input', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.install.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '';
      comp.onInstall();
      expect(emitted).toHaveLength(0);
    });
  });

  describe('onUse()', () => {
    it('emittiert use mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.use.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '20';
      comp.onUse();
      expect(emitted).toEqual(['20']);
    });

    it('emittiert nicht bei leerem Input', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.use.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '   ';
      comp.onUse();
      expect(emitted).toHaveLength(0);
    });
  });

  describe('onSetDefault()', () => {
    it('emittiert setDefault mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.setDefault.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '18';
      comp.onSetDefault();
      expect(emitted).toEqual(['18']);
    });
  });

  describe('onUninstall()', () => {
    it('emittiert uninstall mit der aktuellen Version', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.uninstall.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '16';
      comp.onUninstall();
      expect(emitted).toEqual(['16']);
    });

    it('emittiert nicht bei leerem Input', async () => {
      const { comp } = await setup();
      const emitted: string[] = [];
      comp.uninstall.subscribe((v: string) => emitted.push(v));
      comp.versionInput = '';
      comp.onUninstall();
      expect(emitted).toHaveLength(0);
    });
  });
});
