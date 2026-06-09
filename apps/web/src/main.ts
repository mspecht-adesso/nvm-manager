import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Application entry point: bootstraps the standalone root component with the
// application-wide providers defined in `app.config.ts` (HttpClient, the HTTP
// error interceptor, the global error handler, etc.).
//
// Any failure during bootstrap is terminal and cannot be handled by the global
// error handler (which is not yet wired up at this stage), so it is logged here.
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
