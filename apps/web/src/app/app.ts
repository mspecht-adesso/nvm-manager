import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { NvmApiService } from './services/nvm-api.service';
import { InstallModalComponent } from './components/install-modal/install-modal.component';
import type {
  NvmStatus,
  InstalledNodeVersion,
  InstalledVersionsResponse,
  NvmCommandResult,
  NvmAlias,
  AliasesResponse,
  RemoteNodeVersion,
  RemoteVersionsResponse,
  InstallModalState,
} from './models/nvm.models';

type LogEntry = {
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: Date;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, DatePipe, InstallModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly nvmApi = inject(NvmApiService);

  readonly status = signal<NvmStatus | null>(null);
  readonly installedVersions = signal<InstalledNodeVersion[]>([]);
  readonly installedRaw = signal<string>('');
  readonly remoteVersions = signal<RemoteNodeVersion[]>([]);
  readonly remoteSearch = signal('');
  readonly aliases = signal<NvmAlias[]>([]);
  readonly isLoading = signal(false);
  readonly statusLoading = signal(false);
  readonly installedLoading = signal(false);
  readonly remoteLoading = signal(false);
  readonly aliasesLoading = signal(false);
  readonly editingAlias = signal<string | null>(null);
  readonly log = signal<LogEntry[]>([]);
  readonly installModal = signal<InstallModalState>(null);

  versionInput = '22';
  editAliasTarget = '';
  newAliasName = '';
  newAliasTarget = '';

  readonly hasVersions = computed(() => this.installedVersions().length > 0);
  readonly activeVersion = computed(() =>
    this.installedVersions().find((v) => v.active),
  );

  readonly filteredRemoteVersions = computed(() => {
    const installedSet = new Set(this.installedVersions().map((v) => v.version));
    const query = this.remoteSearch().trim().toLowerCase();
    const available = this.remoteVersions().filter((v) => !installedSet.has(v.version));
    if (query) {
      return available.filter((v) => v.version.includes(query) || (v.lts?.toLowerCase().includes(query) ?? false)).slice(0, 100);
    }
    return available.slice(0, 30);
  });

  readonly remoteAvailableCount = computed(() => {
    const installedSet = new Set(this.installedVersions().map((v) => v.version));
    return this.remoteVersions().filter((v) => !installedSet.has(v.version)).length;
  });

  ngOnInit(): void {
    this.loadStatus();
    this.loadInstalledVersions();
    this.loadAliases();
  }

  loadStatus(): void {
    this.statusLoading.set(true);
    this.nvmApi.getStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        this.statusLoading.set(false);
      },
      error: (err: Error) => {
        this.status.set({ ok: false, error: err.message });
        this.statusLoading.set(false);
      },
    });
  }

  loadInstalledVersions(): void {
    this.installedLoading.set(true);
    this.nvmApi.getInstalledVersions().subscribe({
      next: (res: InstalledVersionsResponse) => {
        this.installedVersions.set(res.versions);
        this.installedRaw.set(res.stdout);
        this.installedLoading.set(false);
      },
      error: (err: Error) => {
        this.addLog('Fehler beim Laden der installierten Versionen: ' + err.message, 'error');
        this.installedLoading.set(false);
      },
    });
  }

  loadRemoteVersions(): void {
    this.remoteLoading.set(true);
    this.remoteVersions.set([]);
    this.nvmApi.getRemoteVersions().subscribe({
      next: (res: RemoteVersionsResponse) => {
        this.remoteVersions.set(res.versions);
        this.remoteLoading.set(false);
      },
      error: (err: Error) => {
        this.addLog('Fehler beim Laden der Remote-Versionen: ' + err.message, 'error');
        this.remoteLoading.set(false);
      },
    });
  }

  installRemoteVersion(version: string): void {
    this.runInstall(version);
  }

  install(): void {
    const version = this.versionInput.trim();
    if (!version) return;
    this.runInstall(version);
  }

  private runInstall(version: string): void {
    this.isLoading.set(true);
    this.installModal.set({ phase: 'installing', version });
    this.addLog(`Installiere Node ${version} ...`, 'info');
    this.nvmApi.installVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} installiert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ phase: 'success', version });
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler bei Installation von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  closeInstallModal(): void {
    this.installModal.set(null);
  }

  use(): void {
    const version = this.versionInput.trim();
    if (!version) return;
    this.isLoading.set(true);
    this.addLog(`Aktiviere Node ${version} ...`, 'info');
    this.nvmApi.useVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} aktiviert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Aktivieren von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
      },
    });
  }

  setDefault(): void {
    const version = this.versionInput.trim();
    if (!version) return;
    this.isLoading.set(true);
    this.addLog(`Setze Node ${version} als Default ...`, 'info');
    this.nvmApi.setDefaultVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} als Default gesetzt. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Setzen des Defaults für ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
      },
    });
  }

  uninstall(): void {
    const version = this.versionInput.trim();
    if (!version) return;
    if (!confirm(`Node ${version} wirklich deinstallieren?`)) return;
    this.isLoading.set(true);
    this.addLog(`Deinstalliere Node ${version} ...`, 'info');
    this.nvmApi.uninstallVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} deinstalliert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler bei Deinstallation von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
      },
    });
  }

  useInstalledVersion(version: string): void {
    this.versionInput = version;
    this.use();
  }

  loadAliases(): void {
    this.aliasesLoading.set(true);
    this.nvmApi.getAliases().subscribe({
      next: (res: AliasesResponse) => {
        this.aliases.set(res.aliases);
        this.aliasesLoading.set(false);
      },
      error: (err: Error) => {
        this.addLog('Fehler beim Laden der Aliases: ' + err.message, 'error');
        this.aliasesLoading.set(false);
      },
    });
  }

  startEditAlias(alias: NvmAlias): void {
    this.editingAlias.set(alias.name);
    this.editAliasTarget = alias.target;
  }

  cancelEditAlias(): void {
    this.editingAlias.set(null);
    this.editAliasTarget = '';
  }

  saveAlias(name: string): void {
    const target = this.editAliasTarget.trim();
    if (!target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.addLog(`Alias '${name}' → '${target}' gesetzt.`, 'success');
        this.editingAlias.set(null);
        this.editAliasTarget = '';
        this.loadAliases();
        if (name === 'default') this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Setzen des Alias '${name}': ${err.message}`, 'error');
      },
    });
  }

  createAlias(): void {
    const name = this.newAliasName.trim();
    const target = this.newAliasTarget.trim();
    if (!name || !target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.addLog(`Alias '${name}' → '${target}' angelegt.`, 'success');
        this.newAliasName = '';
        this.newAliasTarget = '';
        this.loadAliases();
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Anlegen des Alias '${name}': ${err.message}`, 'error');
      },
    });
  }

  deleteAlias(name: string): void {
    if (!confirm(`Alias '${name}' wirklich löschen?`)) return;
    this.nvmApi.deleteAlias(name).subscribe({
      next: () => {
        this.addLog(`Alias '${name}' gelöscht.`, 'success');
        this.loadAliases();
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Löschen des Alias '${name}': ${err.message}`, 'error');
      },
    });
  }

  private addLog(message: string, type: LogEntry['type']): void {
    const trimmed = message.replace(/\s+/g, ' ').trim();
    this.log.update((entries) => [
      { message: trimmed, type, timestamp: new Date() },
      ...entries.slice(0, 19),
    ]);
  }
}
