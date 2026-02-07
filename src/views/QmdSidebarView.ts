import { ItemView, WorkspaceLeaf, setIcon, TFile } from 'obsidian';
import type QmdPlugin from '../main';
import type { QmdResultItem, QmdSearchResult, ChatMessage } from '../types';
import { debounce } from '../utils/debounce';

export const VIEW_TYPE_QMD = 'qmd-sidebar';

export class QmdSidebarView extends ItemView {
  plugin: QmdPlugin;
  private searchInput: HTMLInputElement | null = null;
  private resultsContainer: HTMLElement | null = null;
  private relatedContainer: HTMLElement | null = null;
  private chatContainer: HTMLElement | null = null;
  private chatInput: HTMLTextAreaElement | null = null;
  private chatMessages: ChatMessage[] = [];
  private currentMode: 'search' | 'vsearch' | 'query' = 'query';
  private isSearching = false;
  private currentFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: QmdPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentMode = plugin.settings.defaultSearchMode;
  }

  getViewType(): string {
    return VIEW_TYPE_QMD;
  }

  getDisplayText(): string {
    return 'QMD Search';
  }

  getIcon(): string {
    return 'search';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('qmd-sidebar');

    this.renderHeader(container);
    this.renderSearchPanel(container);
    this.renderResultsPanel(container);
    this.renderChatPanel(container);
    this.renderRelatedPanel(container);
  }

  async onClose(): Promise<void> {
    this.searchInput = null;
    this.resultsContainer = null;
    this.relatedContainer = null;
    this.chatContainer = null;
    this.chatInput = null;
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv('qmd-header');
    
    const title = header.createEl('h4', { text: 'QMD Search' });
    title.addClass('qmd-title');

    const settingsBtn = header.createEl('button', { cls: 'qmd-settings-btn clickable-icon' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.addEventListener('click', () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById('qmd-ragidian');
    });
  }

  private renderSearchPanel(container: HTMLElement): void {
    const searchPanel = container.createDiv('qmd-search-panel');

    const inputWrapper = searchPanel.createDiv('qmd-input-wrapper');
    this.searchInput = inputWrapper.createEl('input', {
      type: 'text',
      placeholder: 'Search your notes...',
      cls: 'qmd-search-input',
    });

    const searchBtn = inputWrapper.createEl('button', { cls: 'qmd-search-btn clickable-icon' });
    setIcon(searchBtn, 'search');
    searchBtn.addEventListener('click', () => this.executeSearch());

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeSearch();
      }
    });

    const debouncedSearch = debounce(() => this.executeSearch(), 300);
    this.searchInput.addEventListener('input', debouncedSearch);

    const modeSelector = searchPanel.createDiv('qmd-mode-selector');
    this.renderModeButtons(modeSelector);

    const collectionSelector = searchPanel.createDiv('qmd-collection-selector');
    this.renderCollectionDropdown(collectionSelector);
  }

  private renderModeButtons(container: HTMLElement): void {
    const modes: { id: 'search' | 'vsearch' | 'query'; label: string; icon: string }[] = [
      { id: 'search', label: 'Keyword', icon: 'file-text' },
      { id: 'vsearch', label: 'Semantic', icon: 'brain' },
      { id: 'query', label: 'Hybrid', icon: 'sparkles' },
    ];

    modes.forEach(mode => {
      const btn = container.createEl('button', {
        text: mode.label,
        cls: `qmd-mode-btn ${mode.id === this.currentMode ? 'active' : ''}`,
      });
      btn.dataset.mode = mode.id;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.qmd-mode-btn').forEach(b => b.removeClass('active'));
        btn.addClass('active');
        this.currentMode = mode.id;
        if (this.searchInput?.value) {
          this.executeSearch();
        }
      });
    });
  }

  private async renderCollectionDropdown(container: HTMLElement): Promise<void> {
    const label = container.createEl('span', { text: 'Collection: ', cls: 'qmd-collection-label' });
    const select = container.createEl('select', { cls: 'qmd-collection-select' });
    
    select.createEl('option', { value: '', text: 'All' });

    try {
      const collections = await this.plugin.qmdClient.getCollections();
      collections.forEach(name => {
        select.createEl('option', { value: name, text: name });
      });
    } catch (e) {
      console.warn('Failed to load collections:', e);
    }
  }

  private renderResultsPanel(container: HTMLElement): void {
    const resultsPanel = container.createDiv('qmd-results-panel');
    
    const header = resultsPanel.createDiv('qmd-results-header');
    header.createEl('span', { text: 'Results', cls: 'qmd-results-title' });
    
    const refreshBtn = header.createEl('button', { cls: 'qmd-refresh-btn clickable-icon' });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => this.executeSearch());

    this.resultsContainer = resultsPanel.createDiv('qmd-results-list');
    this.resultsContainer.createEl('div', { 
      text: 'Enter a search query above',
      cls: 'qmd-results-empty'
    });
  }

  private renderChatPanel(container: HTMLElement): void {
    if (this.plugin.settings.llmProvider === 'none') return;

    const chatPanel = container.createDiv('qmd-chat-panel');
    
    const header = chatPanel.createDiv('qmd-chat-header');
    header.createEl('span', { text: 'RAG Chat', cls: 'qmd-chat-title' });
    
    const collapseBtn = header.createEl('button', { cls: 'qmd-collapse-btn clickable-icon' });
    setIcon(collapseBtn, 'chevron-down');
    collapseBtn.addEventListener('click', () => {
      chatPanel.toggleClass('collapsed', !chatPanel.hasClass('collapsed'));
      setIcon(collapseBtn, chatPanel.hasClass('collapsed') ? 'chevron-right' : 'chevron-down');
    });

    this.chatContainer = chatPanel.createDiv('qmd-chat-messages');

    const inputWrapper = chatPanel.createDiv('qmd-chat-input-wrapper');
    this.chatInput = inputWrapper.createEl('textarea', {
      placeholder: 'Ask a question about your notes...',
      cls: 'qmd-chat-input',
    });
    
    const sendBtn = inputWrapper.createEl('button', { cls: 'qmd-chat-send clickable-icon' });
    setIcon(sendBtn, 'send');
    sendBtn.addEventListener('click', () => this.sendChatMessage());

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
  }

  private renderRelatedPanel(container: HTMLElement): void {
    const relatedPanel = container.createDiv('qmd-related-panel');
    
    const header = relatedPanel.createDiv('qmd-related-header');
    header.createEl('span', { text: 'Related Documents', cls: 'qmd-related-title' });
    
    const collapseBtn = header.createEl('button', { cls: 'qmd-collapse-btn clickable-icon' });
    setIcon(collapseBtn, 'chevron-down');
    collapseBtn.addEventListener('click', () => {
      relatedPanel.toggleClass('collapsed', !relatedPanel.hasClass('collapsed'));
      setIcon(collapseBtn, relatedPanel.hasClass('collapsed') ? 'chevron-right' : 'chevron-down');
    });

    this.relatedContainer = relatedPanel.createDiv('qmd-related-list');
    this.relatedContainer.createEl('div', { 
      text: 'Open a note to see related documents',
      cls: 'qmd-related-empty'
    });
  }

  private async executeSearch(): Promise<void> {
    const query = this.searchInput?.value?.trim();
    if (!query || this.isSearching) return;

    this.isSearching = true;
    this.showSearchLoading();

    try {
      const collectionSelect = this.containerEl.querySelector('.qmd-collection-select') as HTMLSelectElement;
      const collection = collectionSelect?.value || undefined;

      let result: QmdSearchResult;
      const options = {
        collection,
        limit: this.plugin.settings.defaultLimit,
        minScore: this.plugin.settings.minScore,
      };

      switch (this.currentMode) {
        case 'search':
          result = await this.plugin.qmdClient.search(query, options);
          break;
        case 'vsearch':
          result = await this.plugin.qmdClient.vsearch(query, options);
          break;
        case 'query':
        default:
          result = await this.plugin.qmdClient.query(query, options);
          break;
      }

      this.renderResults(result);
    } catch (e) {
      this.showSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      this.isSearching = false;
    }
  }

  private showSearchLoading(): void {
    if (!this.resultsContainer) return;
    this.resultsContainer.empty();
    const loading = this.resultsContainer.createDiv('qmd-loading');
    loading.createEl('span', { text: 'Searching...', cls: 'qmd-loading-text' });
  }

  private showSearchError(message: string): void {
    if (!this.resultsContainer) return;
    this.resultsContainer.empty();
    const error = this.resultsContainer.createDiv('qmd-error');
    setIcon(error.createSpan(), 'alert-circle');
    error.createEl('span', { text: message, cls: 'qmd-error-text' });
  }

  private renderResults(result: QmdSearchResult): void {
    if (!this.resultsContainer) return;
    this.resultsContainer.empty();

    if (result.results.length === 0) {
      this.resultsContainer.createEl('div', { 
        text: 'No results found',
        cls: 'qmd-results-empty'
      });
      return;
    }

    const header = this.resultsContainer.createDiv('qmd-results-count');
    header.createEl('span', { text: `${result.results.length} results (${result.elapsed}ms)` });

    result.results.forEach(item => {
      this.renderResultItem(this.resultsContainer!, item);
    });
  }

  private renderResultItem(container: HTMLElement, item: QmdResultItem): void {
    const card = container.createDiv('qmd-result-card');
    card.addEventListener('click', (e) => {
      const newTab = e.metaKey || e.ctrlKey;
      this.openDocument(item, newTab);
    });

    const header = card.createDiv('qmd-result-header');
    setIcon(header.createSpan('qmd-result-icon'), 'file-text');
    header.createEl('span', { text: item.title, cls: 'qmd-result-title' });
    
    const score = Math.round(item.score * 100);
    const scoreClass = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
    header.createEl('span', { 
      text: `${score}%`, 
      cls: `qmd-result-score qmd-score-${scoreClass}` 
    });

    if (item.snippet) {
      card.createEl('div', { 
        text: item.snippet.substring(0, 150) + (item.snippet.length > 150 ? '...' : ''),
        cls: 'qmd-result-snippet'
      });
    }

    if (item.context) {
      card.createEl('div', { 
        text: item.context,
        cls: 'qmd-result-context'
      });
    }
  }

  private async openDocument(item: QmdResultItem, newTab: boolean): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(item.path);
    
    if (file instanceof TFile) {
      const leaf = newTab 
        ? this.app.workspace.getLeaf('tab')
        : this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      return;
    }
    
    const pathWithExt = item.path.endsWith('.md') ? item.path : item.path + '.md';
    const fileWithExt = this.app.vault.getAbstractFileByPath(pathWithExt);
    
    if (fileWithExt instanceof TFile) {
      const leaf = newTab 
        ? this.app.workspace.getLeaf('tab')
        : this.app.workspace.getLeaf(false);
      await leaf.openFile(fileWithExt);
      return;
    }
    
    console.warn('[QMD] File not found:', item.path);
    this.app.workspace.openLinkText(item.path, '', newTab ? 'tab' : false);
  }

  async updateRelatedDocuments(file: TFile): Promise<void> {
    if (!this.plugin.settings.enableRelated || !this.relatedContainer) return;
    if (file === this.currentFile) return;

    this.currentFile = file;

    const cacheKey = file.path;
    const cached = this.plugin.relatedCache.get(cacheKey);
    if (cached) {
      this.renderRelatedResults(cached);
      return;
    }

    this.relatedContainer.empty();
    this.relatedContainer.createEl('div', { text: 'Loading...', cls: 'qmd-related-loading' });

    try {
      const content = await this.app.vault.cachedRead(file);
      const query = `${file.basename} ${content.substring(0, 300)}`;
      
      const result = await this.plugin.qmdClient.vsearch(query, {
        limit: this.plugin.settings.relatedLimit + 1,
        minScore: 0.3,
      });

      const filtered = result.results.filter(r => r.path !== file.path);
      const limited = { ...result, results: filtered.slice(0, this.plugin.settings.relatedLimit) };
      
      this.plugin.relatedCache.set(cacheKey, limited);
      this.renderRelatedResults(limited);
    } catch (e) {
      this.relatedContainer.empty();
      this.relatedContainer.createEl('div', { 
        text: 'Failed to load related documents',
        cls: 'qmd-related-error'
      });
    }
  }

  private renderRelatedResults(result: QmdSearchResult): void {
    if (!this.relatedContainer) return;
    this.relatedContainer.empty();

    if (result.results.length === 0) {
      this.relatedContainer.createEl('div', { 
        text: 'No related documents found',
        cls: 'qmd-related-empty'
      });
      return;
    }

    result.results.forEach(item => {
      const row = this.relatedContainer!.createDiv('qmd-related-item');
      row.addEventListener('click', () => this.openDocument(item, false));

      row.createEl('span', { text: item.title, cls: 'qmd-related-title' });
      
      const score = Math.round(item.score * 100);
      row.createEl('span', { text: `${score}%`, cls: 'qmd-related-score' });
    });
  }

  private async sendChatMessage(): Promise<void> {
    const question = this.chatInput?.value?.trim();
    if (!question || !this.chatContainer) return;

    this.chatInput!.value = '';

    this.addChatMessage({ role: 'user', content: question });
    this.addChatMessage({ role: 'assistant', content: 'Thinking...' });

    try {
      const searchResult = await this.plugin.qmdClient.vsearch(question, {
        limit: this.plugin.settings.ragContextLimit,
        minScore: 0.3,
      });

      const context = searchResult.results
        .map(r => `### ${r.title}\n${r.snippet}`)
        .join('\n\n');

      const answer = await this.plugin.chat(question, context, searchResult.results);
      
      this.chatMessages.pop();
      this.addChatMessage({ 
        role: 'assistant', 
        content: answer,
        sources: searchResult.results
      });
    } catch (e) {
      this.chatMessages.pop();
      this.addChatMessage({ 
        role: 'assistant', 
        content: `Error: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  }

  private addChatMessage(message: ChatMessage): void {
    if (!this.chatContainer) return;

    this.chatMessages.push(message);

    if (message.content === 'Thinking...') {
      const existing = this.chatContainer.querySelector('.qmd-chat-thinking');
      if (existing) existing.remove();
    }

    const msgEl = this.chatContainer.createDiv(`qmd-chat-message qmd-chat-${message.role}`);
    
    const roleIcon = message.role === 'user' ? 'user' : 'bot';
    setIcon(msgEl.createSpan('qmd-chat-icon'), roleIcon);
    
    const contentEl = msgEl.createDiv('qmd-chat-content');
    contentEl.setText(message.content);

    if (message.content === 'Thinking...') {
      msgEl.addClass('qmd-chat-thinking');
    }

    if (message.sources && message.sources.length > 0) {
      const sourcesEl = msgEl.createDiv('qmd-chat-sources');
      sourcesEl.createEl('span', { text: 'Sources: ', cls: 'qmd-chat-sources-label' });
      message.sources.forEach(source => {
        const link = sourcesEl.createEl('a', { 
          text: source.title,
          cls: 'qmd-chat-source-link'
        });
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.openDocument(source, false);
        });
      });
    }

    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }
}
