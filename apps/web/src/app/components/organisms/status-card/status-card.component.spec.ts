import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { StatusCardComponent } from './status-card.component';
import { NvmApiService } from '../../../services/nvm-api.service';
import { of, throwError } from 'rxjs';

function buildSvc(overrides: Partial<InstanceType<typeof NvmApiService>> = {}) {
  return {
    getStatus: vi.fn().mockReturnValue(of({ ok: true, nvmVersion: '0.39.7', nvmDir: '/home/.nvm' })),
    ...overrides,
  };
}

describe('StatusCardComponent', () => {
  async function setup(svcOverrides?: Partial<InstanceType<typeof NvmApiService>>) {
    const mockSvc = buildSvc(svcOverrides);
    await TestBed.configureTestingModule({
      imports: [StatusCardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NvmApiService, useValue: mockSvc },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StatusCardComponent);
    return { fixture, comp: fixture.componentInstance, mockSvc };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('ruft getStatus beim Initialisieren auf', async () => {
    const { fixture, mockSvc } = await setup();
    fixture.detectChanges();
    expect(mockSvc.getStatus).toHaveBeenCalledOnce();
  });

  it('setzt status nach erfolgreichem Laden', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.status()?.ok).toBe(true);
    expect(comp.status()?.nvmVersion).toBe('0.39.7');
  });

  it('setzt loading auf false nach dem Laden', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.loading()).toBe(false);
  });

  it('setzt status.ok auf false bei Fehler', async () => {
    const { fixture, comp } = await setup({
      getStatus: vi.fn().mockReturnValue(throwError(() => new Error('Verbindungsfehler'))),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.status()?.ok).toBe(false);
    expect(comp.status()?.error).toBe('Verbindungsfehler');
    expect(comp.loading()).toBe(false);
  });

  it('startet im Ladezustand', async () => {
    let resolveStatus!: (v: unknown) => void;
    const pendingStatus = new Promise((r) => (resolveStatus = r));
    const { fixture, comp } = await setup({
      getStatus: vi.fn().mockReturnValue(
        new (await import('rxjs')).Observable((obs) => {
          pendingStatus.then((v) => { obs.next(v); obs.complete(); });
        }),
      ),
    });

    fixture.detectChanges();
    expect(comp.loading()).toBe(true);
    resolveStatus({ ok: true });
  });
});
