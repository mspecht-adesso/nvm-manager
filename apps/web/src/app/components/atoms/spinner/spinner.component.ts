import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Purely presentational, animated loading spinner (atom).
 *
 * Renders a single `<span class="spinner">` whose spinning animation is defined
 * entirely in `spinner.component.scss` (CSS keyframes) – there is no JavaScript
 * animation logic, which keeps the component cheap to render.
 *
 * ## Accessibility
 * The spinner is intentionally decorative and carries no text or ARIA role.
 * It must therefore never be used as the *only* indication that something is
 * loading. Pair it with a textual, screen-reader-visible status instead –
 * see {@link LoadingStateComponent}, which combines this spinner with a
 * `aria-live` message.
 *
 * Being a stateless, input-free atom with `OnPush` change detection, it never
 * triggers re-renders on its own.
 *
 * @example
 * ```html
 * <app-spinner />
 * ```
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `<span class="spinner"></span>`,
  styleUrl: './spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {}
