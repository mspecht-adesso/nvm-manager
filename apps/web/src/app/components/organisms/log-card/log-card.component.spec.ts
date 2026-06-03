import { TestBed } from '@angular/core/testing';
import { LogCardComponent } from './log-card.component';
import type { LogEntry } from '../../../models/nvm.models';

const ENTRIES: LogEntry[] = [
  { message: 'Node 22 installiert.', type: 'success', timestamp: new Date('2026-06-02T12:00:00') },
  { message: 'Fehler aufgetreten.', type: 'error', timestamp: new Date('2026-06-02T12:01:00') },
  { message: 'Installiere Node 20 ...', type: 'info', timestamp: new Date('2026-06-02T12:02:00') },
];

describe('LogCardComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [LogCardComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(LogCardComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('hat leeres Log als Default', async () => {
    const { comp } = await setup();
    expect(comp.log()).toEqual([]);
  });

  it('nimmt Log-Einträge als Input entgegen', async () => {
    const { fixture, comp } = await setup();
    fixture.componentRef.setInput('log', ENTRIES);
    fixture.detectChanges();
    expect(comp.log()).toHaveLength(3);
  });

  it('rendert alle Log-Einträge', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('log', ENTRIES);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const items = el.querySelectorAll('.log-entry');
    expect(items.length).toBe(3);
  });

  it('rendert Platzhalter-Text wenn Log leer ist', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('log', []);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Noch keine Aktionen ausgeführt');
  });

  it('setzt korrekte CSS-Klassen je Eintragstyp', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('log', ENTRIES);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.log-entry--success')).toBeTruthy();
    expect(el.querySelector('.log-entry--error')).toBeTruthy();
    expect(el.querySelector('.log-entry--info')).toBeTruthy();
  });

  it('zeigt die Nachricht des Log-Eintrags an', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('log', [ENTRIES[0]]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Node 22 installiert.');
  });
});
