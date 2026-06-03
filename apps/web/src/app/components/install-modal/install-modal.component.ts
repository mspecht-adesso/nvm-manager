import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import type { InstallModalState } from '../../models/nvm.models';

@Component({
  selector: 'app-install-modal',
  standalone: true,
  templateUrl: './install-modal.component.html',
  styleUrl: './install-modal.component.scss',
})
export class InstallModalComponent implements OnChanges, OnDestroy {
  @Input() state: InstallModalState = null;
  @Output() closed = new EventEmitter<void>();

  private autoCloseTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['state']) {
      clearTimeout(this.autoCloseTimer);
      if (this.state?.phase === 'success') {
        this.autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
      }
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.autoCloseTimer);
  }

  getErrorInstructions(action: 'install' | 'use' | 'uninstall' | 'nvm-update', message: string | undefined): string {
    if (!message) return 'Überprüfe den Log-Bereich für weitere Details.';

    if (action === 'nvm-update') {
      if (message.includes('ETIMEDOUT') || message.includes('ENOTFOUND') || message.includes('network') || message.includes('Internetverbindung')) {
        return 'Prüfe deine Internetverbindung und versuche es erneut.';
      }
      if (message.includes('not a git repository') || message.includes('not a git repo')) {
        return 'Das NVM_DIR-Verzeichnis ist kein Git-Repository. Führe die Aktualisierung manuell durch: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash';
      }
      if (message.includes('git') || message.includes('fetch') || message.includes('checkout')) {
        return 'Git-Fehler beim Aktualisieren. Stelle sicher, dass git installiert ist und eine Internetverbindung besteht.';
      }
      return 'Überprüfe den Log-Bereich für weitere Details oder führe die Aktualisierung manuell durch: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash';
    }

    if (action === 'use') {
      if (message.includes('not installed') || message.includes('not found')) {
        return 'Die Version ist nicht installiert. Installiere sie zunächst über „Installieren".';
      }
      return 'Überprüfe den Log-Bereich für weitere Details oder versuche es erneut.';
    }

    if (action === 'uninstall') {
      if (message.includes('not installed') || message.includes('not found')) {
        return 'Die Version ist möglicherweise bereits deinstalliert. Lade die Liste neu.';
      }
      if (message.includes('currently active') || message.includes('in use')) {
        return 'Eine aktive Version kann nicht deinstalliert werden. Wechsle zuerst zu einer anderen Version.';
      }
      return 'Überprüfe den Log-Bereich für weitere Details oder versuche es erneut.';
    }

    if (message.includes('npm_config_prefix')) {
      return 'Führe unset npm_config_prefix in deiner Shell aus und starte den API-Server neu.';
    }
    if (message.includes('ETIMEDOUT') || message.includes('ENOTFOUND') || message.includes('network')) {
      return 'Prüfe deine Internetverbindung und versuche es erneut.';
    }
    if (message.includes('already installed')) {
      return 'Diese Version ist bereits installiert. Lade die installierten Versionen neu.';
    }
    return 'Überprüfe den Log-Bereich für weitere Details oder versuche es erneut.';
  }

  close(): void {
    this.closed.emit();
  }
}
