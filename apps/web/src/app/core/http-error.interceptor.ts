import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Functional HTTP interceptor that normalises every failed HTTP response into a
 * plain `Error` carrying the most descriptive message available.
 *
 * Message resolution order:
 * 1. The backend's structured `{ error: string }` body (the nvm-manager API
 *    sends errors in this shape).
 * 2. The transport-level message from Angular's `HttpErrorResponse`
 *    (e.g. connection refused, 404 status text).
 * 3. A generic German fallback when neither is available.
 *
 * Centralising this conversion here means services and components can simply
 * handle a normal `Error` and no longer need their own `catchError` boilerplate
 * to dig into `HttpErrorResponse`.
 *
 * The error is re-thrown (not swallowed) so each subscriber's `error` callback
 * still fires; only the *shape* of the error is changed.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * provideHttpClient(withInterceptors([httpErrorInterceptor]))
 * ```
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // `err.error` can be a parsed JSON object, a raw string, or null depending
      // on the response content type and whether the body parsed successfully.
      const body = err.error as { error?: string } | string | null;
      const apiMessage =
        body && typeof body === 'object' && typeof body.error === 'string'
          ? body.error
          : undefined;
      const message = apiMessage ?? err.message ?? 'Unbekannter Fehler';
      // Re-throw as a plain Error so downstream `error` handlers receive a
      // consistent type regardless of the original failure source.
      return throwError(() => new Error(message));
    }),
  );
