import { Component, Input } from '@angular/core';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

@Component({
  selector: 'app-app-header',
  standalone: true,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  @Input() activeVersion: InstalledNodeVersion | undefined = undefined;
}
