import { Component, OnInit, signal, inject } from '@angular/core';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { NvmStatus } from '../../../models/nvm.models';

@Component({
  selector: 'app-status-card',
  standalone: true,
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './status-card.component.html',
  styleUrl: './status-card.component.scss',
})
export class StatusCardComponent implements OnInit {
  private readonly nvmApi = inject(NvmApiService);

  readonly status = signal<NvmStatus | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.nvmApi.getStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.status.set({ ok: false, error: err.message });
        this.loading.set(false);
      },
    });
  }
}
