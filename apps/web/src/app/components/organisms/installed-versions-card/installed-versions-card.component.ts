import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

@Component({
  selector: 'app-installed-versions-card',
  standalone: true,
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './installed-versions-card.component.html',
})
export class InstalledVersionsCardComponent {
  @Input() versions: InstalledNodeVersion[] = [];
  @Input() raw = '';
  @Input() loading = false;
  @Input() isLoading = false;

  @Output() useVersion = new EventEmitter<string>();
  @Output() uninstallVersion = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
}
