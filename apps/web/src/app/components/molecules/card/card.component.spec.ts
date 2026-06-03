import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card>
      <span card-title>Mein Titel</span>
      <button card-actions>Aktion</button>
      <p>Inhalt</p>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {}

describe('CardComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    return { fixture };
  }

  it('erstellt die Komponente', async () => {
    await TestBed.configureTestingModule({ imports: [CardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('projiziert card-title Slot', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.card__title')?.textContent?.trim()).toBe('Mein Titel');
  });

  it('projiziert card-actions Slot', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.card__header button')?.textContent?.trim()).toBe('Aktion');
  });

  it('projiziert default Slot als Body-Inhalt', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.card__body')?.textContent?.trim()).toBe('Inhalt');
  });

  it('rendert die .card Wrapper-Section', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('section.card')).toBeTruthy();
  });
});
