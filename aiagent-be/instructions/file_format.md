# File Format Rules

Content written by the `write` tool is saved as-is — no wrappers, no response objects.

## Format Matching

Match content format to file extension:

| Extension | Format |
|-----------|--------|
| `.json` | Valid JSON |
| `.html` | Complete HTML document |
| `.py` | Valid Python |
| `.js` / `.ts` | Valid JavaScript/TypeScript |
| `.md` | Markdown |
| `.yaml` / `.yml` | Valid YAML |

## Rules

1. For structured data files, provide the raw data structure — not a stringified version
2. Ensure JSON is valid (no trailing commas, proper quoting)
3. HTML files should be complete documents (with `<!DOCTYPE>`, `<html>`, etc.)
4. Code files should follow the project's existing style
