import { TestBed } from '@angular/core/testing';
import { InstalledVersionsCardComponent } from './installed-versions-card.component';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

/** Two sample versions (one active/default, one inactive) for input tests. */
const VERSIONS: InstalledNodeVersion[] = [
  { version: '22.11.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
  { version: '20.5.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
];

/**
 * Unit tests for {@link InstalledVersionsCardComponent}.
 *
 * As a presentational component, the suite verifies input defaults, that the
 * `versions` input is accepted, and that the action outputs
 * (`useVersion`, `uninstallVersion`, `refresh`) are exposed.
 */
describe('InstalledVersionsCardComponent', () => {
  /** Compiles the standalone component and returns the fixture + instance. */
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
    expect(comp.versions()).toEqual([]);
  });

  it('nimmt Versions-Liste als Input entgegen', async () => {
    const { fixture, comp } = await setup();
    fixture.componentRef.setInput('versions', VERSIONS);
    fixture.detectChanges();
    expect(comp.versions()).toHaveLength(2);
  });

  it('hat loading und isLoading false als Default', async () => {
    const { comp } = await setup();
    expect(comp.loading()).toBe(false);
    expect(comp.isLoading()).toBe(false);
  });

  it('stellt useVersion als Output bereit', async () => {
    const { comp } = await setup();
    expect(comp.useVersion).toBeDefined();
  });

  it('stellt refresh als Output bereit', async () => {
    const { comp } = await setup();
    expect(comp.refresh).toBeDefined();
  });

  it('stellt uninstallVersion als Output bereit', async () => {
    const { comp } = await setup();
    expect(comp.uninstallVersion).toBeDefined();
  });
});
