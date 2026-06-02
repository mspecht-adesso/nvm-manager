import { TestBed } from '@angular/core/testing';
import { LoadingStateComponent } from './loading-state.component';

describe('LoadingStateComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [LoadingStateComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoadingStateComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('zeigt die übergebene Nachricht an', async () => {
    const { fixture, comp } = await setup();
    comp.message = 'Lade Daten ...';
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Lade Daten ...');
  });

  it('rendert den .loading-state Wrapper', async () => {
    const { fixture, comp } = await setup();
    comp.message = 'Test';
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.loading-state')).toBeTruthy();
  });
});
