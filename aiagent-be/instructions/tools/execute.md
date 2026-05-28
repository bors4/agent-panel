# Execute Tool

Run shell commands in the project directory.

## Parameters

- `command` — shell command to execute
- `timeout` — optional timeout in seconds (default: 30)

## Rules

1. Detect OS first if unknown — Windows (PowerShell) or Unix (bash)
2. Prefer simple one-line commands; avoid complex scripts or pipes
3. For checking versions: `--version` or `-v`
4. For checking help: `--help` or `-h`
5. stderr is returned — use it to diagnose failures
6. Working directory is the project root
7. For long-running commands, set timeout to 0 (no limit)
