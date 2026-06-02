import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../molecules/card/card.component';

@Component({
  selector: 'app-action-card',
  standalone: true,
  imports: [FormsModule, CardComponent],
  templateUrl: './action-card.component.html',
  styleUrl: './action-card.component.scss',
})
export class ActionCardComponent {
  @Input() isLoading = false;

  @Output() install = new EventEmitter<string>();
  @Output() use = new EventEmitter<string>();
  @Output() setDefault = new EventEmitter<string>();
  @Output() uninstall = new EventEmitter<string>();

  versionInput = '22';

  onInstall(): void {
    const v = this.versionInput.trim();
    if (v) this.install.emit(v);
  }

  onUse(): void {
    const v = this.versionInput.trim();
    if (v) this.use.emit(v);
  }

  onSetDefault(): void {
    const v = this.versionInput.trim();
    if (v) this.setDefault.emit(v);
  }

  onUninstall(): void {
    const v = this.versionInput.trim();
    if (v) this.uninstall.emit(v);
  }
}
