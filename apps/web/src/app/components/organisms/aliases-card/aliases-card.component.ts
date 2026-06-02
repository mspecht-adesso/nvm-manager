import { Component, OnInit, Output, EventEmitter, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { NvmAlias, AliasesResponse, LogEvent } from '../../../models/nvm.models';

@Component({
  selector: 'app-aliases-card',
  standalone: true,
  imports: [FormsModule, CardComponent, LoadingStateComponent],
  templateUrl: './aliases-card.component.html',
  styleUrl: './aliases-card.component.scss',
})
export class AliasesCardComponent implements OnInit {
  private readonly nvmApi = inject(NvmApiService);

  @Output() logged = new EventEmitter<LogEvent>();

  readonly aliases = signal<NvmAlias[]>([]);
  readonly loading = signal(false);
  readonly editingAlias = signal<string | null>(null);

  editAliasTarget = '';
  newAliasName = '';
  newAliasTarget = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.nvmApi.getAliases().subscribe({
      next: (res: AliasesResponse) => {
        this.aliases.set(res.aliases);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.logged.emit({ message: 'Fehler beim Laden der Aliases: ' + err.message, type: 'error' });
        this.loading.set(false);
      },
    });
  }

  startEdit(alias: NvmAlias): void {
    this.editingAlias.set(alias.name);
    this.editAliasTarget = alias.target;
  }

  cancelEdit(): void {
    this.editingAlias.set(null);
    this.editAliasTarget = '';
  }

  saveAlias(name: string): void {
    const target = this.editAliasTarget.trim();
    if (!target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' gesetzt.`, type: 'success' });
        this.editingAlias.set(null);
        this.editAliasTarget = '';
        this.load();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen des Alias '${name}': ${err.message}`, type: 'error' });
      },
    });
  }

  createAlias(): void {
    const name = this.newAliasName.trim();
    const target = this.newAliasTarget.trim();
    if (!name || !target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' angelegt.`, type: 'success' });
        this.newAliasName = '';
        this.newAliasTarget = '';
        this.load();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Anlegen des Alias '${name}': ${err.message}`, type: 'error' });
      },
    });
  }

  deleteAlias(name: string): void {
    if (!confirm(`Alias '${name}' wirklich löschen?`)) return;
    this.nvmApi.deleteAlias(name).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' gelöscht.`, type: 'success' });
        this.load();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Löschen des Alias '${name}': ${err.message}`, type: 'error' });
      },
    });
  }
}
