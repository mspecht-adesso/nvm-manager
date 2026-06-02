import { TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';

describe('SpinnerComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(SpinnerComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('rendert das .spinner Element', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.spinner')).toBeTruthy();
  });
});
