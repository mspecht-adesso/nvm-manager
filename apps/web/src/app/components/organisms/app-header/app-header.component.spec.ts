import { TestBed } from '@angular/core/testing';
import { AppHeaderComponent } from './app-header.component';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

const ACTIVE_VERSION: InstalledNodeVersion = {
  version: '22.11.0',
  active: true,
  default: true,
  system: false,
};

describe('AppHeaderComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppHeaderComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('zeigt den App-Titel "nvm Manager" an', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('nvm Manager');
  });

  it('zeigt kein Versions-Badge wenn keine aktive Version vorhanden', async () => {
    const { fixture, comp } = await setup();
    comp.activeVersion = undefined;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.header__active-badge')).toBeNull();
  });

  it('zeigt das Versions-Badge wenn eine aktive Version übergeben wird', async () => {
    const { fixture, comp } = await setup();
    comp.activeVersion = ACTIVE_VERSION;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const badge = el.querySelector('.header__active-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('22.11.0');
  });

  it('activeVersion ist standardmäßig undefined', async () => {
    const { comp } = await setup();
    expect(comp.activeVersion).toBeUndefined();
  });
});
