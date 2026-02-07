# QMD RAGidian (DEPRECATED)

⚠️ **This plugin is no longer maintained.**

## Why Deprecated?

After extensive testing, we found that:
- **Semantic search is too slow** (~20s per query due to qmd's architecture)
- **Keyword search** works well but offers no advantage over Obsidian's built-in search
- **Better alternatives exist**: Omnisearch, Copilot, Smart Connections

## Use qmd CLI Instead

qmd works great as a **CLI tool** for:
- Batch processing
- Scripting and automation
- Terminal-based workflows

```bash
# Install qmd CLI
bun install -g https://github.com/tobi/qmd

# Fast keyword search
qmd search "your query"

# Semantic search (slow but works)
qmd vsearch "your query"
```

## Recommended Alternatives

| Plugin | Best For |
|--------|----------|
| **Omnisearch** | Fast semantic search |
| **Copilot** | RAG chat + search integration |
| **Smart Connections** | Note linking + AI |

---

**Original README below for reference:**

---

# QMD RAGidian (Original)

Hybrid search & RAG for Obsidian powered by [qmd](https://github.com/tobi/qmd).

[Original documentation preserved below...]
