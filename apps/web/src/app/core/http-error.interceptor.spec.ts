import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { httpErrorInterceptor } from './http-error.interceptor';

/**
 * Unit tests for {@link httpErrorInterceptor}.
 *
 * Uses Angular's `HttpTestingController` to drive real requests through the
 * interceptor and flush controlled responses. Verifies that:
 * - successful responses pass through untouched,
 * - failures are normalised to a plain `Error`,
 * - the API's `{ error }` body is preferred as the message, with a fallback
 *   when no such body is present.
 */
describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // Assert that no unexpected outstanding HTTP requests remain after each test.
  afterEach(() => httpMock.verify());

  it('lässt erfolgreiche Antworten unverändert durch', async () => {
    const promise = firstValueFrom(http.get<{ ok: boolean }>('/api/test'));
    httpMock.expectOne('/api/test').flush({ ok: true });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('normalisiert Fehler auf ein Error-Objekt', async () => {
    const promise = firstValueFrom(http.get('/api/test'));
    httpMock.expectOne('/api/test').flush(
      { error: 'Etwas ging schief' },
      { status: 500, statusText: 'Server Error' },
    );
    await expect(promise).rejects.toBeInstanceOf(Error);
  });

  it('verwendet die error-Eigenschaft des Response-Bodys als Message', async () => {
    const promise = firstValueFrom(http.get('/api/test'));
    httpMock.expectOne('/api/test').flush(
      { error: 'nvm nicht verfügbar' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    const err = await promise.catch((e: Error) => e);
    expect((err as Error).message).toBe('nvm nicht verfügbar');
  });

  it('fällt auf eine Message zurück wenn kein error-Body vorhanden ist', async () => {
    const promise = firstValueFrom(http.get('/api/test'));
    httpMock.expectOne('/api/test').flush(null, { status: 500, statusText: 'Server Error' });
    const err = await promise.catch((e: Error) => e);
    expect((err as Error).message).toBeTruthy();
  });
});
