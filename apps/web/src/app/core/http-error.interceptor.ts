import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Normalises every failed HTTP response into a plain `Error` whose message is
 * the most descriptive text available: the API's `{ error: string }` body if
 * present, otherwise the transport-level message.
 *
 * Centralising this here means individual services no longer need their own
 * `catchError` boilerplate.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = err.error as { error?: string } | string | null;
      const apiMessage =
        body && typeof body === 'object' && typeof body.error === 'string'
          ? body.error
          : undefined;
      const message = apiMessage ?? err.message ?? 'Unbekannter Fehler';
      return throwError(() => new Error(message));
    }),
  );
