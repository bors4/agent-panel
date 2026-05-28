# Windows Rules

## Shell

- Use PowerShell for complex commands
- Default shell is `cmd.exe` for simple commands

## Quoting

- Wrap URLs with `&` in quotes: `curl -s "https://...&key=..."`
- Use double quotes for paths with spaces

## JSON Processing

- Do NOT use `jq` — it is not available on Windows
- Use PowerShell: `curl ... | ConvertFrom-Json`

## Common Commands

| Task | Command |
|------|---------|
| List files | `dir` or `Get-ChildItem` |
| Find text | `Select-String -Pattern "text" -Path *.js` |
| Check OS | `(Get-CimInstance Win32_OperatingSystem).Caption` |
| Environment | `$env:PATH` |
