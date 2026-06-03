import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CardComponent } from '../../molecules/card/card.component';
import type { LogEntry } from '../../../models/nvm.models';

@Component({
  selector: 'app-log-card',
  standalone: true,
  imports: [DatePipe, CardComponent],
  templateUrl: './log-card.component.html',
  styleUrl: './log-card.component.scss',
})
export class LogCardComponent {
  readonly log = input<LogEntry[]>([]);
}
