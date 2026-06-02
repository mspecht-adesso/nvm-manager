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

  getErrorInstructions(message: string | undefined): string {
    if (!message) return 'Überprüfe den Log-Bereich für weitere Details.';
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
