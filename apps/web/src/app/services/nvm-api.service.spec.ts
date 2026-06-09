import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NvmApiService } from './nvm-api.service';
import { httpErrorInterceptor } from '../core/http-error.interceptor';
import { firstValueFrom } from 'rxjs';

/**
 * Unit tests for {@link NvmApiService}.
 *
 * Verifies that each method targets the correct URL, HTTP verb, and request
 * body, using `HttpTestingController` to intercept and flush responses. The real
 * {@link httpErrorInterceptor} is included so the error-normalisation tests
 * exercise the production error path end-to-end.
 */
describe('NvmApiService', () => {
  let service: NvmApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(NvmApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // Ensure every test consumed exactly the requests it expected.
  afterEach(() => httpMock.verify());

  describe('installVersion', () => {
    it('sendet POST /api/versions/install mit Version im Body', () => {
      service.installVersion('22').subscribe();
      const req = httpMock.expectOne('/api/versions/install');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ version: '22' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('useVersion', () => {
    it('sendet POST /api/versions/use mit Version im Body', () => {
      service.useVersion('20').subscribe();
      const req = httpMock.expectOne('/api/versions/use');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ version: '20' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('setDefaultVersion', () => {
    it('sendet POST /api/versions/default mit Version im Body', () => {
      service.setDefaultVersion('18').subscribe();
      const req = httpMock.expectOne('/api/versions/default');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ version: '18' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('uninstallVersion', () => {
    it('sendet POST /api/versions/uninstall mit Version im Body', () => {
      service.uninstallVersion('18').subscribe();
      const req = httpMock.expectOne('/api/versions/uninstall');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ version: '18' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('setStableVersion', () => {
    it('sendet POST /api/versions/stable mit Version im Body', () => {
      service.setStableVersion('22').subscribe();
      const req = httpMock.expectOne('/api/versions/stable');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ version: '22' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('setAlias', () => {
    it('sendet POST /api/versions/aliases mit Name und Ziel im Body', () => {
      service.setAlias('myAlias', '22').subscribe();
      const req = httpMock.expectOne('/api/versions/aliases');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'myAlias', target: '22' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('deleteAlias', () => {
    it('sendet DELETE /api/versions/aliases/:name', () => {
      service.deleteAlias('myAlias').subscribe();
      const req = httpMock.expectOne('/api/versions/aliases/myAlias');
      expect(req.request.method).toBe('DELETE');
      req.flush({ stdout: '', stderr: '' });
    });

    it('URL-enkodiert den Alias-Namen', () => {
      service.deleteAlias('my alias').subscribe();
      const req = httpMock.expectOne('/api/versions/aliases/my%20alias');
      expect(req.request.method).toBe('DELETE');
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('setLtsAlias', () => {
    it('sendet POST /api/versions/aliases/lts mit Codename und Version im Body', () => {
      service.setLtsAlias('iron', '20.18.0').subscribe();
      const req = httpMock.expectOne('/api/versions/aliases/lts');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ codename: 'iron', version: '20.18.0' });
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('deleteLtsAlias', () => {
    it('sendet DELETE /api/versions/aliases/lts/:codename', () => {
      service.deleteLtsAlias('iron').subscribe();
      const req = httpMock.expectOne('/api/versions/aliases/lts/iron');
      expect(req.request.method).toBe('DELETE');
      req.flush({ stdout: '', stderr: '' });
    });

    it('URL-enkodiert den Codenamen', () => {
      service.deleteLtsAlias('lts proposal').subscribe();
      const req = httpMock.expectOne('/api/versions/aliases/lts/lts%20proposal');
      expect(req.request.method).toBe('DELETE');
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('updateNvm', () => {
    it('sendet POST /api/nvm/update mit leerem Body', () => {
      service.updateNvm().subscribe();
      const req = httpMock.expectOne('/api/nvm/update');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ stdout: '', stderr: '' });
    });
  });

  describe('openNvmDir', () => {
    it('sendet POST /api/nvm/open-dir und liefert { ok: true }', async () => {
      const promise = firstValueFrom(service.openNvmDir());
      const req = httpMock.expectOne('/api/nvm/open-dir');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ ok: true });
      expect(await promise).toEqual({ ok: true });
    });
  });

  describe('Fehlerbehandlung (httpErrorInterceptor)', () => {
    it('extrahiert error-Eigenschaft aus der Fehlerantwort', async () => {
      const promise = firstValueFrom(service.installVersion('22'));
      httpMock.expectOne('/api/versions/install').flush(
        { error: 'nvm nicht verfügbar' },
        { status: 503, statusText: 'Service Unavailable' },
      );
      const err = await promise.catch((e: Error) => e);
      expect((err as Error).message).toBe('nvm nicht verfügbar');
    });

    it('fällt auf err.message zurück wenn keine error-Eigenschaft vorhanden', async () => {
      const promise = firstValueFrom(service.installVersion('22'));
      httpMock
        .expectOne('/api/versions/install')
        .flush(null, { status: 500, statusText: 'Server Error' });
      const err = await promise.catch((e: Error) => e);
      expect((err as Error).message).toBeTruthy();
    });
  });
});
