import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Application footer (organism) rendering the copyright line and external links
 * to the project's GitHub repository and license.
 *
 * Stateless and input-free: all values are computed once at construction time.
 * `OnPush` change detection therefore never causes a re-render after the
 * initial paint.
 */
@Component({
  selector: 'app-footer',
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooterComponent {
  /** Current calendar year, shown in the copyright notice. Resolved once at construction. */
  readonly year = new Date().getFullYear();

  /** Link to the project source repository. */
  readonly githubUrl = 'https://github.com/mspecht-adesso/nvm-manager';

  /** Link to the project's license file on GitHub. */
  readonly licenseUrl = 'https://github.com/mspecht-adesso/nvm-manager/blob/main/LICENSE';
}
