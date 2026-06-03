import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  getStatus(): Observable<NvmStatus> {
    return this.http
      .get<NvmStatus>(`${this.baseUrl}/status`)
      .pipe(catchError(this.handleError));
  }

  getInstalledVersions(): Observable<InstalledVersionsResponse> {
    return this.http
      .get<InstalledVersionsResponse>(`${this.baseUrl}/versions/installed`)
      .pipe(catchError(this.handleError));
  }

  getRemoteVersions(): Observable<RemoteVersionsResponse> {
    return this.http
      .get<RemoteVersionsResponse>(`${this.baseUrl}/versions/remote`)
      .pipe(catchError(this.handleError));
  }

  installVersion(version: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/install`, { version })
      .pipe(catchError(this.handleError));
  }

  useVersion(version: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/use`, { version })
      .pipe(catchError(this.handleError));
  }

  setDefaultVersion(version: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/default`, { version })
      .pipe(catchError(this.handleError));
  }

  setStableVersion(version: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/stable`, { version })
      .pipe(catchError(this.handleError));
  }

  setLtsAlias(codename: string, version: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/aliases/lts`, { codename, version })
      .pipe(catchError(this.handleError));
  }

  uninstallVersion(version: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/uninstall`, { version })
      .pipe(catchError(this.handleError));
  }

  getAliases(): Observable<AliasesResponse> {
    return this.http
      .get<AliasesResponse>(`${this.baseUrl}/versions/aliases`)
      .pipe(catchError(this.handleError));
  }

  setAlias(name: string, target: string): Observable<NvmCommandResult> {
    return this.http
      .post<NvmCommandResult>(`${this.baseUrl}/versions/aliases`, { name, target })
      .pipe(catchError(this.handleError));
  }

  deleteAlias(name: string): Observable<NvmCommandResult> {
    return this.http
      .delete<NvmCommandResult>(`${this.baseUrl}/versions/aliases/${encodeURIComponent(name)}`)
      .pipe(catchError(this.handleError));
  }

  deleteLtsAlias(codename: string): Observable<NvmCommandResult> {
    return this.http
      .delete<NvmCommandResult>(`${this.baseUrl}/versions/aliases/lts/${encodeURIComponent(codename)}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    const message = err.error?.error ?? err.message;
    return throwError(() => new Error(message));
  }
}
