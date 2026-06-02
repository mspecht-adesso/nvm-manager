import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NvmApiService } from './nvm-api.service';
import { firstValueFrom } from 'rxjs';

describe('NvmApiService', () => {
  let service: NvmApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NvmApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getStatus', () => {
    it('sendet GET /api/status', () => {
      service.getStatus().subscribe();
      const req = httpMock.expectOne('/api/status');
      expect(req.request.method).toBe('GET');
      req.flush({ ok: true, nvmVersion: '0.39.7' });
    });

    it('gibt NvmStatus zurück', async () => {
      const promise = firstValueFrom(service.getStatus());
      httpMock.expectOne('/api/status').flush({ ok: true, nvmVersion: '0.39.7' });
      const s = await promise;
      expect(s.ok).toBe(true);
      expect(s.nvmVersion).toBe('0.39.7');
    });

    it('mappt HTTP-Fehler auf Error', async () => {
      const promise = firstValueFrom(service.getStatus());
      httpMock.expectOne('/api/status').flush(
        { error: 'nvm nicht gefunden' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expect(promise).rejects.toBeInstanceOf(Error);
    });
  });

  describe('getInstalledVersions', () => {
    it('sendet GET /api/versions/installed', () => {
      service.getInstalledVersions().subscribe();
      const req = httpMock.expectOne('/api/versions/installed');
      expect(req.request.method).toBe('GET');
      req.flush({ stdout: '', stderr: '', versions: [] });
    });
  });

  describe('getRemoteVersions', () => {
    it('sendet GET /api/versions/remote', () => {
      service.getRemoteVersions().subscribe();
      const req = httpMock.expectOne('/api/versions/remote');
      expect(req.request.method).toBe('GET');
      req.flush({ stdout: '', stderr: '', versions: [] });
    });
  });

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

  describe('getAliases', () => {
    it('sendet GET /api/versions/aliases', () => {
      service.getAliases().subscribe();
      const req = httpMock.expectOne('/api/versions/aliases');
      expect(req.request.method).toBe('GET');
      req.flush({ stdout: '', stderr: '', aliases: [] });
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

  describe('handleError', () => {
    it('extrahiert error-Eigenschaft aus der Fehlerantwort', async () => {
      const promise = firstValueFrom(service.getStatus());
      httpMock.expectOne('/api/status').flush(
        { error: 'nvm nicht verfügbar' },
        { status: 503, statusText: 'Service Unavailable' },
      );
      const err = await promise.catch((e: Error) => e);
      expect((err as Error).message).toBe('nvm nicht verfügbar');
    });

    it('fällt auf err.message zurück wenn keine error-Eigenschaft vorhanden', async () => {
      const promise = firstValueFrom(service.getStatus());
      httpMock.expectOne('/api/status').flush(null, { status: 500, statusText: 'Server Error' });
      const err = await promise.catch((e: Error) => e);
      expect((err as Error).message).toBeTruthy();
    });
  });
});
