# QMD Obsidian Plugin - 개발 스펙 문서 v2.0

> **프로젝트명:** qmd-ragidian
> **작성일:** 2026-02-07
> **상태:** Ready for Implementation
> **모티브:** [tobi/qmd](https://github.com/tobi/qmd)

---

## 1. 프로젝트 개요

### 1.1 배경
[qmd](https://github.com/tobi/qmd)는 로컬 마크다운 문서를 위한 **하이브리드 검색 엔진**이다.
- **BM25 키워드 검색** (FTS5)
- **벡터 의미 검색** (EmbeddingGemma 300M)
- **LLM 리랭킹** (Qwen3-Reranker 0.6B)
- **쿼리 확장** (Fine-tuned 1.7B 모델)

현재 CLI/MCP 서버로만 사용 가능. Obsidian 플러그인으로 확장하여 **지식 활용 도구**로 발전시킨다.

### 1.2 목표
1. **통합 검색**: 키워드/의미/하이브리드 검색을 사이드바에서
2. **RAG 채팅**: 검색 결과 기반 LLM 답변 생성
3. **관련 자료 자동 추천**: 현재 노트와 연관된 문서 실시간 제안
4. **터미널 + Obsidian 통합**: 동일한 qmd 인덱스 공유

### 1.3 대상 사용자
- Obsidian으로 지식 관리하는 사용자 (PKM)
- 강의자료/콘텐츠 제작자 (기존 자료 기반 초안 생성)
- AI 에이전트 워크플로우 사용자

---

## 2. qmd CLI 인터페이스 명세

### 2.1 검색 명령어

| 명령어 | 설명 | 속도 | 품질 |
|--------|------|------|------|
| `qmd search "query"` | BM25 키워드 검색 | 빠름 | 보통 |
| `qmd vsearch "query"` | 벡터 의미 검색 | 보통 | 좋음 |
| `qmd query "query"` | 하이브리드 + 리랭킹 | 느림 | 최고 |

### 2.2 공통 옵션

```bash
# 결과 개수
-n <num>              # 결과 수 (기본: 5, --json시 20)

# 컬렉션 필터
-c, --collection <name>  # 특정 컬렉션만 검색

# 점수 필터
--min-score <num>     # 최소 관련도 (기본: 0, 권장: 0.3)
--all                 # 모든 결과 반환

# 출력 형식
--json                # JSON 출력 (플러그인용 필수)
--full                # 전체 문서 내용 포함
--line-numbers        # 라인 번호 포함

# 파일 목록 모드
--files               # docid,score,filepath,context 형식
```

### 2.3 문서 조회 명령어

```bash
# 단일 문서 조회
qmd get <path>           # 경로로 조회
qmd get "#abc123"        # docid로 조회
qmd get <path>:50 -l 100 # 50번째 줄부터 100줄

# 다중 문서 조회
qmd multi-get "docs/*.md"           # glob 패턴
qmd multi-get "doc1.md, doc2.md"    # 목록
qmd multi-get --max-bytes 20480     # 20KB 이하만
```

### 2.4 JSON 응답 구조 (핵심)

```typescript
// 검색 결과 (qmd search/vsearch/query --json)
interface QmdSearchResult {
  results: Array<{
    docid: string;        // 6자 해시 (예: "abc123")
    path: string;         // 컬렉션 상대 경로
    absolutePath: string; // 전체 경로
    title: string;        // 문서 제목 (첫 헤딩 또는 파일명)
    score: number;        // 관련도 점수 (0.0 - 1.0)
    snippet: string;      // 검색 결과 스니펫
    context?: string;     // 경로 컨텍스트 (설정된 경우)
    collection: string;   // 소속 컬렉션명
  }>;
  query: string;          // 검색어
  mode: 'search' | 'vsearch' | 'query';
  elapsed: number;        // 소요 시간 (ms)
}

// 문서 조회 (qmd get --json)
interface QmdDocument {
  docid: string;
  path: string;
  absolutePath: string;
  title: string;
  content: string;
  collection: string;
  context?: string;
}

// 상태 조회 (qmd status --json)
interface QmdStatus {
  indexPath: string;
  collections: Array<{
    name: string;
    path: string;
    mask: string;
    fileCount: number;
    embeddingCount: number;
    lastUpdated: string;
  }>;
  totalDocuments: number;
  totalEmbeddings: number;
  modelsLoaded: boolean;
}
```

### 2.5 MCP 서버 (대안)

qmd는 MCP 서버를 내장하고 있어 CLI 대신 사용 가능:

```json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp"]
    }
  }
}
```

**MCP Tools:**
- `qmd_search` - BM25 검색
- `qmd_vsearch` - 벡터 검색
- `qmd_query` - 하이브리드 검색
- `qmd_get` - 문서 조회
- `qmd_multi_get` - 다중 문서 조회
- `qmd_status` - 인덱스 상태

> **결정 포인트**: Phase 1에서는 CLI (`child_process.exec`) 사용.
> 성능 이슈 발생 시 MCP 통신으로 전환 고려.

---

## 3. 핵심 기능 명세

### 3.1 F1: 통합 검색 패널

| 항목 | 설명 | 구현 상세 |
|------|------|----------|
| 검색 모드 | 키워드/의미/하이브리드 선택 | 드롭다운 또는 탭 |
| 검색 입력 | 실시간 검색 (디바운스 300ms) | `<input>` + debounce |
| 컬렉션 필터 | 특정 컬렉션만 검색 | `qmd status`에서 목록 로드 |
| 결과 표시 | 제목, 스니펫, 점수 | 클릭 시 해당 노트 열기 |
| 최소 점수 | 관련도 임계값 (기본 0.3) | 설정에서 변경 |
| 결과 수 | 5/10/20/All | 설정에서 변경 |

**검색 액션:**
```typescript
// 결과 클릭 시
workspace.openLinkText(result.path, '', false);

// 새 탭에서 열기 (Cmd+Click)
workspace.openLinkText(result.path, '', 'tab');

// 현재 노트에 링크 삽입
editor.replaceSelection(`[[${result.path}]]`);
```

### 3.2 F2: RAG 채팅

| 항목 | 설명 | 구현 상세 |
|------|------|----------|
| 질문 입력 | 자연어 질문 | 하단 입력창 |
| 컨텍스트 검색 | `qmd query`로 상위 5-10개 검색 | 자동 실행 |
| 답변 생성 | 검색 문서를 컨텍스트로 LLM 호출 | 스트리밍 지원 |
| 출처 표시 | 참조된 문서 링크 | 클릭 시 열기 |
| 대화 기록 | 세션 내 히스토리 | 메모리 저장 |

**RAG 프롬프트 템플릿:**
```typescript
const RAG_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the user's notes.
Use the following documents as context. If the answer isn't in the context, say so.
Always cite your sources using [[document-name]] format.

Context:
{context}`;

const RAG_USER_PROMPT = `Question: {question}

Please answer based on the context provided above.`;
```

### 3.3 F3: 관련 문서 자동 추천

| 항목 | 설명 | 구현 상세 |
|------|------|----------|
| 트리거 | 노트 열기, 수정 후 idle 2초 | `workspace.on('file-open')` + debounce |
| 검색 소스 | 현재 노트 제목 + 첫 300자 | `vsearch` 사용 |
| 결과 | 상위 5개 관련 문서 | 사이드바 하단 |
| 캐싱 | 동일 노트 5분간 캐시 | Map + TTL |
| 자기 참조 제외 | 현재 문서는 결과에서 제외 | 필터링 |

### 3.4 F4: 액션 버튼

| 액션 | 설명 | 단축키 |
|------|------|--------|
| 새 노트로 저장 | RAG 답변 → 새 노트 생성 | - |
| 현재 노트에 삽입 | 커서 위치에 결과/답변 삽입 | - |
| 클립보드 복사 | 결과/답변 복사 | - |
| Obsidian 링크 삽입 | `[[path]]` 형식으로 삽입 | - |

---

## 4. 기술 스택 & 아키텍처

### 4.1 기술 스택

| 영역 | 기술 | 버전/비고 |
|------|------|----------|
| 언어 | TypeScript | 5.x |
| 플랫폼 | Obsidian Plugin API | 1.4+ |
| UI | Vanilla TS + CSS | Svelte 고려 (Phase 4) |
| 빌드 | esbuild | 0.17+ |
| 통신 | Node.js child_process | exec/spawn |
| LLM | OpenAI/Anthropic/Ollama | REST API |

### 4.2 프로젝트 구조

```
qmd-ragidian/
├── src/
│   ├── main.ts                    # 플러그인 진입점
│   ├── settings.ts                # 설정 탭
│   ├── constants.ts               # 상수 정의
│   │
│   ├── views/
│   │   ├── QmdSidebarView.ts      # 메인 사이드바 View
│   │   ├── SearchPanel.ts         # 검색 UI 컴포넌트
│   │   ├── ChatPanel.ts           # RAG 채팅 컴포넌트
│   │   └── RelatedPanel.ts        # 관련 문서 컴포넌트
│   │
│   ├── services/
│   │   ├── QmdClient.ts           # qmd CLI 래퍼
│   │   ├── LLMService.ts          # LLM API 추상화
│   │   ├── CacheService.ts        # 결과 캐싱 (TTL Map)
│   │   └── EventService.ts        # Obsidian 이벤트 관리
│   │
│   ├── types/
│   │   ├── qmd.ts                 # qmd 응답 타입
│   │   ├── llm.ts                 # LLM 관련 타입
│   │   └── settings.ts            # 설정 타입
│   │
│   └── utils/
│       ├── debounce.ts            # 디바운스 유틸
│       ├── markdown.ts            # 마크다운 처리
│       └── path.ts                # 경로 유틸
│
├── styles.css                     # 스타일시트
├── manifest.json                  # 플러그인 매니페스트
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

### 4.3 핵심 클래스 설계

#### QmdClient (CLI 래퍼)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class QmdClient {
  constructor(private qmdPath: string) {}

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<QmdSearchResult> {
    const args = this.buildArgs('search', query, options);
    return this.execute(args);
  }

  async vsearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<QmdSearchResult> {
    const args = this.buildArgs('vsearch', query, options);
    return this.execute(args);
  }

  async query(
    query: string,
    options: SearchOptions = {}
  ): Promise<QmdSearchResult> {
    const args = this.buildArgs('query', query, options);
    return this.execute(args);
  }

  async get(pathOrDocid: string): Promise<QmdDocument> {
    const { stdout } = await execAsync(
      `${this.qmdPath} get "${pathOrDocid}" --json`
    );
    return JSON.parse(stdout);
  }

  async status(): Promise<QmdStatus> {
    const { stdout } = await execAsync(
      `${this.qmdPath} status --json`
    );
    return JSON.parse(stdout);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.status();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  private buildArgs(
    cmd: string,
    query: string,
    options: SearchOptions
  ): string {
    const args = [cmd, `"${query}"`, '--json'];

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

  private async execute(args: string): Promise<QmdSearchResult> {
    const { stdout, stderr } = await execAsync(
      `${this.qmdPath} ${args}`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB
    );

    if (stderr) {
      console.warn('[QMD]', stderr);
    }

    return JSON.parse(stdout);
  }
}

interface SearchOptions {
  collection?: string;
  limit?: number;
  minScore?: number;
  full?: boolean;
}
```

#### LLMService (LLM 추상화)

```typescript
export interface LLMProvider {
  name: string;
  chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<string>;

  streamChat?(
    messages: Message[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions
  ): Promise<void>;
}

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';

  constructor(
    private apiKey: string,
    private model: string = 'gpt-4o-mini'
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
        }),
      }
    );

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async streamChat(
    messages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
        }),
      }
    );

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line =>
        line.startsWith('data: ')
      );

      for (const line of lines) {
        if (line === 'data: [DONE]') continue;
        const json = JSON.parse(line.slice(6));
        const content = json.choices[0]?.delta?.content;
        if (content) onChunk(content);
      }
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';

  constructor(
    private apiKey: string,
    private model: string = 'claude-3-5-sonnet-20241022'
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          messages: messages.filter(m => m.role !== 'system'),
          system: messages.find(m => m.role === 'system')?.content,
        }),
      }
    );

    const data = await response.json();
    return data.content[0].text;
  }
}

