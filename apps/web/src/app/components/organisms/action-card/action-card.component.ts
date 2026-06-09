import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../molecules/card/card.component';

/**
 * Action card (organism) providing a single version input plus the four core
 * nvm actions: install, use, set-default and uninstall.
 *
 * The component does not call nvm itself. Each action validates that the input
 * is non-empty and then emits the trimmed version string to the parent, which
 * routes it to {@link NvmStateService}. This keeps the card free of HTTP and
 * business logic.
 */
@Component({
  selector: 'app-action-card',
  standalone: true,
  imports: [FormsModule, CardComponent],
  templateUrl: './action-card.component.html',
  styleUrl: './action-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionCardComponent {
  /** Disables all action buttons while an nvm operation is in progress. */
  readonly isLoading = input(false);

  /**
   * Version string pushed in from the outside (e.g. when the user clicks "Use"
   * on a row in the installed-versions table). A non-empty value pre-fills the
   * input field – see {@link versionInput}.
   */
  readonly prefillVersion = input('');

  /** Emits the version to install. */
  readonly install = output<string>();

  /** Emits the version to activate ("use"). */
  readonly use = output<string>();

  /** Emits the version to set as the nvm default alias. */
  readonly setDefault = output<string>();

  /** Emits the version to uninstall. */
  readonly uninstall = output<string>();

  /**
   * Two-way-bound model for the version text field.
   *
   * Implemented as a `linkedSignal` so the field stays editable while still
   * reacting to external prefill updates:
   * - When {@link prefillVersion} emits a non-empty value, it overwrites the field.
   * - Otherwise the user's previously typed value is preserved.
   * - On first render with no prefill it falls back to the sensible default `'22'`.
   */
  readonly versionInput = linkedSignal<string, string>({
    source: this.prefillVersion,
    computation: (prefill, previous) => prefill || previous?.value || '22',
  });

  /** Validates the input and emits the {@link install} event. */
  onInstall(): void {
    const v = this.versionInput().trim();
    if (v) this.install.emit(v);
  }

  /** Validates the input and emits the {@link use} event. */
  onUse(): void {
    const v = this.versionInput().trim();
    if (v) this.use.emit(v);
  }

  /** Validates the input and emits the {@link setDefault} event. */
  onSetDefault(): void {
    const v = this.versionInput().trim();
    if (v) this.setDefault.emit(v);
  }

  /** Validates the input and emits the {@link uninstall} event. */
  onUninstall(): void {
    const v = this.versionInput().trim();
    if (v) this.uninstall.emit(v);
  }
}
