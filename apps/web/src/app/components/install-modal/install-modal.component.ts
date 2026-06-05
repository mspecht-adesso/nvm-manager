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

@Component({
  selector: 'app-install-modal',
  standalone: true,
  templateUrl: './install-modal.component.html',
  styleUrl: './install-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class InstallModalComponent {
  readonly state = input<InstallModalState>(null);
  readonly closed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  /** Element that had focus before the dialog opened, restored on close. */
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;

    effect((onCleanup) => {
      clearTimeout(autoCloseTimer);
      if (this.state()?.phase === 'success') {
        autoCloseTimer = setTimeout(() => this.close(), 3000);
      }
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

  onEscape(): void {
    // The running phase is intentionally non-dismissable.
    if (this.state() && this.state()?.phase !== 'running') {
      this.close();
    }
  }

  private static includesAny(message: string, terms: string[]): boolean {
    return terms.some((term) => message.includes(term));
  }

  private static readonly GENERIC_RETRY =
    'Überprüfe den Log-Bereich für weitere Details oder versuche es erneut.';

  getErrorInstructions(action: InstallModalAction, message: string | undefined): string {
    if (!message) return 'Überprüfe den Log-Bereich für weitere Details.';

    switch (action) {
      case 'nvm-update':
        return this.nvmUpdateInstructions(message);
      case 'use':
      case 'default':
      case 'alias':
        return InstallModalComponent.includesAny(message, ['not installed', 'not found'])
          ? 'Die Version ist nicht installiert. Installiere sie zunächst über „Installieren".'
          : InstallModalComponent.GENERIC_RETRY;
      case 'uninstall':
        return this.uninstallInstructions(message);
      default:
        return this.installInstructions(message);
    }
  }

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

  private uninstallInstructions(message: string): string {
    if (InstallModalComponent.includesAny(message, ['not installed', 'not found'])) {
      return 'Die Version ist möglicherweise bereits deinstalliert. Lade die Liste neu.';
    }
    if (InstallModalComponent.includesAny(message, ['currently active', 'in use'])) {
      return 'Eine aktive Version kann nicht deinstalliert werden. Wechsle zuerst zu einer anderen Version.';
    }
    return InstallModalComponent.GENERIC_RETRY;
  }

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

  close(): void {
    this.previouslyFocused?.focus();
    this.previouslyFocused = null;
    this.closed.emit();
  }
}
