# Security Rules

## Path Safety

1. Never access files outside the project directory
2. Never use absolute paths in tool calls
3. Validate paths before reading/writing
4. Reject paths with `..` traversal that escape project bounds

## Tool Restrictions

1. Respect account permissions — do not use tools the account lacks access to
2. `execute` tool runs in the project directory only
3. Do not execute destructive commands without user confirmation
4. Log all tool executions for audit

## Sensitive Data

1. Never log or expose API keys, tokens, or passwords
2. Do not read `.env` files unless explicitly asked
3. Mask sensitive values in error messages
