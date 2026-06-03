import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NvmApiService } from './nvm-api.service';
import type {
  InstallModalState,
  LogEntry,
  LogEvent,
  NvmCommandResult,
} from '../models/nvm.models';

@Injectable({ providedIn: 'root' })
export class NvmStateService {
  private readonly nvmApi = inject(NvmApiService);

  readonly log = signal<LogEntry[]>([]);
  readonly isLoading = signal(false);
  readonly installModal = signal<InstallModalState>(null);
  readonly prefillVersion = signal('');
  readonly aliasesRefreshTrigger = signal(0);

  private readonly installedResource = rxResource({
    stream: () => this.nvmApi.getInstalledVersions(),
  });

  readonly installedVersions = computed(() =>
    this.installedResource.hasValue() ? (this.installedResource.value()?.versions ?? []) : [],
  );
  readonly installedRaw = computed(() =>
    this.installedResource.hasValue() ? (this.installedResource.value()?.stdout ?? '') : '',
  );
  readonly installedLoading = this.installedResource.isLoading;

  readonly activeVersion = computed(() => this.installedVersions().find((v) => v.active));

  constructor() {
    effect(() => {
      const err = this.installedResource.error();
      if (err) {
        this.addLog(
          'Fehler beim Laden der installierten Versionen: ' + (err as Error).message,
          'error',
        );
      }
    });
  }

  loadInstalledVersions(): void {
    this.installedResource.reload();
  }

  onInstall(version: string): void {
    this.isLoading.set(true);
    this.installModal.set({ action: 'install', phase: 'running', version });
    this.addLog(`Installiere Node ${version} ...`, 'info');
    this.nvmApi.installVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} installiert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'install', phase: 'success', version });
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler bei Installation von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'install', phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  onUseFromList(version: string): void {
    this.prefillVersion.set(version);
    this.isLoading.set(true);
    this.installModal.set({ action: 'use', phase: 'running', version });
    this.addLog(`Aktiviere Node ${version} ...`, 'info');
    this.nvmApi.useVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} aktiviert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'use', phase: 'success', version });
        this.loadInstalledVersions();
        this.aliasesRefreshTrigger.update((n) => n + 1);
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Aktivieren von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'use', phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  onUse(version: string): void {
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

  onSetDefault(version: string): void {
    this.isLoading.set(true);
    this.addLog(`Setze Node ${version} als Default ...`, 'info');
    this.nvmApi.setDefaultVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} als Default gesetzt. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.loadInstalledVersions();
        this.aliasesRefreshTrigger.update((n) => n + 1);
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Setzen des Defaults für ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
      },
    });
  }

  onUninstall(version: string): void {
    this.isLoading.set(true);
    this.installModal.set({ action: 'uninstall', phase: 'running', version });
    this.addLog(`Deinstalliere Node ${version} ...`, 'info');
    this.nvmApi.uninstallVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} deinstalliert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'uninstall', phase: 'success', version });
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler bei Deinstallation von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'uninstall', phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  onNvmUpdate(targetVersion: string): void {
    this.isLoading.set(true);
    this.installModal.set({ action: 'nvm-update', phase: 'running', version: targetVersion });
    this.addLog(`Aktualisiere nvm auf ${targetVersion} ...`, 'info');
    this.nvmApi.updateNvm().subscribe({
      next: () => {
        this.addLog(`nvm wurde auf ${targetVersion} aktualisiert.`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'nvm-update', phase: 'success', version: targetVersion });
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Aktualisieren von nvm: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'nvm-update', phase: 'error', version: targetVersion, errorMessage: err.message });
      },
    });
  }

  closeInstallModal(): void {
    this.installModal.set(null);
  }

  onLogged(event: LogEvent): void {
    this.addLog(event.message, event.type);
  }

  private addLog(message: string, type: LogEntry['type']): void {
    const trimmed = message.replace(/\s+/g, ' ').trim();
    this.log.update((entries) => [
      { message: trimmed, type, timestamp: new Date() },
      ...entries.slice(0, 19),
    ]);
  }
}
