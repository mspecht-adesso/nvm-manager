import { Injectable, computed, inject, signal } from '@angular/core';
import { NvmApiService } from './nvm-api.service';
import type {
  InstalledNodeVersion,
  InstalledVersionsResponse,
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
  readonly installedVersions = signal<InstalledNodeVersion[]>([]);
  readonly installedRaw = signal('');
  readonly installedLoading = signal(false);
  readonly installModal = signal<InstallModalState>(null);
  readonly prefillVersion = signal('');
  readonly aliasesRefreshTrigger = signal(0);

  readonly activeVersion = computed(() => this.installedVersions().find((v) => v.active));

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
