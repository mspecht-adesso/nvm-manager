import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { InstallModalAction, InstallModalState } from '../../models/nvm.models';

/**
 * Modal dialog displayed during and after nvm operations (install, uninstall,
 * use, set default, alias management, nvm self-update).
 *
 * ## Lifecycle
 * The parent component controls visibility by passing an {@link InstallModalState}
 * signal input. A `null` value means the modal is hidden; a non-null value
 * renders the modal with the given action and phase.
 *
 * ## Phases
 * - `running`  – the nvm command is in progress; the modal cannot be dismissed.
 * - `success`  – the command completed successfully; auto-closes after 3 s.
 * - `error`    – the command failed; human-readable recovery instructions are shown.
 *
 * ## Accessibility
 * - Escape key closes the modal in all phases except `running`.
 * - Focus is trapped inside the dialog while it is open (CDK FocusTrap in the template).
 * - On open, focus moves to the close button (or the dialog root as fallback).
 * - On close, focus returns to the element that was active before the modal opened.
 *
 * @example
 * ```html
 * <app-install-modal [state]="modalState()" (closed)="onModalClosed()" />
 * ```
 */
@Component({
  selector: 'app-install-modal',
  standalone: true,
  templateUrl: './install-modal.component.html',
  styleUrl: './install-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Global Escape listener registered on the host so it fires even when
    // focus is inside a child element (e.g. the log textarea).
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class InstallModalComponent {
  /**
   * Current state of the modal, driven by the parent component.
   * Setting this to `null` hides the modal; any non-null value shows it.
   */
  readonly state = input<InstallModalState>(null);

  /**
   * Emitted when the modal requests to be closed – either by the user pressing
   * Escape / the close button, or automatically after a successful operation.
   * The parent is responsible for resetting `state` to `null`.
   */
  readonly closed = output<void>();

  /** Reference to the dialog root element used as a focus fallback. */
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  /** Reference to the close button, which receives focus when the dialog opens. */
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  /** Element that had focus before the dialog opened, restored on close. */
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;

    // Automatically dismiss the modal 3 s after a successful operation so the
    // user does not need to close it manually for the happy path.
    effect((onCleanup) => {
      clearTimeout(autoCloseTimer);
      if (this.state()?.phase === 'success') {
        autoCloseTimer = setTimeout(() => this.close(), 3000);
      }
      // Cancel any pending timer if the state changes before it fires
      // (e.g. the parent resets the modal immediately).
      onCleanup(() => clearTimeout(autoCloseTimer));
    });

    // Move focus into the dialog when it opens so keyboard/screen-reader users
    // land on the most relevant element (the close button when present).
    effect(() => {
      const dialogEl = this.dialog()?.nativeElement;
      if (!this.state() || !dialogEl) return;
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      (this.closeButton()?.nativeElement ?? dialogEl).focus();
    });
  }

  /**
   * Handles the Escape key press registered on the document.
   * Deliberately blocks dismissal while an nvm command is running to prevent
   * the user from closing the modal mid-operation and losing feedback.
   */
  onEscape(): void {
    // The running phase is intentionally non-dismissable.
    if (this.state() && this.state()?.phase !== 'running') {
      this.close();
    }
  }

  /**
   * Returns `true` if `message` contains at least one of the given `terms`.
   * Used to classify raw nvm error output into user-friendly categories.
   *
   * @param message - Raw error string from nvm stderr / error payload.
   * @param terms   - Substrings to check for (case-sensitive).
   */
  private static includesAny(message: string, terms: string[]): boolean {
    return terms.some((term) => message.includes(term));
  }

  /**
   * Generic fallback message shown when the error cannot be classified more
   * specifically. Points the user to the log area for raw details.
   */
  private static readonly GENERIC_RETRY =
    'Überprüfe den Log-Bereich für weitere Details oder versuche es erneut.';

  /**
   * Returns a localised, actionable error message for a failed nvm operation.
   *
   * The message is derived from the raw `errorMessage` string returned by the
   * backend. Each action type has its own classification logic because the error
   * vocabulary from nvm differs per command (e.g. "not installed" means
   * something different for `use` vs. `uninstall`).
   *
   * @param action  - The nvm action that failed.
   * @param message - Raw error text from the backend (may be `undefined` when
   *                  the backend sends no error body).
   * @returns A human-readable recovery instruction in German.
   */
  getErrorInstructions(action: InstallModalAction, message: string | undefined): string {
    if (!message) return 'Überprüfe den Log-Bereich für weitere Details.';

    switch (action) {
      case 'nvm-update':
        return this.nvmUpdateInstructions(message);
      case 'use':
      case 'default':
      case 'alias':
        // For version-switching actions, "not found" almost always means the
        // requested version was never installed locally.
        return InstallModalComponent.includesAny(message, ['not installed', 'not found'])
          ? 'Die Version ist nicht installiert. Installiere sie zunächst über „Installieren".'
          : InstallModalComponent.GENERIC_RETRY;
      case 'uninstall':
        return this.uninstallInstructions(message);
      default:
        // Covers 'install' and any future actions not yet explicitly handled.
        return this.installInstructions(message);
    }
  }

  /**
   * Classifies nvm self-update errors and returns a targeted recovery hint.
   *
   * Common failure modes:
   * - Network unreachable (ETIMEDOUT / ENOTFOUND)
   * - `NVM_DIR` is not a git repository (e.g. after a manual installation)
   * - Generic git errors during fetch / checkout
   *
   * @param message - Raw error string from the backend.
   */
  private nvmUpdateInstructions(message: string): string {
    if (InstallModalComponent.includesAny(message, ['ETIMEDOUT', 'ENOTFOUND', 'network', 'Internetverbindung'])) {
      return 'Prüfe deine Internetverbindung und versuche es erneut.';
    }
    if (InstallModalComponent.includesAny(message, ['not a git repository', 'not a git repo'])) {
      return 'Das NVM_DIR-Verzeichnis ist kein Git-Repository. Führe die Aktualisierung manuell durch: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash';
    }
    if (InstallModalComponent.includesAny(message, ['git', 'fetch', 'checkout'])) {
      return 'Git-Fehler beim Aktualisieren. Stelle sicher, dass git installiert ist und eine Internetverbindung besteht.';
    }
    return 'Überprüfe den Log-Bereich für weitere Details oder führe die Aktualisierung manuell durch: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash';
  }

  /**
   * Classifies `nvm uninstall` errors and returns a targeted recovery hint.
   *
   * Common failure modes:
   * - Version was already removed (idempotent state mismatch)
   * - Trying to uninstall the currently active version (nvm prevents this)
   *
   * @param message - Raw error string from the backend.
   */
  private uninstallInstructions(message: string): string {
    if (InstallModalComponent.includesAny(message, ['not installed', 'not found'])) {
      return 'Die Version ist möglicherweise bereits deinstalliert. Lade die Liste neu.';
    }
    if (InstallModalComponent.includesAny(message, ['currently active', 'in use'])) {
      return 'Eine aktive Version kann nicht deinstalliert werden. Wechsle zuerst zu einer anderen Version.';
    }
    return InstallModalComponent.GENERIC_RETRY;
  }

  /**
   * Classifies `nvm install` errors and returns a targeted recovery hint.
   *
   * Common failure modes:
   * - `npm_config_prefix` is set, which conflicts with nvm's prefix management.
   * - Network errors during tarball download.
   * - Version is already present locally.
   *
   * @param message - Raw error string from the backend.
   */
  private installInstructions(message: string): string {
    if (message.includes('npm_config_prefix')) {
      return 'Führe unset npm_config_prefix in deiner Shell aus und starte den API-Server neu.';
    }
    if (InstallModalComponent.includesAny(message, ['ETIMEDOUT', 'ENOTFOUND', 'network'])) {
      return 'Prüfe deine Internetverbindung und versuche es erneut.';
    }
    if (message.includes('already installed')) {
      return 'Diese Version ist bereits installiert. Lade die installierten Versionen neu.';
    }
    return InstallModalComponent.GENERIC_RETRY;
  }

  /**
   * Closes the modal and restores focus to the element that triggered it.
   * Focus restoration is required by WCAG 2.1 SC 2.4.3 (Focus Order) and
   * ensures screen-reader users are not disoriented after the dialog closes.
   */
  close(): void {
    this.previouslyFocused?.focus();
    this.previouslyFocused = null;
    this.closed.emit();
  }
}
