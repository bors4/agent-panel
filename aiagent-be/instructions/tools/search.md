# Search Tool

Search for text patterns in project files.

## Parameters

- `pattern` — search pattern (regex supported)
- `path` — optional directory to search in
- `include` — optional file pattern to include (e.g., `*.js`)

## Rules

1. Use regex patterns for flexible matching
2. Narrow search scope with `path` and `include` when possible
3. Results include file paths and line numbers
4. For exact text matches, use simple strings
5. For complex patterns, use regex (e.g., `function\s+\w+`)
