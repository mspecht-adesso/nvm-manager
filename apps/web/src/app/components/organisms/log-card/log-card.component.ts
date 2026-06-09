import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CardComponent } from '../../molecules/card/card.component';
import type { LogEntry } from '../../../models/nvm.models';

/**
 * Activity log panel (organism) that renders the recent log entries collected
 * by {@link NvmStateService} inside a {@link CardComponent}.
 *
 * Purely presentational: it receives the already-ordered, capped log list as an
 * input and uses `DatePipe` to format each entry's timestamp. It performs no
 * filtering, sorting, or trimming of its own.
 */
@Component({
  selector: 'app-log-card',
  standalone: true,
  imports: [DatePipe, CardComponent],
  templateUrl: './log-card.component.html',
  styleUrl: './log-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogCardComponent {
  /**
   * Log entries to display, expected newest-first (as produced by the state
   * service). Defaults to an empty array so the template can render an
   * "empty" state without a null check.
   */
  readonly log = input<LogEntry[]>([]);
}
