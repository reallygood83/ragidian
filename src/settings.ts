import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type QmdPlugin from './main';
import { OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS } from './types/settings';

export class QmdSettingTab extends PluginSettingTab {
  plugin: QmdPlugin;

  constructor(app: App, plugin: QmdPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'QMD RAGidian Settings' });

    this.addQmdSettings(containerEl);
    this.addSearchSettings(containerEl);
    this.addRelatedSettings(containerEl);
    this.addLLMSettings(containerEl);
    this.addRAGSettings(containerEl);
  }

  private addQmdSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'qmd Configuration' });

    new Setting(containerEl)
      .setName('qmd Path')
      .setDesc('Path to the qmd executable')
      .addText(text => text
        .setPlaceholder('/usr/local/bin/qmd')
        .setValue(this.plugin.settings.qmdPath)
        .onChange(async (value) => {
          this.plugin.settings.qmdPath = value;
          await this.plugin.saveSettings();
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
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.openaiApiKey)
        .onChange(async (value) => {
          this.plugin.settings.openaiApiKey = value;
          await this.plugin.saveSettings();
        }));

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
      .addText(text => text
        .setPlaceholder('sk-ant-...')
        .setValue(this.plugin.settings.anthropicApiKey)
        .onChange(async (value) => {
          this.plugin.settings.anthropicApiKey = value;
          await this.plugin.saveSettings();
        }));

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
      .addText(text => text
        .setPlaceholder('AIza...')
        .setValue(this.plugin.settings.geminiApiKey)
        .onChange(async (value) => {
          this.plugin.settings.geminiApiKey = value;
          await this.plugin.saveSettings();
        }));

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
