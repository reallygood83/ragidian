import { exec } from 'child_process';
import { promisify } from 'util';
import type { QmdSearchResult, QmdDocument, QmdStatus, SearchOptions, QmdError, QmdResultItem } from '../types';

const execAsync = promisify(exec);

export class QmdClient {
  constructor(private qmdPath: string) {}

  /**
   * Update the qmd path
   */
  setPath(path: string): void {
    this.qmdPath = path;
  }

  /**
   * BM25 keyword search
   */
  async search(query: string, options: SearchOptions = {}): Promise<QmdSearchResult> {
    const args = this.buildArgs('search', query, options);
    const result = await this.execute(args);
    return { ...result, mode: 'search' };
  }

  /**
   * Vector semantic search
   */
  async vsearch(query: string, options: SearchOptions = {}): Promise<QmdSearchResult> {
    const args = this.buildArgs('vsearch', query, options);
    const result = await this.execute(args);
    return { ...result, mode: 'vsearch' };
  }

  /**
   * Hybrid search with reranking (best quality)
   */
  async query(query: string, options: SearchOptions = {}): Promise<QmdSearchResult> {
    const args = this.buildArgs('query', query, options);
    const result = await this.execute(args);
    return { ...result, mode: 'query' };
  }

  /**
   * Get a specific document by path or docid
   */
  async get(pathOrDocid: string): Promise<QmdDocument> {
    const escapedPath = this.escapeShellArg(pathOrDocid);
    const { stdout } = await execAsync(
      `${this.qmdPath} get ${escapedPath} --json`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return JSON.parse(stdout);
  }

  /**
   * Get index status and collections
   */
  async status(): Promise<QmdStatus> {
    const { stdout } = await execAsync(
      `${this.qmdPath} status --json`,
      { maxBuffer: 1024 * 1024 }
    );
    return JSON.parse(stdout);
  }

  /**
   * Test connection to qmd
   */
  async testConnection(): Promise<{ ok: boolean; error?: string; status?: QmdStatus }> {
    try {
      const status = await this.status();
      return { ok: true, status };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { ok: false, error };
    }
  }

  /**
   * Get list of collections
   */
  async getCollections(): Promise<string[]> {
    try {
      const status = await this.status();
      return status.collections.map(c => c.name);
    } catch {
      return [];
    }
  }

  /**
   * Build CLI arguments
   */
  private buildArgs(cmd: string, query: string, options: SearchOptions): string {
    const escapedQuery = this.escapeShellArg(query);
    const args = [cmd, escapedQuery, '--json'];

    if (options.collection) {
      args.push('-c', options.collection);
    }
    if (options.limit) {
      args.push('-n', String(options.limit));
    }
    if (options.minScore) {
      args.push('--min-score', String(options.minScore));
    }
    if (options.full) {
      args.push('--full');
    }

    return args.join(' ');
  }

  /**
   * Execute CLI command and parse JSON result
   */
  private async execute(args: string): Promise<QmdSearchResult> {
    try {
      const { stdout, stderr } = await execAsync(
        `${this.qmdPath} ${args}`,
        { 
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000 // 30 seconds timeout
        }
      );

      if (stderr) {
        console.warn('[QMD]', stderr);
      }

      const parsed = JSON.parse(stdout);
      
      // Normalize response format
      return this.normalizeResponse(parsed);
    } catch (e) {
      throw this.handleError(e);
    }
  }

  /**
   * Normalize qmd response to consistent format
   */
  private normalizeResponse(data: any): QmdSearchResult {
    // Handle different possible response formats
    const results: QmdResultItem[] = (data.results || data.documents || []).map((item: any) => ({
      docid: item.docid || item.id || '',
      path: item.path || item.file || '',
      absolutePath: item.absolutePath || item.absolute_path || item.path || '',
      title: item.title || this.extractTitleFromPath(item.path || ''),
      score: typeof item.score === 'number' ? item.score : parseFloat(item.score) || 0,
      snippet: item.snippet || item.content?.substring(0, 200) || '',
      context: item.context || undefined,
      collection: item.collection || 'default',
    }));

    return {
      results,
      query: data.query || '',
      mode: data.mode || 'search',
      elapsed: data.elapsed || 0,
    };
  }

  /**
   * Extract title from file path
   */
  private extractTitleFromPath(path: string): string {
    const filename = path.split('/').pop() || path;
    return filename.replace(/\.md$/, '');
  }

  /**
   * Escape shell argument
   */
  private escapeShellArg(arg: string): string {
    // Double quote the argument and escape internal double quotes
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  /**
   * Handle errors
   */
  private handleError(e: unknown): QmdError {
    const error = e as Error & { code?: string; killed?: boolean };
    
    if (error.code === 'ENOENT') {
      return {
        type: 'connection',
        message: 'qmd not found at the specified path',
        details: `Path: ${this.qmdPath}`,
      };
    }
    
    if (error.killed) {
      return {
        type: 'timeout',
        message: 'Search timed out',
        details: 'Try a simpler query or reduce result count',
      };
    }
    
    if (error.message?.includes('JSON')) {
      return {
        type: 'parse',
        message: 'Failed to parse qmd response',
        details: error.message,
      };
    }

    return {
      type: 'unknown',
      message: error.message || 'Unknown error',
      details: String(e),
    };
  }
}
