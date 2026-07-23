# Project instructions

## Codex audit trail

For every Codex chat request concerning this project, maintain the audit trail in `.audit/`.

1. Append to `.audit/YYYY-MM-DD.md`, using the local project date. Create the file when needed.
2. Record the user's chat input verbatim at the start of the entry.
3. Record notable commentary updates, decisions, assumptions, file changes, commands that materially changed state, and verification results. Summarize routine read-only inspection; do not paste noisy raw tool output.
4. Record the final response delivered to the user verbatim.
5. Use ISO 8601 timestamps with timezone offsets and keep entries chronological.
6. Never record credentials, tokens, private keys, authentication codes, or sensitive personal information. Replace any such value with `[REDACTED]`.
7. Do not rewrite or delete earlier audit entries. Corrections must be appended as new entries.

Follow the entry structure documented in `.audit/README.md`.
