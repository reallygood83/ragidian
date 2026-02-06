import { Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { QmdClient } from './services/QmdClient';
import { CacheService } from './services/CacheService';
import { createLLMProvider, LLMProvider } from './services/LLMService';
import { AutoSyncService } from './services/AutoSyncService';
import { QmdSidebarView, VIEW_TYPE_QMD } from './views/QmdSidebarView';
import { QmdSettingTab } from './settings';
import { QmdSettings, DEFAULT_SETTINGS } from './types/settings';
import type { QmdSearchResult, QmdResultItem } from './types';
import { debounce } from './utils/debounce';

export default class QmdPlugin extends Plugin {
  settings: QmdSettings = DEFAULT_SETTINGS;
  qmdClient: QmdClient;
  llmProvider: LLMProvider | null = null;
  relatedCache: CacheService<QmdSearchResult>;
  autoSync: AutoSyncService;
  
  private debouncedUpdateRelated: (file: TFile) => void;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.qmdClient = new QmdClient(this.settings.qmdPath);
    this.llmProvider = createLLMProvider(this.settings);
    this.relatedCache = new CacheService(this.settings.relatedCacheTTL * 60 * 1000);

    this.autoSync = new AutoSyncService(
      this.app,
      this.settings.qmdPath,
      this.settings.syncMode,
      this.settings.syncIntervalMinutes
    );

    this.debouncedUpdateRelated = debounce(
      (file: TFile) => this.updateRelatedForFile(file),
      this.settings.relatedDebounceMs
    );

    this.registerView(
      VIEW_TYPE_QMD,
      (leaf) => new QmdSidebarView(leaf, this)
    );

    this.addRibbonIcon('search', 'QMD Search', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-qmd-search',
      name: 'Open QMD Search',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'search-selection',
      name: 'Search Selection in QMD',
      editorCallback: async (editor) => {
        const selection = editor.getSelection();
        if (selection) {
          await this.activateView();
          const view = this.getQmdView();
          if (view) {
            (view as any).searchInput.value = selection;
            (view as any).executeSearch();
          }
        }
      },
    });

    this.addCommand({
      id: 'sync-now',
      name: 'Sync Index Now',
      callback: () => this.autoSync.manualSync(),
    });

    this.addSettingTab(new QmdSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on('modify', (file) => this.autoSync.onFileChange(file))
    );
    this.registerEvent(
      this.app.vault.on('create', (file) => this.autoSync.onFileChange(file))
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => this.autoSync.onFileDelete(file))
    );
    this.registerEvent(
      this.app.vault.on('rename', (file) => this.autoSync.onFileChange(file))
    );

    if (this.settings.enableRelated) {
      this.registerEvent(
        this.app.workspace.on('file-open', (file) => {
          if (file instanceof TFile && file.extension === 'md') {
            this.debouncedUpdateRelated(file);
          }
        })
      );

      this.registerEvent(
        this.app.workspace.on('active-leaf-change', () => {
          const file = this.app.workspace.getActiveFile();
          if (file instanceof TFile && file.extension === 'md') {
            this.debouncedUpdateRelated(file);
          }
        })
      );
    }

    this.autoSync.start();
  }

  async onunload(): Promise<void> {
    this.autoSync.destroy();
    this.relatedCache.destroy();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_QMD);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.qmdClient.setPath(this.settings.qmdPath);
    this.llmProvider = createLLMProvider(this.settings);
    this.relatedCache = new CacheService(this.settings.relatedCacheTTL * 60 * 1000);
    
    this.autoSync.setQmdPath(this.settings.qmdPath);
    this.autoSync.setMode(this.settings.syncMode);
    this.autoSync.setInterval(this.settings.syncIntervalMinutes);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_QMD)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({
          type: VIEW_TYPE_QMD,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  getQmdView(): QmdSidebarView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_QMD);
    if (leaves.length > 0) {
      return leaves[0].view as QmdSidebarView;
    }
    return null;
  }

  private async updateRelatedForFile(file: TFile): Promise<void> {
    const view = this.getQmdView();
    if (view) {
      await view.updateRelatedDocuments(file);
    }
  }

  async chat(question: string, context: string, sources: QmdResultItem[]): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured. Go to Settings > QMD RAGidian.');
    }

    const systemPrompt = this.settings.ragSystemPrompt.replace('{context}', context);

    const messages = [
      { role: 'system' as const, content: `${systemPrompt}\n\nContext:\n${context}` },
      { role: 'user' as const, content: question },
    ];

    return await this.llmProvider.chat(messages);
  }
}
