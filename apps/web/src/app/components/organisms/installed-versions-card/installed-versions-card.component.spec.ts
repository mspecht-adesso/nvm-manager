import { TestBed } from '@angular/core/testing';
import { InstalledVersionsCardComponent } from './installed-versions-card.component';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

const VERSIONS: InstalledNodeVersion[] = [
  { version: '22.11.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
  { version: '20.5.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
];

describe('InstalledVersionsCardComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [InstalledVersionsCardComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(InstalledVersionsCardComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('hat leere Versions-Liste als Default', async () => {
    const { comp } = await setup();
    expect(comp.versions).toEqual([]);
  });

  it('nimmt Versions-Liste als Input entgegen', async () => {
    const { fixture, comp } = await setup();
    comp.versions = VERSIONS;
    fixture.detectChanges();
    expect(comp.versions).toHaveLength(2);
  });

  it('emittiert useVersion wenn aufgerufen', async () => {
    const { fixture, comp } = await setup();
    const emitted: string[] = [];
    comp.useVersion.subscribe((v: string) => emitted.push(v));

    comp.useVersion.emit('20.5.0');
    expect(emitted).toContain('20.5.0');
  });

  it('emittiert refresh wenn aufgerufen', async () => {
    const { fixture, comp } = await setup();
    let refreshed = false;
    comp.refresh.subscribe(() => (refreshed = true));

    comp.refresh.emit();
    expect(refreshed).toBe(true);
  });

  it('setzt loading auf false als Default', async () => {
    const { comp } = await setup();
    expect(comp.loading).toBe(false);
    expect(comp.isLoading).toBe(false);
  });
});
