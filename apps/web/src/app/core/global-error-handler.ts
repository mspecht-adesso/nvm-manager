import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Catches unexpected runtime errors that are not handled elsewhere and logs
 * them in a single place. Acts as a safety net on top of the per-request HTTP
 * error handling provided by {@link httpErrorInterceptor}.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[nvm-manager] Unbehandelter Fehler:', err.message, err);
  }
}
