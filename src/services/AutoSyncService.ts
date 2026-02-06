import { App, TFile, TAbstractFile, Notice, debounce } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type SyncMode = 'off' | 'on-save' | 'on-startup' | 'scheduled';

export interface SyncStatus {
  lastSync: Date | null;
  isRunning: boolean;
  pendingFiles: number;
  error: string | null;
}

export class AutoSyncService {
  private app: App;
  private qmdPath: string;
  private vaultPath: string;
  private collectionName: string;
  private mode: SyncMode;
  private intervalMinutes: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private status: SyncStatus = {
    lastSync: null,
    isRunning: false,
    pendingFiles: 0,
    error: null,
  };
  private pendingChanges: Set<string> = new Set();
  private debouncedSync: () => void;
  private onStatusChange?: (status: SyncStatus) => void;

  constructor(
    app: App,
    qmdPath: string,
    mode: SyncMode = 'off',
    intervalMinutes: number = 10
  ) {
    this.app = app;
    this.qmdPath = qmdPath;
    this.vaultPath = (app.vault.adapter as any).basePath;
    this.collectionName = app.vault.getName();
    this.mode = mode;
    this.intervalMinutes = intervalMinutes;
    
    this.debouncedSync = debounce(() => this.syncPendingChanges(), 5000, true);
  }

  setStatusCallback(callback: (status: SyncStatus) => void): void {
    this.onStatusChange = callback;
  }

  private updateStatus(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    this.onStatusChange?.(this.status);
  }

  async start(): Promise<void> {
    this.stop();
    
    if (this.mode === 'off') return;

    if (this.mode === 'on-startup') {
      await this.fullSync();
    }

    if (this.mode === 'scheduled' && this.intervalMinutes > 0) {
      this.intervalId = setInterval(
        () => this.fullSync(),
        this.intervalMinutes * 60 * 1000
      );
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setMode(mode: SyncMode): void {
    this.mode = mode;
    this.start();
  }

  setInterval(minutes: number): void {
    this.intervalMinutes = minutes;
    if (this.mode === 'scheduled') {
      this.start();
    }
  }

  setQmdPath(path: string): void {
    this.qmdPath = path;
  }

  onFileChange(file: TAbstractFile): void {
    if (this.mode !== 'on-save') return;
    if (!(file instanceof TFile)) return;
    if (file.extension !== 'md') return;

    this.pendingChanges.add(file.path);
    this.updateStatus({ pendingFiles: this.pendingChanges.size });
    this.debouncedSync();
  }

  onFileDelete(file: TAbstractFile): void {
    if (this.mode !== 'on-save') return;
    this.pendingChanges.add('__deleted__');
    this.debouncedSync();
  }

  private async syncPendingChanges(): Promise<void> {
    if (this.status.isRunning) return;
    if (this.pendingChanges.size === 0) return;

    this.pendingChanges.clear();
    await this.incrementalSync();
  }

  async incrementalSync(): Promise<void> {
    if (this.status.isRunning) return;

    this.updateStatus({ isRunning: true, error: null });

    try {
      await execAsync(`"${this.qmdPath}" update`, { timeout: 120000 });
      
      this.updateStatus({
        isRunning: false,
        lastSync: new Date(),
        pendingFiles: 0,
      });

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.updateStatus({ isRunning: false, error });
    }
  }

  async fullSync(showNotice = false): Promise<void> {
    if (this.status.isRunning) return;

    this.updateStatus({ isRunning: true, error: null });

    if (showNotice) {
      new Notice('QMD: Starting sync...');
    }

    try {
      await execAsync(
        `"${this.qmdPath}" collection add "${this.vaultPath}" --name "${this.collectionName}" 2>/dev/null || "${this.qmdPath}" update`,
        { timeout: 300000 }
      );

      this.updateStatus({ lastSync: new Date() });

      if (showNotice) {
        new Notice('QMD: Index updated');
      }

      await this.generateEmbeddings(showNotice);

      this.updateStatus({ isRunning: false, pendingFiles: 0 });

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.updateStatus({ isRunning: false, error });
      
      if (showNotice) {
        new Notice(`QMD sync failed: ${error}`);
      }
    }
  }

  private async generateEmbeddings(showNotice = false): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `"${this.qmdPath}" status`,
        { timeout: 30000 }
      );

      if (stdout.includes('need embedding')) {
        if (showNotice) {
          new Notice('QMD: Generating embeddings (background)...');
        }

        exec(`"${this.qmdPath}" embed`, { timeout: 1800000 });
      }
    } catch {
    }
  }

  async manualSync(): Promise<void> {
    await this.fullSync(true);
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  destroy(): void {
    this.stop();
  }
}
