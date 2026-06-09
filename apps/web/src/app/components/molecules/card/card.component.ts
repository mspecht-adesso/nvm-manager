import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Reusable layout container (molecule) that gives content a consistent
 * card surface: a header row with a title and optional actions, plus a body.
 *
 * The component holds no state and exposes no inputs; it is a pure
 * content-projection shell. Callers fill three slots via `ng-content`:
 *
 * | Slot                       | Rendered in                  | Purpose                          |
 * | -------------------------- | ---------------------------- | -------------------------------- |
 * | `[card-title]` attribute   | `<h2 class="card__title">`   | Heading text of the card         |
 * | `[card-actions]` attribute | header, right of the title   | Buttons / controls for the card  |
 * | *default* (no attribute)   | `<div class="card__body">`   | Main card content                |
 *
 * ## Accessibility
 * The title is always projected into an `<h2>`, so consumers should pass plain
 * heading text (not another heading element) to keep the document outline valid.
 *
 * `OnPush` change detection is safe because the component has no bindings of its
 * own; projected content is change-detected by its respective owner component.
 *
 * @example
 * ```html
 * <app-card>
 *   <span card-title>Installierte Versionen</span>
 *   <button card-actions (click)="reload()">Neu laden</button>
 *   <app-installed-versions-table />
 * </app-card>
 * ```
 */
@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {}
