import { Component } from '@angular/core';

@Component({
  selector: 'app-app-footer',
  standalone: true,
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
})
export class AppFooterComponent {
  readonly year = new Date().getFullYear();
  readonly githubUrl = 'https://github.com/mspecht-adesso/nvm-manager';
  readonly licenseUrl = 'https://github.com/mspecht-adesso/nvm-manager/blob/main/LICENSE';
}
