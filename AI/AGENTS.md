# Project instructions

## Codex audit trail

For every Codex chat request concerning this project, maintain the audit trail in `AI/audit/`.

1. Append to `AI/audit/YYYY-MM-DD.md`, using the local project date. Create the file when needed.
2. Record the user's chat input verbatim at the start of the entry.
3. Record notable commentary updates, decisions, assumptions, file changes, commands that materially changed state, and verification results. Summarize routine read-only inspection; do not paste noisy raw tool output.
4. Record the final response delivered to the user verbatim.
5. Use ISO 8601 timestamps with timezone offsets and keep entries chronological.
6. Never record credentials, tokens, private keys, authentication codes, or sensitive personal information. Replace any such value with `[REDACTED]`.
7. Do not rewrite or delete earlier audit entries. Corrections must be appended as new entries.

Follow the entry structure documented in `AI/audit/README.md`.

## AI-generated project artifacts

Keep AI-specific work products under `AI/`, not in the project root:

- Store audit records in `AI/audit/`.
- Store plans, inspection notes, and other AI-authored working documents in `AI/documentation/`.
- Store AI-generated or AI-comparison screenshots in `AI/screenshots/`.
- Add another clearly named subdirectory under `AI/` when an artifact does not fit these categories.

The root `AGENTS.md` is the required discovery hook for these instructions and should remain a minimal pointer to this file.
