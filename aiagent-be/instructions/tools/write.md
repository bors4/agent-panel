# Write Tool

Create or overwrite files in the project.

## Parameters

- `filePath` — relative path to the file
- `content` — file content (saved as-is)

## Rules

1. Use relative paths only
2. Match content format to file extension (see file_format.md)
3. For structured data, provide raw structure — not stringified
4. Content is saved as-is — no wrappers added
5. Overwrite existing files only when explicitly requested
