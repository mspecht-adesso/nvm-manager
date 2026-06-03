import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  NvmStatus,
  NvmCommandResult,
  InstalledVersionsResponse,
  AliasesResponse,
  RemoteVersionsResponse,
} from '../models/nvm.models';

@Injectable({ providedIn: 'root' })
export class NvmApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  // Error normalisation is handled centrally by `httpErrorInterceptor`.

  getStatus(): Observable<NvmStatus> {
    return this.http.get<NvmStatus>(`${this.baseUrl}/status`);
  }

  getInstalledVersions(): Observable<InstalledVersionsResponse> {
    return this.http.get<InstalledVersionsResponse>(`${this.baseUrl}/versions/installed`);
  }

  getRemoteVersions(): Observable<RemoteVersionsResponse> {
    return this.http.get<RemoteVersionsResponse>(`${this.baseUrl}/versions/remote`);
  }

  installVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/install`, { version });
  }

  useVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/use`, { version });
  }

  setDefaultVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/default`, { version });
  }

  setStableVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/stable`, { version });
  }

  setLtsAlias(codename: string, version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/aliases/lts`, {
      codename,
      version,
    });
  }

  uninstallVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/uninstall`, { version });
  }

  getAliases(): Observable<AliasesResponse> {
    return this.http.get<AliasesResponse>(`${this.baseUrl}/versions/aliases`);
  }

  setAlias(name: string, target: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/aliases`, { name, target });
  }

  deleteAlias(name: string): Observable<NvmCommandResult> {
    return this.http.delete<NvmCommandResult>(
      `${this.baseUrl}/versions/aliases/${encodeURIComponent(name)}`,
    );
  }

  deleteLtsAlias(codename: string): Observable<NvmCommandResult> {
    return this.http.delete<NvmCommandResult>(
      `${this.baseUrl}/versions/aliases/lts/${encodeURIComponent(codename)}`,
    );
  }

  updateNvm(): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/nvm/update`, {});
  }

  openNvmDir(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/nvm/open-dir`, {});
  }
}
