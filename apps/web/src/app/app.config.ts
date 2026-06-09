import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/http-error.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';

/**
 * Application-wide provider configuration consumed by `bootstrapApplication`
 * in `main.ts`.
 *
 * Centralises every cross-cutting concern that must be available throughout the
 * standalone component tree: change detection strategy, routing, the HTTP client
 * with its interceptor chain, and global error handling.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Forwards uncaught browser errors / unhandled promise rejections into
    // Angular's error handling so they reach the GlobalErrorHandler below.
    provideBrowserGlobalErrorListeners(),
    // Run without Zone.js: change detection is driven entirely by Signals.
    // Requires every component to use OnPush (enforced project-wide).
    provideZonelessChangeDetection(),
    // Router is provided for completeness; the app is currently single-view
    // (see app.routes.ts) but this keeps routing available without re-bootstrapping.
    provideRouter(routes),
    // Use the modern fetch backend and register the global error interceptor so
    // all HTTP failures are normalised to plain Errors (see httpErrorInterceptor).
    provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
    // Replace Angular's default ErrorHandler with our logging safety net.
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
