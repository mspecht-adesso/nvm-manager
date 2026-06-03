import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../molecules/card/card.component';

@Component({
  selector: 'app-action-card',
  standalone: true,
  imports: [FormsModule, CardComponent],
  templateUrl: './action-card.component.html',
  styleUrl: './action-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionCardComponent {
  readonly isLoading = input(false);
  readonly prefillVersion = input('');

  readonly install = output<string>();
  readonly use = output<string>();
  readonly setDefault = output<string>();
  readonly uninstall = output<string>();

  // Derived from `prefillVersion` but locally overridable (user typing).
  // A non-empty prefill overwrites the field; otherwise the previous value is kept.
  readonly versionInput = linkedSignal<string, string>({
    source: this.prefillVersion,
    computation: (prefill, previous) => prefill || previous?.value || '22',
  });

  onInstall(): void {
    const v = this.versionInput().trim();
    if (v) this.install.emit(v);
  }

  onUse(): void {
    const v = this.versionInput().trim();
    if (v) this.use.emit(v);
  }

  onSetDefault(): void {
    const v = this.versionInput().trim();
    if (v) this.setDefault.emit(v);
  }

  onUninstall(): void {
    const v = this.versionInput().trim();
    if (v) this.uninstall.emit(v);
  }
}
