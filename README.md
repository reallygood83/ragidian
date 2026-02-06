# QMD RAGidian

Hybrid search & RAG for Obsidian powered by [qmd](https://github.com/tobi/qmd).

Combines **BM25 keyword search**, **vector semantic search**, and **LLM reranking** - all running locally.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.4%2B-purple)

## Features

- **Hybrid Search**: Keyword, semantic, and hybrid (with reranking) search modes
- **RAG Chat**: Ask questions about your notes, get AI-powered answers with citations
- **Related Documents**: Automatically suggests related documents when viewing a note
- **Multiple LLM Providers**: OpenAI, Anthropic, Google Gemini, and Ollama (local)
- **Custom Models**: Manually specify any model name for future-proofing

## Requirements

- [qmd](https://github.com/tobi/qmd) installed and configured
- At least one collection indexed in qmd
- Embeddings generated (`qmd embed`)

## Installation

### Via BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter: `reallygood83/ragidian`
5. Enable the plugin

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/reallygood83/ragidian/releases)
2. Create folder: `<vault>/.obsidian/plugins/qmd-ragidian/`
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin

## Setup

### 1. Install qmd

```bash
bun install -g https://github.com/tobi/qmd
```

### 2. Index Your Vault

```bash
# Add your vault as a collection
qmd collection add ~/path/to/your/vault --name vault

# Generate embeddings
qmd embed
```

### 3. Configure the Plugin

1. Open Obsidian Settings > QMD RAGidian
2. Set the qmd path (default: `/usr/local/bin/qmd`)
3. Click "Test" to verify connection
4. (Optional) Configure LLM provider for RAG chat

## LLM Providers

| Provider | Models (Feb 2026) |
|----------|-------------------|
| **OpenAI** | GPT-5.2 (default), GPT-5.1, GPT-4o |
| **Anthropic** | Claude Opus 4.6 (default), Sonnet 4.5, Haiku 4.5 |
| **Google Gemini** | Gemini 2.5 Flash (default), 2.5 Pro, 3 Flash Preview |
| **Ollama** | Any local model (llama3.2, mistral, etc.) |

### Custom Model Names

For each provider, you can enable "Use Custom Model Name" to manually enter any model identifier. This is useful for:
- Using preview/beta models
- Using fine-tuned models
- Future-proofing when new models are released

## Usage

### Search

1. Click the search icon in the left ribbon (or use command: "Open QMD Search")
2. Enter your query
3. Select search mode:
   - **Keyword**: Fast BM25 full-text search
   - **Semantic**: Vector similarity search
   - **Hybrid**: Best quality (BM25 + vector + reranking)
4. Click a result to open the note

### RAG Chat

1. Configure an LLM provider in settings
2. Type a question in the chat input
3. The plugin will:
   - Search for relevant documents
   - Send them as context to the LLM
   - Display the answer with source citations

### Related Documents

When you open a note, the plugin automatically searches for related documents using semantic similarity. This feature can be toggled in settings.

## Keyboard Shortcuts

| Action | Default Shortcut |
|--------|-----------------|
| Open QMD Search | (Assign in Hotkeys settings) |
| Search Selection | (Assign in Hotkeys settings) |

## Troubleshooting

### "qmd not found"

1. Verify qmd is installed: `which qmd`
2. Update the qmd path in settings
3. Click "Test" to verify

### "No results found"

1. Ensure your vault is indexed: `qmd status`
2. If not, add collection and run embed:
   ```bash
   qmd collection add ~/vault --name vault
   qmd embed
   ```

### LLM errors

1. Verify your API key is correct
2. Check your internet connection
3. For Ollama, ensure the server is running: `ollama serve`

## Development

```bash
# Clone the repo
git clone https://github.com/reallygood83/ragidian.git

# Install dependencies
cd ragidian
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

## License

MIT

## Credits

- [qmd](https://github.com/tobi/qmd) by Tobi Lutke - The amazing hybrid search engine
- [Obsidian](https://obsidian.md) - The best knowledge management tool
