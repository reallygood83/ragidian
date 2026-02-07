# QMD RAGidian

Hybrid search & RAG for Obsidian powered by [qmd](https://github.com/tobi/qmd).

Combines **BM25 keyword search**, **vector semantic search**, and **LLM reranking** - all running **100% locally** on your machine.

![Version](https://img.shields.io/badge/version-0.3.3-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.4%2B-purple)

## Key Benefits

- **Privacy First**: All search operations run locally. Your notes never leave your machine.
- **Works Offline**: After initial setup, search works without internet connection.
- **Smart Search**: Combines keyword matching + semantic understanding + AI reranking.

## Prerequisites

Before installing this plugin, you need [Bun](https://bun.sh) (a fast JavaScript runtime):

### Install Bun (macOS/Linux)

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install Bun (Windows)

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

After installation, restart your terminal and verify:
```bash
bun --version
```

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

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/reallygood83/ragidian/releases)
2. Create folder: `<vault>/.obsidian/plugins/qmd-ragidian/`
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin

## Quick Start

### One-Click Setup (Recommended)

1. Open Obsidian Settings → QMD RAGidian
2. Click **"One-Click Setup"** button
3. Wait for setup to complete (see below for what happens)
4. Done! Start searching via the magnifying glass icon in the sidebar.

#### What happens during setup?

| Step | Description | Download Size | Time |
|------|-------------|---------------|------|
| 1. Install qmd | Downloads qmd CLI tool | ~5 MB | ~30 sec |
| 2. Index Vault | Scans all markdown files | - | ~1 min |
| 3. Download Models | AI models from HuggingFace | ~1.6 GB | 5-15 min* |
| 4. Generate Embeddings | Creates vector index | - | 1-5 min** |

*Depends on internet speed. **Depends on vault size.

**Total first-time setup: ~10-20 minutes** (mostly model download)

After setup, everything runs locally - no internet needed for search!

### Manual Setup (Advanced)

```bash
# Install qmd globally
bun install -g https://github.com/tobi/qmd

# Add your vault as a collection
qmd collection add ~/path/to/your/vault --name MyVault

# Generate embeddings for semantic search
qmd embed
```

Then set the qmd path in plugin settings (usually `~/.bun/bin/qmd`).

## Features

### Search Modes
- **Keyword (BM25)**: Fast exact/fuzzy text matching
- **Semantic**: Find conceptually similar content
- **Hybrid**: Best of both + AI reranking (recommended)

### RAG Chat (Optional)
Ask questions about your notes using AI:
- Requires API key from OpenAI, Anthropic, Google, or local Ollama
- Your notes are used as context (sent to API provider)

### Related Documents
- Automatically shows related notes when viewing a file
- Uses semantic similarity to find connections

### Auto-Sync
- **On Startup**: Check for changes when Obsidian starts
- **On Save**: Re-index modified files automatically
- **Scheduled**: Periodic background sync

## Configuration

### qmd Settings
| Setting | Description | Default |
|---------|-------------|---------|
| qmd Path | Path to qmd executable | Auto-detected |
| Default Search Mode | Initial search mode | Hybrid |
| Result Limit | Max search results | 10 |

### LLM Settings (for RAG Chat)
| Provider | API Key Required | Notes |
|----------|-----------------|-------|
| OpenAI | Yes | GPT-4o, GPT-5.x |
| Anthropic | Yes | Claude 4.x |
| Google Gemini | Yes | Gemini 2.5/3 |
| Ollama | No | Local models, must run `ollama serve` |

## Troubleshooting

### "Not Connected" in settings

**Cause**: Plugin can't communicate with qmd CLI.

**Solutions**:
1. Click **"Auto-detect"** to find qmd path
2. If not found, click **"One-Click Setup"** to install
3. Check if Bun is installed: `bun --version` in terminal
4. Manual path: usually `~/.bun/bin/qmd`

### "qmd not found" or "No package manager found"

**Cause**: Bun (or npm) is not installed.

**Solution**: Install Bun first:
```bash
curl -fsSL https://bun.sh/install | bash
```
Then restart Obsidian and try again.

### Setup seems stuck / taking too long

**Cause**: Downloading ~1.6GB of AI models.

**Solutions**:
1. Wait - first setup takes 10-20 minutes
2. Check internet connection
3. Check `~/.cache/qmd/models/` folder for download progress

### "No results found"

**Causes & Solutions**:
1. Vault not indexed → Click "Index Vault" in settings
2. Embeddings not generated → Click "Sync Now" in settings
3. Query too specific → Try broader search terms

### Search is slow

**Cause**: First search after restart loads AI models into memory.

**Solution**: First search takes 5-10 seconds. Subsequent searches are instant.

## Storage Usage

| Component | Location | Size |
|-----------|----------|------|
| AI Models | `~/.cache/qmd/models/` | ~1.6 GB |
| Search Index | `~/.cache/qmd/index.sqlite` | Varies (50-200 MB) |

## Changelog

### v0.3.3
- Fix: Connection status now correctly detects working qmd installation

### v0.3.0
- Auto-Sync: Automatic re-indexing on file save, startup, and scheduled intervals
- Smart debouncing to batch rapid changes

### v0.2.0
- One-Click Setup: Install qmd, index vault, generate embeddings from settings

### v0.1.0
- Initial release with hybrid search, RAG chat, related documents

## Development

```bash
git clone https://github.com/reallygood83/ragidian.git
cd ragidian
npm install
npm run dev   # Development build (watch mode)
npm run build # Production build
```

## License

MIT

## Credits

- [qmd](https://github.com/tobi/qmd) by Tobi Lutke - The hybrid search engine
- [Obsidian](https://obsidian.md) - Knowledge management platform
