// QMD Search Result Types

export interface QmdSearchResult {
  results: QmdResultItem[];
  query: string;
  mode: 'search' | 'vsearch' | 'query';
  elapsed: number;
}

export interface QmdResultItem {
  docid: string;
  path: string;
  absolutePath: string;
  title: string;
  score: number;
  snippet: string;
  context?: string;
  collection: string;
}

// QMD Document Type
export interface QmdDocument {
  docid: string;
  path: string;
  absolutePath: string;
  title: string;
  content: string;
  collection: string;
  context?: string;
}

// QMD Status Types
export interface QmdStatus {
  indexPath: string;
  collections: QmdCollection[];
  totalDocuments: number;
  totalEmbeddings: number;
  modelsLoaded: boolean;
}

export interface QmdCollection {
  name: string;
  path: string;
  mask: string;
  fileCount: number;
  embeddingCount: number;
  lastUpdated: string;
}

// Search Options
export interface SearchOptions {
  collection?: string;
  limit?: number;
  minScore?: number;
  full?: boolean;
}

// Chat Message
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  sources?: QmdResultItem[];
}

// Error Types
export interface QmdError {
  type: 'connection' | 'parse' | 'notfound' | 'timeout' | 'unknown';
  message: string;
  details?: string;
}
