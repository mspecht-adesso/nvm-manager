import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Application-wide fallback error handler.
 *
 * Registered as Angular's `ErrorHandler` provider, it catches any error that
 * bubbles up uncaught from components, templates, lifecycle hooks, or
 * unhandled rejected observables. It acts as the last line of defence and a
 * safety net on top of the per-request HTTP error normalisation done by
 * {@link httpErrorInterceptor}.
 *
 * The handler only logs; it deliberately does not rethrow, so a single
 * unexpected error cannot tear down the running application.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }]
 * ```
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  /**
   * Logs an uncaught error to the console with a recognisable prefix.
   *
   * @param error - The thrown value. Typed as `unknown` because JavaScript
   *                allows throwing any value, not just `Error` instances;
   *                non-`Error` values are wrapped so a `.message` is always available.
   */
  handleError(error: unknown): void {
    // Normalise to an Error so downstream logging always has a usable message.
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[nvm-manager] Unbehandelter Fehler:', err.message, err);
  }
}
