# QMD RAGidian

Hybrid search & RAG for Obsidian powered by [qmd](https://github.com/tobi/qmd).

Combines **BM25 keyword search**, **vector semantic search**, and **LLM reranking** - all running locally.

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.4%2B-purple)

## Features

### 🔍 Hybrid Search
- **Keyword Search**: Fast BM25 full-text search
- **Semantic Search**: Vector similarity search using embeddings
- **Hybrid Search**: Best quality with BM25 + vector + LLM reranking

### 💬 RAG Chat
- Ask questions about your notes in natural language
- Get AI-powered answers with source citations
- Click citations to jump directly to the source note

### 📄 Related Documents
- Automatically suggests related documents when viewing a note
- Uses semantic similarity to find connections you might miss

### 🤖 Multiple LLM Providers
- **OpenAI**: GPT-5.2, GPT-5.1, GPT-4o
- **Anthropic**: Claude Opus 4.6, Sonnet 4.5, Haiku 4.5
- **Google Gemini**: Gemini 2.5 Flash, 2.5 Pro, 3 Flash Preview
- **Ollama**: Any local model (llama3.2, mistral, etc.)
- **Custom Models**: Manually specify any model name

### ⚡ One-Click Setup (v0.2.0+)
- Automatic qmd installation via Bun
- One-click vault indexing
- Automatic embedding generation
- No terminal commands required!

### 🔄 Auto-Sync (v0.3.0+)
- **On-Save Sync**: Automatically re-index when you save a file
- **Startup Sync**: Check for changes when Obsidian starts
- **Scheduled Sync**: Periodic background sync (configurable interval)
- **Smart Debouncing**: Batches rapid changes to avoid excessive indexing

## Installation

### Via BRAT (Recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) allows you to install beta plugins directly from GitHub.

1. **Install BRAT** (if not already installed):
   - Open Obsidian Settings → Community Plugins → Browse
   - Search for "BRAT" and install it
   - Enable BRAT in your Community Plugins list

2. **Add QMD RAGidian**:
   - Open Obsidian Settings → BRAT
   - Click **"Add Beta plugin"**
   - Enter: `reallygood83/ragidian`
   - Click "Add Plugin"

3. **Enable the Plugin**:
   - Go to Settings → Community Plugins
   - Find "QMD RAGidian" and enable it

4. **Update via BRAT**:
   - BRAT will notify you when updates are available
   - Or manually: Settings → BRAT → "Check for updates"

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/reallygood83/ragidian/releases)
2. Create folder: `<vault>/.obsidian/plugins/qmd-ragidian/`
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin

## Quick Start

### Option 1: One-Click Setup (Recommended)

1. Open Obsidian Settings → QMD RAGidian
2. Click **"Install qmd"** button (requires [Bun](https://bun.sh) installed)
3. Wait for installation to complete
4. Click **"Index Vault"** to index your notes
5. Click **"Generate Embeddings"** for semantic search
6. Done! Start searching.

### Option 2: Manual Setup

```bash
# Install qmd globally
bun install -g https://github.com/tobi/qmd

# Add your vault as a collection
qmd collection add ~/path/to/your/vault --name vault

# Generate embeddings for semantic search
qmd embed
```

Then configure the qmd path in plugin settings.

## Configuration

### qmd Settings
| Setting | Description | Default |
|---------|-------------|---------|
| qmd Path | Path to qmd executable | `/usr/local/bin/qmd` |
| Collection | qmd collection name | `vault` |
| Result Limit | Max search results | `10` |

### Auto-Sync Settings (v0.3.0+)
| Setting | Description | Default |
|---------|-------------|---------|
| Auto-sync on save | Re-index when files are saved | `true` |
| Sync on startup | Check for changes at startup | `true` |
| Scheduled sync | Enable periodic background sync | `false` |
| Sync interval | Minutes between scheduled syncs | `30` |
| Debounce delay | Seconds to wait before syncing | `5` |

### LLM Settings
Configure your preferred LLM provider for RAG chat:
- Enter your API key (stored locally, never transmitted except to the provider)
- Select a model or use custom model name
- For Ollama, just specify the model name (no API key needed)

## Usage

### Search
1. Click the magnifying glass icon in the left ribbon
2. Enter your search query
3. Select search mode (Keyword / Semantic / Hybrid)
4. Click a result to open the note

### RAG Chat
1. Configure an LLM provider in settings
2. Switch to the Chat tab
3. Ask a question about your notes
4. View the AI response with clickable source citations

### Related Documents
- Open any note
- Switch to the "Related" tab in the sidebar
- See semantically similar documents

## Keyboard Shortcuts

Assign shortcuts in Settings → Hotkeys:
- **Open QMD Search**: Open the search sidebar
- **Search Selection**: Search for selected text

## Troubleshooting

### "qmd not found"
1. Check if qmd is installed: `which qmd` in terminal
2. Update the qmd path in settings (e.g., `~/.bun/bin/qmd`)
3. Click "Test" to verify connection

### "No results found"
1. Check vault is indexed: `qmd status` in terminal
2. If not indexed, use "Index Vault" button in settings
3. For semantic search, ensure embeddings are generated

### LLM errors
1. Verify your API key is correct
2. Check internet connection
3. For Ollama: ensure server is running (`ollama serve`)

### Auto-sync not working
1. Check that auto-sync is enabled in settings
2. Verify qmd path is correct
3. Check the console for error messages (Ctrl/Cmd + Shift + I)

## Changelog

### v0.3.0
- ✨ **Auto-Sync**: Automatic re-indexing on file save, startup, and scheduled intervals
- 🔧 Smart debouncing to batch rapid changes
- 📊 Sync status display in settings

### v0.2.0
- ✨ **One-Click Setup**: Install qmd, index vault, generate embeddings from settings
- 🎨 Improved settings UI

### v0.1.0
- 🎉 Initial release
- Hybrid search (keyword, semantic, hybrid with reranking)
- RAG chat with multiple LLM providers
- Related documents feature

## Development

```bash
# Clone the repo
git clone https://github.com/reallygood83/ragidian.git
cd ragidian

# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

## License

MIT

## Credits

- [qmd](https://github.com/tobi/qmd) by Tobi Lutke - The hybrid search engine
- [Obsidian](https://obsidian.md) - Knowledge management platform
