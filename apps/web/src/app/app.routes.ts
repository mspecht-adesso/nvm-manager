import { Routes } from '@angular/router';

/**
 * Application route table.
 *
 * Intentionally empty: nvm-manager is a single-view tool whose entire UI is
 * composed inside the root {@link App} component, so no client-side routing is
 * required. The router is still provided in `app.config.ts` so that routes can
 * be added later (e.g. a settings page) without re-wiring the bootstrap.
 */
export const routes: Routes = [];
