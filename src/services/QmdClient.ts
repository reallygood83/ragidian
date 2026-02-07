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
   * Note: qmd status doesn't support --json, so we parse plain text output
   */
  async status(): Promise<QmdStatus> {
    const { stdout } = await execAsync(
      `${this.qmdPath} status`,
      { maxBuffer: 1024 * 1024 }
    );
    return this.parseStatusOutput(stdout);
  }

  /**
   * Parse plain text output from qmd status command
   */
  private parseStatusOutput(output: string): QmdStatus {
    const lines = output.split('\n');
    
    let indexPath = '';
    let totalDocuments = 0;
    let totalEmbeddings = 0;
    const collections: Array<{
      name: string;
      path: string;
      mask: string;
      fileCount: number;
      embeddingCount: number;
      lastUpdated: string;
    }> = [];

    let currentCollection: {
      name: string;
      path: string;
      mask: string;
      fileCount: number;
      embeddingCount: number;
      lastUpdated: string;
    } | null = null;

    for (const line of lines) {
      // Parse index path: "Index: /path/to/index.sqlite"
      const indexMatch = line.match(/^Index:\s+(.+)$/);
      if (indexMatch) {
        indexPath = indexMatch[1].trim();
        continue;
      }

      // Parse total documents: "  Total:    1293 files indexed"
      const docsMatch = line.match(/Total:\s+(\d+)\s+files/);
      if (docsMatch) {
        totalDocuments = parseInt(docsMatch[1], 10);
        continue;
      }

      // Parse vectors/embeddings: "  Vectors:  11203 embedded"
      const vectorsMatch = line.match(/Vectors:\s+(\d+)\s+embedded/);
      if (vectorsMatch) {
        totalEmbeddings = parseInt(vectorsMatch[1], 10);
        continue;
      }

      // Parse collection header: "  CollectionName (qmd://CollectionName/)"
      const collectionMatch = line.match(/^\s+(\S+)\s+\(qmd:\/\/([^/]+)\/\)/);
      if (collectionMatch) {
        if (currentCollection) {
          collections.push(currentCollection);
        }
        currentCollection = {
          name: collectionMatch[1],
          path: `qmd://${collectionMatch[2]}/`,
          mask: '',
          fileCount: 0,
          embeddingCount: 0,
          lastUpdated: '',
        };
        continue;
      }

      // Parse collection pattern: "    Pattern:  **/*.md"
      if (currentCollection) {
        const patternMatch = line.match(/Pattern:\s+(.+)$/);
        if (patternMatch) {
          currentCollection.mask = patternMatch[1].trim();
          continue;
        }

        // Parse collection files: "    Files:    1293 (updated 8m ago)"
        const filesMatch = line.match(/Files:\s+(\d+)(?:\s+\(updated\s+([^)]+)\))?/);
        if (filesMatch) {
          currentCollection.fileCount = parseInt(filesMatch[1], 10);
          currentCollection.lastUpdated = filesMatch[2] || '';
        }
      }
    }

    // Add last collection if exists
    if (currentCollection) {
      collections.push(currentCollection);
    }

    return {
      indexPath,
      collections,
      totalDocuments,
      totalEmbeddings,
      modelsLoaded: true, // Assume loaded if status runs successfully
    };
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
          timeout: 300000
        }
      );

      if (stderr) {
        console.warn('[QMD]', stderr);
      }

      const trimmed = stdout.trim();
      
      if (!trimmed || trimmed.startsWith('No results') || trimmed === '[]') {
        return { results: [], query: '', mode: 'search', elapsed: 0 };
      }

      const parsed = JSON.parse(trimmed);
      return this.normalizeResponse(parsed);
    } catch (e) {
      throw this.handleError(e);
    }
  }

  /**
   * Normalize qmd response to consistent format
   */
  private normalizeResponse(data: any): QmdSearchResult {
    const items = Array.isArray(data) ? data : (data.results || data.documents || []);
    
    const results: QmdResultItem[] = items.map((item: any) => {
      const rawPath = item.path || item.file || '';
      const cleanPath = this.cleanQmdPath(rawPath);
      
      return {
        docid: item.docid || item.id || '',
        path: cleanPath,
        absolutePath: item.absolutePath || item.absolute_path || cleanPath,
        title: item.title || this.extractTitleFromPath(cleanPath),
        score: typeof item.score === 'number' ? item.score : parseFloat(item.score) || 0,
        snippet: item.snippet || item.content?.substring(0, 200) || '',
        context: item.context || undefined,
        collection: item.collection || 'default',
      };
    });

    return {
      results,
      query: Array.isArray(data) ? '' : (data.query || ''),
      mode: Array.isArray(data) ? 'search' : (data.mode || 'search'),
      elapsed: Array.isArray(data) ? 0 : (data.elapsed || 0),
    };
  }

  private cleanQmdPath(path: string): string {
    return path.replace(/^qmd:\/\/[^/]+\//, '');
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

  private handleError(e: unknown): Error {
    const error = e as Error & { code?: string; killed?: boolean; stderr?: string };
    
    if (error.code === 'ENOENT') {
      return new Error(`qmd not found at: ${this.qmdPath}`);
    }
    
    if (error.killed) {
      return new Error('Search timed out. Try a simpler query.');
    }
    
    if (error.message?.includes('JSON')) {
      return new Error(`Failed to parse qmd response: ${error.message}`);
    }

    if (error.stderr) {
      return new Error(error.stderr.trim());
    }

    return new Error(error.message || 'Unknown error occurred');
  }
}