export class OllamaProvider implements LLMProvider {
  name = 'Ollama';

  constructor(
    private baseUrl: string = 'http://localhost:11434',
    private model: string = 'llama3.2'
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    const data = await response.json();
    return data.message.content;
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}
```

#### CacheService (TTL 캐시)

```typescript
export class CacheService<T> {
  private cache = new Map<string, { data: T; expires: number }>();

  constructor(private ttlMs: number = 5 * 60 * 1000) {} // 5분

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // 만료된 항목 정리 (주기적 호출)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 4.4 Obsidian 통합

#### 사이드바 View 등록

```typescript
import {
  ItemView,
  Plugin,
  WorkspaceLeaf,
} from 'obsidian';

export const VIEW_TYPE_QMD = 'qmd-sidebar';

export class QmdSidebarView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: QmdPlugin) {
    super(leaf);
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
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('qmd-sidebar');

    // UI 렌더링
    this.renderSearchPanel(container);
    this.renderResultsPanel(container);
    this.renderChatPanel(container);
    this.renderRelatedPanel(container);
  }

  async onClose(): Promise<void> {
    // 정리
  }

  private renderSearchPanel(container: Element): void {
    // 검색 UI
  }

  private renderResultsPanel(container: Element): void {
    // 결과 UI
  }

  private renderChatPanel(container: Element): void {
    // 채팅 UI
  }

  private renderRelatedPanel(container: Element): void {
    // 관련 문서 UI
  }
}
```

#### 플러그인 메인

```typescript
import {
  Plugin,
  WorkspaceLeaf,
} from 'obsidian';

export default class QmdPlugin extends Plugin {
  settings: QmdSettings;
  qmdClient: QmdClient;
  llmService: LLMService;
  relatedCache: CacheService<QmdSearchResult>;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 서비스 초기화
    this.qmdClient = new QmdClient(this.settings.qmdPath);
    this.llmService = this.createLLMService();
    this.relatedCache = new CacheService(
      this.settings.relatedCacheTTL * 60 * 1000
    );

    // View 등록
    this.registerView(
      VIEW_TYPE_QMD,
      (leaf) => new QmdSidebarView(leaf, this)
    );

    // 리본 아이콘
    this.addRibbonIcon('search', 'QMD Search', () => {
      this.activateView();
    });

    // 커맨드
    this.addCommand({
      id: 'open-qmd-search',
      name: 'Open QMD Search',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'search-current-selection',
      name: 'Search Selection',
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        if (selection) {
          this.activateView();
          // 검색 실행
        }
      },
    });

    // 설정 탭
    this.addSettingTab(new QmdSettingTab(this.app, this));

    // 이벤트 리스너 (관련 문서 추천용)
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        this.onFileOpen(file);
      })
    );
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_QMD);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_QMD)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE_QMD,
        active: true,
      });
    }

    workspace.revealLeaf(leaf);
  }

  private createLLMService(): LLMService {
    switch (this.settings.llmProvider) {
      case 'openai':
        return new OpenAIProvider(
          this.settings.openaiApiKey,
          this.settings.openaiModel
        );
      case 'anthropic':
        return new AnthropicProvider(
          this.settings.anthropicApiKey,
          this.settings.anthropicModel
        );
      case 'ollama':
        return new OllamaProvider(
          this.settings.ollamaUrl,
          this.settings.ollamaModel
        );
    }
  }

  private async onFileOpen(file: TFile | null): Promise<void> {
    if (!file || !this.settings.enableRelated) return;

    // 디바운스는 View에서 처리
    const view = this.app.workspace
      .getLeavesOfType(VIEW_TYPE_QMD)[0]
      ?.view as QmdSidebarView | undefined;

    if (view) {
      view.updateRelatedDocuments(file);
    }
  }
}
```

---

## 5. 타입 정의 (완전판)

### types/qmd.ts

```typescript
// 검색 결과
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

// 문서
export interface QmdDocument {
  docid: string;
  path: string;
  absolutePath: string;
  title: string;
  content: string;
  collection: string;
  context?: string;
}

// 상태
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

// 검색 옵션
export interface SearchOptions {
  collection?: string;
  limit?: number;
  minScore?: number;
  full?: boolean;
}
```

### types/settings.ts

```typescript
export interface QmdSettings {
  // qmd 설정
  qmdPath: string;

  // 검색 설정
  defaultSearchMode: 'search' | 'vsearch' | 'query';
  defaultLimit: number;
  minScore: number;

  // 관련 문서 설정
  enableRelated: boolean;
  relatedLimit: number;
  relatedCacheTTL: number; // 분
  relatedDebounceMs: number;

  // LLM 설정
  llmProvider: 'openai' | 'anthropic' | 'ollama';
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  ollamaUrl: string;
  ollamaModel: string;

  // RAG 설정
  ragContextLimit: number;
  ragSystemPrompt: string;
}

export const DEFAULT_SETTINGS: QmdSettings = {
  qmdPath: '/usr/local/bin/qmd',

  defaultSearchMode: 'query',
  defaultLimit: 10,
  minScore: 0.3,

  enableRelated: true,
  relatedLimit: 5,
  relatedCacheTTL: 5,
  relatedDebounceMs: 2000,

  llmProvider: 'openai',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',

  ragContextLimit: 5,
  ragSystemPrompt: `You are a helpful assistant that answers questions based on the user's notes.
Use the provided documents as context. If the answer isn't in the context, say so.
Always cite your sources using [[document-name]] format.`,
};
```

---

## 6. UI/UX 설계

### 6.1 사이드바 레이아웃

```
┌─────────────────────────────────────┐
│  🔍 QMD Search                  [⚙]│  ← 헤더 (설정 버튼)
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ 검색어 입력...              🔍 ││  ← 검색창
│  └─────────────────────────────────┘│
│  [키워드] [의미] [하이브리드▼]       │  ← 모드 선택 탭
│  컬렉션: [전체 ▼]                   │  ← 필터
├─────────────────────────────────────┤
│  검색 결과 (12)                 [↻]│  ← 결과 헤더
│  ┌─────────────────────────────────┐│
│  │ 📄 회의록-2024-01-15    ★ 92% ││  ← 결과 카드
│  │ 분기 계획 논의, 예산 확정...    ││     (클릭: 열기)
│  ├─────────────────────────────────┤│     (Cmd+클릭: 새 탭)
│  │ 📄 프로젝트-가이드      ★ 87% ││
│  │ 프로젝트 진행 프로세스...       ││
│  └─────────────────────────────────┘│
│                                     │
│  [더 보기...]                       │
├─────────────────────────────────────┤
│  💬 RAG 채팅                    [−]│  ← 접기/펼치기
│  ┌─────────────────────────────────┐│
│  │ 👤 분기 계획 프로세스가 뭐야?  ││  ← 사용자 메시지
│  ├─────────────────────────────────┤│
│  │ 🤖 회의록에 따르면, 분기 계획  ││  ← AI 응답
│  │ 은 다음 단계로 진행됩니다:     ││
│  │ 1. 목표 설정 (1월 첫째주)      ││
│  │ 2. 예산 검토 (1월 둘째주)      ││
│  │ 📎 [[회의록-2024-01-15]]       ││  ← 출처 링크
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 질문 입력...                 ⏎ ││  ← 채팅 입력
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  📎 관련 문서                   [−]│
│  • 분기별-리뷰.md         ★ 82%   │
│  • 예산-템플릿.md         ★ 76%   │
│  • 팀-목표-2024.md        ★ 71%   │
└─────────────────────────────────────┘
```

### 6.2 점수 색상 코딩

```css
.qmd-score-high { color: var(--text-success); }    /* 70%+ 녹색 */
.qmd-score-medium { color: var(--text-warning); }  /* 40-70% 노란색 */
.qmd-score-low { color: var(--text-muted); }       /* 40% 미만 회색 */
```

### 6.3 CSS 변수 (Obsidian 테마 호환)

```css
.qmd-sidebar {
  --qmd-bg: var(--background-secondary);
  --qmd-border: var(--background-modifier-border);
  --qmd-text: var(--text-normal);
  --qmd-text-muted: var(--text-muted);
  --qmd-accent: var(--interactive-accent);
}
```

---

## 7. 에러 처리

### 7.1 에러 시나리오 & 대응

| 시나리오 | 감지 방법 | 사용자 메시지 | 복구 액션 |
|---------|----------|--------------|----------|
| qmd 미설치 | `testConnection()` 실패 | "qmd가 설치되지 않았습니다" | 설치 가이드 링크 |
| qmd 경로 오류 | ENOENT | "qmd 경로를 확인해주세요" | 설정 열기 버튼 |
| 컬렉션 없음 | status.collections.length === 0 | "인덱싱된 컬렉션이 없습니다" | `qmd collection add` 안내 |
| 임베딩 미생성 | embeddingCount === 0 | "임베딩이 생성되지 않았습니다" | `qmd embed` 안내 |
| LLM API 키 없음 | 빈 문자열 체크 | "API 키를 설정해주세요" | 설정 열기 |
| LLM API 에러 | HTTP 4xx/5xx | 에러 메시지 표시 | 재시도 버튼 |
| 검색 결과 없음 | results.length === 0 | "검색 결과가 없습니다" | 검색어 제안 |
| 타임아웃 | exec timeout | "검색이 오래 걸립니다" | 취소/재시도 |

### 7.2 에러 표시 UI

```typescript
function showError(container: Element, error: QmdError): void {
  const errorEl = container.createDiv('qmd-error');
  errorEl.innerHTML = `
    <div class="qmd-error-icon">⚠️</div>
    <div class="qmd-error-message">${error.message}</div>
    ${error.action ? `
      <button class="qmd-error-action">${error.actionLabel}</button>
    ` : ''}
  `;

  if (error.action) {
    errorEl.querySelector('.qmd-error-action')
      ?.addEventListener('click', error.action);
  }
}
```

---

## 8. 구현 단계 (수정됨)

### Phase 1: 기본 검색 MVP (4-5시간)

**목표:** qmd 연동 + 기본 검색 UI

- [ ] 프로젝트 스캐폴딩 (manifest.json, package.json, esbuild)
- [ ] QmdClient 구현 (search, vsearch, query, status)
- [ ] 설정 화면 (qmd 경로 + 연결 테스트)
- [ ] 사이드바 View 등록
- [ ] 검색 UI (입력 + 모드 선택)
- [ ] 결과 표시 (제목, 스니펫, 점수)
- [ ] 결과 클릭 시 노트 열기

**검증:**
```bash
# qmd가 정상 동작하는지
qmd status --json
qmd search "test" --json -n 3
```

### Phase 2: 관련 문서 추천 (2-3시간)

**목표:** 현재 노트 기반 자동 추천

- [ ] CacheService 구현 (TTL 캐시)
- [ ] file-open 이벤트 리스너
- [ ] 디바운스 처리 (2초)
- [ ] 관련 문서 패널 UI
- [ ] 자기 참조 필터링

### Phase 3: RAG 채팅 (4-5시간)

**목표:** 검색 + LLM 답변 생성

- [ ] LLMService 구현 (OpenAI, Anthropic, Ollama)
- [ ] 설정 화면 확장 (LLM 설정)
- [ ] 채팅 UI (입력 + 메시지 표시)
- [ ] RAG 파이프라인 (검색 → 컨텍스트 → LLM)
- [ ] 출처 표시 + 링크
- [ ] 스트리밍 응답 (선택)

### Phase 4: 폴리싱 & 확장 (3-4시간)

**목표:** 완성도 높이기

- [ ] 컬렉션 필터 UI
- [ ] 액션 버튼 (새 노트, 삽입, 복사)
- [ ] 에러 핸들링 완성
- [ ] 다크/라이트 테마 대응
- [ ] 키보드 단축키
- [ ] README + 설치 가이드
- [ ] 커뮤니티 플러그인 제출 준비

---

## 9. 테스트 체크리스트

### 9.1 기능 테스트

- [ ] qmd 연결 테스트 버튼
- [ ] 세 가지 검색 모드 동작
- [ ] 컬렉션 필터 동작
- [ ] 결과 클릭 시 파일 열기
- [ ] 관련 문서 자동 업데이트
- [ ] RAG 답변 생성
- [ ] 출처 링크 클릭

### 9.2 에러 케이스 테스트

- [ ] qmd 미설치 상태에서 실행
- [ ] 잘못된 qmd 경로
- [ ] 빈 컬렉션
- [ ] LLM API 키 누락
- [ ] 네트워크 오류

### 9.3 성능 테스트

- [ ] 대용량 볼트 (1000+ 파일)에서 검색 속도
- [ ] 빠른 파일 전환 시 디바운스 동작
- [ ] 메모리 누수 확인 (장시간 사용)

---

## 10. 의존성 & 요구사항

### 10.1 사용자 환경

```bash
# qmd 설치
bun install -g https://github.com/tobi/qmd

# 컬렉션 등록 (Obsidian 볼트)
qmd collection add ~/Documents/Obsidian/MyVault --name vault

# 임베딩 생성 (필수)
qmd embed
```

### 10.2 개발 환경

```bash
# Node.js 18+
node --version

# Bun (qmd 실행용)
bun --version

# 프로젝트 설정
npm init
npm install --save-dev typescript esbuild obsidian @types/node
```

### 10.3 package.json

```json
{
  "name": "qmd-ragidian",
  "version": "0.1.0",
  "description": "Hybrid search & RAG for Obsidian using qmd",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.19.0",
    "obsidian": "latest",
    "typescript": "^5.0.0"
  }
}
```

### 10.4 manifest.json

```json
{
  "id": "qmd-ragidian",
  "name": "QMD RAGidian",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "Hybrid search & RAG powered by qmd",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourname",
  "isDesktopOnly": true
}
```

---

## 11. 리스크 & 대안

| 리스크 | 확률 | 영향 | 대안 |
|--------|------|------|------|
| qmd CLI 지연 (>500ms) | 중 | 검색 UX 저하 | MCP 서버 모드 전환 |
| 대용량 볼트 (5000+ 파일) | 중 | 추천 느림 | 캐시 TTL 증가, 백그라운드 갱신 |
| LLM API 비용 | 높음 | RAG 사용 부담 | Ollama 로컬 모델 권장 |
| qmd JSON 형식 변경 | 낮음 | 파싱 실패 | 버전 체크 + 호환성 레이어 |
| Obsidian API 변경 | 낮음 | 플러그인 동작 불가 | minAppVersion 명시 |

---

## 12. 향후 확장

### 단기 (v0.2)
- [ ] 검색 히스토리 저장
- [ ] 자주 쓰는 검색어 즐겨찾기
- [ ] 검색 결과 내보내기 (Markdown)

### 중기 (v0.3)
- [ ] 자동 태깅 (검색 결과 기반 태그 제안)
- [ ] 백링크 품질 분석 (의미적 관련성 점수)
- [ ] 음성 검색 (Whisper 연동)

### 장기 (v1.0)
- [ ] 지식 그래프 시각화
- [ ] 유튜브 연동 (영상 주제 → 관련 노트)
- [ ] Anki 카드 자동 생성
- [ ] 멀티 볼트 지원

---

## 13. 참고 자료

- [qmd GitHub](https://github.com/tobi/qmd) - 모티브 프로젝트
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs/)

---

*이 문서는 바로 개발 시작 가능한 수준의 상세 스펙입니다.*
*v2.0 - 2026-02-07*
