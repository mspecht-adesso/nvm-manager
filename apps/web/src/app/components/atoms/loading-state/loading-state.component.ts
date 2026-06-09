import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

/**
 * Composite loading indicator (atom) combining a {@link SpinnerComponent} with
 * an accompanying, human-readable status message.
 *
 * Use this instead of a bare `<app-spinner />` wherever a loading state is shown,
 * so that sighted and screen-reader users alike are told *what* is loading
 * (e.g. "Lade installierte Versionen …").
 *
 * The component is stateless apart from its single required input and uses
 * `OnPush` change detection; it re-renders only when {@link message} changes.
 *
 * @example
 * ```html
 * @if (installedLoading()) {
 *   <app-loading-state message="Lade installierte Versionen …" />
 * }
 * ```
 */
@Component({
  selector: 'app-loading-state',
  imports: [SpinnerComponent],
  template: `
    <div class="loading-state">
      <app-spinner />
      <span>{{ message() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  /**
   * The status text rendered next to the spinner.
   *
   * Required because a loading indicator without a description provides no
   * accessible context. Pass a concise, user-facing sentence describing the
   * ongoing operation.
   */
  readonly message = input.required<string>();
}
