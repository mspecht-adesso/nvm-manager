import { TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';

/**
 * Unit tests for {@link SpinnerComponent}.
 *
 * The spinner is a purely presentational atom, so the suite only verifies that
 * it instantiates and renders its single `.spinner` element (the animation
 * itself is CSS and not testable here).
 */
describe('SpinnerComponent', () => {
  /** Compiles the standalone component and returns the fixture + instance. */
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
