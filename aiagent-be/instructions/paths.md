# Path Rules

All paths in tool calls MUST be relative to the project root.

## Examples

- GOOD: `src/app.js`, `tests/utils.test.js`, `.env`
- BAD: `E:\project\src\app.js`, `/home/user/project/src/app.js`

## Rules

1. Never use absolute paths in tool arguments
2. Use forward slashes (`/`) or backslashes (`\`) — both work on Windows
3. Paths are resolved relative to the project directory
4. Parent directory traversal (`../`) is allowed within project bounds
