import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import type QmdPlugin from './main';
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS, SyncMode } from './types/settings';
import { QmdInstaller, InstallProgress } from './services/QmdInstaller';

export class QmdSettingTab extends PluginSettingTab {
  plugin: QmdPlugin;
  private installer: QmdInstaller;

  constructor(app: App, plugin: QmdPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.installer = new QmdInstaller();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'QMD RAGidian Settings' });

    this.addQmdSettings(containerEl);
    this.addSyncSettings(containerEl);
    this.addSearchSettings(containerEl);
    this.addRelatedSettings(containerEl);
    this.addLLMSettings(containerEl);
    this.addRAGSettings(containerEl);
  }

  private addQmdSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'qmd Configuration' });

    const statusEl = containerEl.createDiv('qmd-status');
    this.updateQmdStatus(statusEl);

    new Setting(containerEl)
      .setName('qmd Path')
      .setDesc('Path to the qmd executable (auto-detected if empty)')
      .addText(text => text
        .setPlaceholder('Auto-detect')
        .setValue(this.plugin.settings.qmdPath)
        .onChange(async (value) => {
          this.plugin.settings.qmdPath = value;
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('Auto-detect')
        .onClick(async () => {
          button.setButtonText('Searching...');
          button.setDisabled(true);
          
          const path = await this.installer.findQmd();
          
          if (path) {
            this.plugin.settings.qmdPath = path;
            await this.plugin.saveSettings();
            new Notice(`Found qmd at: ${path}`);
            this.display();
          } else {
            new Notice('qmd not found. Click "Install qmd" to install.');
          }
          
          button.setButtonText('Auto-detect');
          button.setDisabled(false);
        }));

    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify qmd is accessible and working')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(async () => {
          button.setButtonText('Testing...');
          button.setDisabled(true);
          
          const result = await this.plugin.qmdClient.testConnection();
          
          if (result.ok) {
            new Notice(`qmd connected! ${result.status?.totalDocuments || 0} documents indexed.`);
          } else {
            new Notice(`qmd connection failed: ${result.error}`);
          }
          
          button.setButtonText('Test');
          button.setDisabled(false);
          this.updateQmdStatus(statusEl);
        }));

    new Setting(containerEl)
      .setName('Install & Setup qmd')
      .setDesc('Automatically install qmd, index your vault, and generate embeddings')
      .addButton(button => button
        .setButtonText('One-Click Setup')
        .setCta()
        .onClick(() => {
          new SetupModal(this.app, this.plugin, this.installer, () => {
            this.display();
          }).open();
        }));

    new Setting(containerEl)
      .setName('Index Current Vault')
      .setDesc('Add this vault to qmd and generate embeddings')
      .addButton(button => button
        .setButtonText('Index Vault')
        .onClick(async () => {
          const qmdPath = this.plugin.settings.qmdPath || await this.installer.findQmd();
          if (!qmdPath) {
            new Notice('qmd not found. Please install qmd first.');
            return;
          }

          new IndexModal(this.app, this.plugin, this.installer, qmdPath, () => {
            this.display();
          }).open();
        }));
  }

  private async updateQmdStatus(statusEl: HTMLElement): Promise<void> {
    statusEl.empty();
    
    const result = await this.plugin.qmdClient.testConnection();
    
    if (result.ok && result.status) {
      statusEl.addClass('qmd-status-ok');
      statusEl.removeClass('qmd-status-error');
      statusEl.innerHTML = `
        <div class="qmd-status-badge">
          <span class="qmd-status-icon">✓</span>
          <span>Connected</span>
        </div>
        <div class="qmd-status-info">
          ${result.status.totalDocuments} documents | 
          ${result.status.totalEmbeddings} embeddings | 
          ${result.status.collections.length} collections
        </div>
      `;
    } else {
      statusEl.addClass('qmd-status-error');
      statusEl.removeClass('qmd-status-ok');
      statusEl.innerHTML = `
        <div class="qmd-status-badge">
          <span class="qmd-status-icon">✗</span>
          <span>Not Connected</span>
        </div>
        <div class="qmd-status-info">
          Click "One-Click Setup" to install and configure qmd
        </div>
      `;
    }
  }

  private addSyncSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Auto Sync' });

    const syncStatus = this.plugin.autoSync.getStatus();
    const statusEl = containerEl.createDiv('qmd-sync-status');
    
    if (syncStatus.lastSync) {
      statusEl.innerHTML = `<span class="qmd-sync-time">Last sync: ${syncStatus.lastSync.toLocaleTimeString()}</span>`;
    } else {
      statusEl.innerHTML = `<span class="qmd-sync-time">Never synced</span>`;
    }

    new Setting(containerEl)
      .setName('Sync Mode')
      .setDesc('When to automatically update the search index')
      .addDropdown(dropdown => dropdown
        .addOption('off', 'Off (Manual only)')
        .addOption('on-save', 'On File Save')
        .addOption('on-startup', 'On Obsidian Startup')
        .addOption('scheduled', 'Scheduled Interval')
        .setValue(this.plugin.settings.syncMode)
        .onChange(async (value: SyncMode) => {
          this.plugin.settings.syncMode = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.syncMode === 'scheduled') {
      new Setting(containerEl)
        .setName('Sync Interval (minutes)')
        .setDesc('How often to sync in the background')
        .addSlider(slider => slider
          .setLimits(5, 60, 5)
          .setValue(this.plugin.settings.syncIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncIntervalMinutes = value;
            await this.plugin.saveSettings();
          }));
    }

    new Setting(containerEl)
      .setName('Sync Now')
      .setDesc('Manually update index and generate new embeddings')
      .addButton(button => button
        .setButtonText('Sync Now')
        .onClick(async () => {
          button.setButtonText('Syncing...');
          button.setDisabled(true);
          
          await this.plugin.autoSync.manualSync();
          
          button.setButtonText('Sync Now');
          button.setDisabled(false);
          this.display();
        }));
  }

  private addSearchSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Search Settings' });

    new Setting(containerEl)
      .setName('Default Search Mode')
      .setDesc('Default search mode when opening the search panel')
      .addDropdown(dropdown => dropdown
        .addOption('search', 'Keyword (BM25)')
        .addOption('vsearch', 'Semantic (Vector)')
        .addOption('query', 'Hybrid (Best)')
        .setValue(this.plugin.settings.defaultSearchMode)
        .onChange(async (value: 'search' | 'vsearch' | 'query') => {
          this.plugin.settings.defaultSearchMode = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default Result Count')
      .setDesc('Number of results to show by default')
      .addSlider(slider => slider
        .setLimits(5, 50, 5)
        .setValue(this.plugin.settings.defaultLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.defaultLimit = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Minimum Score')
      .setDesc('Filter results below this relevance score (0-1)')
      .addSlider(slider => slider
        .setLimits(0, 0.9, 0.1)
        .setValue(this.plugin.settings.minScore)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.minScore = value;
          await this.plugin.saveSettings();
        }));
  }

  private addRelatedSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Related Documents' });

    new Setting(containerEl)
      .setName('Enable Auto-Recommend')
      .setDesc('Automatically show related documents when opening a note')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableRelated)
        .onChange(async (value) => {
          this.plugin.settings.enableRelated = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Number of Recommendations')
      .setDesc('How many related documents to show')
      .addSlider(slider => slider
        .setLimits(3, 10, 1)
        .setValue(this.plugin.settings.relatedLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.relatedLimit = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Cache Duration (minutes)')
      .setDesc('How long to cache related document results')
      .addSlider(slider => slider
        .setLimits(1, 30, 1)
        .setValue(this.plugin.settings.relatedCacheTTL)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.relatedCacheTTL = value;
          await this.plugin.saveSettings();
        }));
  }

  private addLLMSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'LLM Configuration (for RAG Chat)' });

    new Setting(containerEl)
      .setName('LLM Provider')
      .setDesc('Select the LLM provider for RAG chat')
      .addDropdown(dropdown => dropdown
        .addOption('none', 'None (Disable RAG)')
        .addOption('openai', 'OpenAI')
        .addOption('anthropic', 'Anthropic')
        .addOption('gemini', 'Google Gemini')
        .addOption('ollama', 'Ollama (Local)')
        .setValue(this.plugin.settings.llmProvider)
        .onChange(async (value: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'none') => {
          this.plugin.settings.llmProvider = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.llmProvider === 'openai') {
      this.addOpenAISettings(containerEl);
    }

    if (this.plugin.settings.llmProvider === 'anthropic') {
      this.addAnthropicSettings(containerEl);
    }

    if (this.plugin.settings.llmProvider === 'gemini') {
      this.addGeminiSettings(containerEl);
    }

    if (this.plugin.settings.llmProvider === 'ollama') {
      this.addOllamaSettings(containerEl);
    }
  }

  private addOpenAISettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Your OpenAI API key')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Use Custom Model Name')
      .setDesc('Enable to manually specify model name')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useOpenaiCustomModel)
        .onChange(async (value) => {
          this.plugin.settings.useOpenaiCustomModel = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.useOpenaiCustomModel) {
      new Setting(containerEl)
        .setName('Custom Model Name')
        .setDesc('Enter the exact model name (e.g., gpt-5.2)')
        .addText(text => text
          .setPlaceholder('gpt-5.2')
          .setValue(this.plugin.settings.openaiCustomModel)
          .onChange(async (value) => {
            this.plugin.settings.openaiCustomModel = value;
            await this.plugin.saveSettings();
          }));
    } else {
      new Setting(containerEl)
        .setName('OpenAI Model')
        .setDesc('Select a model')
        .addDropdown(dropdown => {
          OPENAI_MODELS.forEach(m => dropdown.addOption(m.value, m.label));
          dropdown.setValue(this.plugin.settings.openaiModel);
          dropdown.onChange(async (value) => {
            this.plugin.settings.openaiModel = value;
            await this.plugin.saveSettings();
          });
        });
    }
  }

  private addAnthropicSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Your Anthropic API key')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Use Custom Model Name')
      .setDesc('Enable to manually specify model name')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useAnthropicCustomModel)
        .onChange(async (value) => {
          this.plugin.settings.useAnthropicCustomModel = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.useAnthropicCustomModel) {
      new Setting(containerEl)
        .setName('Custom Model Name')
        .setDesc('Enter the exact model name')
        .addText(text => text
          .setPlaceholder('claude-opus-4-6-20260205')
          .setValue(this.plugin.settings.anthropicCustomModel)
          .onChange(async (value) => {
            this.plugin.settings.anthropicCustomModel = value;
            await this.plugin.saveSettings();
          }));
    } else {
      new Setting(containerEl)
        .setName('Anthropic Model')
        .setDesc('Select a model')
        .addDropdown(dropdown => {
          ANTHROPIC_MODELS.forEach(m => dropdown.addOption(m.value, m.label));
          dropdown.setValue(this.plugin.settings.anthropicModel);
          dropdown.onChange(async (value) => {
            this.plugin.settings.anthropicModel = value;
            await this.plugin.saveSettings();
          });
        });
    }
  }

  private addGeminiSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Gemini API Key')
      .setDesc('Your Google AI API key (from ai.google.dev)')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('AIza...')
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Use Custom Model Name')
      .setDesc('Enable to manually specify model name')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useGeminiCustomModel)
        .onChange(async (value) => {
          this.plugin.settings.useGeminiCustomModel = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.useGeminiCustomModel) {
      new Setting(containerEl)
        .setName('Custom Model Name')
        .setDesc('Enter the exact model name')
        .addText(text => text
          .setPlaceholder('gemini-2.5-flash')
          .setValue(this.plugin.settings.geminiCustomModel)
          .onChange(async (value) => {
            this.plugin.settings.geminiCustomModel = value;
            await this.plugin.saveSettings();
          }));
    } else {
      new Setting(containerEl)
        .setName('Gemini Model')
        .setDesc('Select a model')
        .addDropdown(dropdown => {
          GEMINI_MODELS.forEach(m => dropdown.addOption(m.value, m.label));
          dropdown.setValue(this.plugin.settings.geminiModel);
          dropdown.onChange(async (value) => {
            this.plugin.settings.geminiModel = value;
            await this.plugin.saveSettings();
          });
        });
    }
  }

  private addOllamaSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Ollama URL')
      .setDesc('URL of your Ollama instance')
      .addText(text => text
        .setPlaceholder('http://localhost:11434')
        .setValue(this.plugin.settings.ollamaUrl)
        .onChange(async (value) => {
          this.plugin.settings.ollamaUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Ollama Model')
      .setDesc('Model name (e.g., llama3.2, mistral, codellama)')
      .addText(text => text
        .setPlaceholder('llama3.2')
        .setValue(this.plugin.settings.ollamaModel)
        .onChange(async (value) => {
          this.plugin.settings.ollamaModel = value;
          await this.plugin.saveSettings();
        }));
  }

  private addRAGSettings(containerEl: HTMLElement): void {
    if (this.plugin.settings.llmProvider === 'none') return;

    containerEl.createEl('h3', { text: 'RAG Settings' });

    new Setting(containerEl)
      .setName('Context Documents')
      .setDesc('Number of documents to include as context')
      .addSlider(slider => slider
        .setLimits(1, 15, 1)
        .setValue(this.plugin.settings.ragContextLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.ragContextLimit = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('System Prompt')
      .setDesc('Instructions for the AI assistant')
      .addTextArea(text => text
        .setPlaceholder('You are a helpful assistant...')
        .setValue(this.plugin.settings.ragSystemPrompt)
        .onChange(async (value) => {
          this.plugin.settings.ragSystemPrompt = value;
          await this.plugin.saveSettings();
        }));
  }
}

class SetupModal extends Modal {
  private plugin: QmdPlugin;
  private installer: QmdInstaller;
  private onComplete: () => void;
  private progressEl: HTMLElement | null = null;
  private isRunning = false;

  constructor(app: App, plugin: QmdPlugin, installer: QmdInstaller, onComplete: () => void) {
    super(app);
    this.plugin = plugin;
    this.installer = installer;
    this.onComplete = onComplete;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('qmd-setup-modal');

    contentEl.createEl('h2', { text: 'QMD One-Click Setup' });
    
    contentEl.createEl('p', { 
      text: 'This will install qmd, index your current vault, and generate embeddings for semantic search.'
    });

    const warningEl = contentEl.createDiv('qmd-setup-warning');
    warningEl.innerHTML = `
      <strong>Note:</strong> This process may take several minutes depending on your vault size.
      <ul>
        <li>Installing qmd (~250MB of models will be downloaded)</li>
        <li>Indexing all markdown files in your vault</li>
        <li>Generating vector embeddings</li>
      </ul>
    `;

    this.progressEl = contentEl.createDiv('qmd-setup-progress');
    this.progressEl.style.display = 'none';

    const buttonContainer = contentEl.createDiv('qmd-setup-buttons');
    
    const startButton = buttonContainer.createEl('button', { text: 'Start Setup', cls: 'mod-cta' });
    startButton.addEventListener('click', () => this.runSetup(startButton));

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => this.close());
  }

  private async runSetup(button: HTMLButtonElement) {
    if (this.isRunning) return;
    this.isRunning = true;
    button.disabled = true;
    button.textContent = 'Setting up...';

    if (this.progressEl) {
      this.progressEl.style.display = 'block';
    }

    const vaultPath = (this.app.vault.adapter as any).basePath;
    const vaultName = this.app.vault.getName();

    try {
      const qmdPath = await this.installer.fullSetup(
        vaultPath,
        vaultName,
        (progress) => this.updateProgress(progress)
      );

      this.plugin.settings.qmdPath = qmdPath;
      await this.plugin.saveSettings();

      new Notice('QMD setup complete! You can now search your vault.');
      this.onComplete();
      this.close();

    } catch (e) {
      new Notice(`Setup failed: ${e instanceof Error ? e.message : String(e)}`);
      button.disabled = false;
      button.textContent = 'Retry Setup';
      this.isRunning = false;
    }
  }

  private updateProgress(progress: InstallProgress) {
    if (!this.progressEl) return;

    const stageIcons: Record<string, string> = {
      checking: '🔍',
      installing: '📦',
      indexing: '📚',
      embedding: '🧠',
      complete: '✅',
      error: '❌',
    };

    this.progressEl.innerHTML = `
      <div class="qmd-progress-stage">
        <span class="qmd-progress-icon">${stageIcons[progress.stage]}</span>
        <span class="qmd-progress-message">${progress.message}</span>
      </div>
      ${progress.progress !== undefined ? `
        <div class="qmd-progress-bar">
          <div class="qmd-progress-fill" style="width: ${progress.progress}%"></div>
        </div>
      ` : ''}
    `;
  }

  onClose() {
    this.contentEl.empty();
  }
}

class IndexModal extends Modal {
  private plugin: QmdPlugin;
  private installer: QmdInstaller;
  private qmdPath: string;
  private onComplete: () => void;
  private progressEl: HTMLElement | null = null;

  constructor(app: App, plugin: QmdPlugin, installer: QmdInstaller, qmdPath: string, onComplete: () => void) {
    super(app);
    this.plugin = plugin;
    this.installer = installer;
    this.qmdPath = qmdPath;
    this.onComplete = onComplete;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: 'Index Vault' });

    const vaultPath = (this.app.vault.adapter as any).basePath;
    const vaultName = this.app.vault.getName();

    contentEl.createEl('p', { 
      text: `This will index "${vaultName}" and generate embeddings.`
    });

    this.progressEl = contentEl.createDiv('qmd-setup-progress');

    const buttonContainer = contentEl.createDiv('qmd-setup-buttons');
    
    const startButton = buttonContainer.createEl('button', { text: 'Start Indexing', cls: 'mod-cta' });
    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      startButton.textContent = 'Indexing...';

      try {
        await this.installer.indexVault(this.qmdPath, vaultPath, vaultName, (p) => {
          if (this.progressEl) this.progressEl.textContent = p.message;
        });

        await this.installer.generateEmbeddings(this.qmdPath, (p) => {
          if (this.progressEl) this.progressEl.textContent = p.message;
        });

        new Notice('Indexing complete!');
        this.onComplete();
        this.close();

      } catch (e) {
        new Notice(`Indexing failed: ${e instanceof Error ? e.message : String(e)}`);
        startButton.disabled = false;
        startButton.textContent = 'Retry';
      }
    });

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}
