# Codex audit trail

This directory contains the chronological record of Codex work performed on the Innings project. It lives under `AI/` with the project's other AI-specific work products.

Audit files are named by local date: `YYYY-MM-DD.md`. Each chat request receives one entry with this structure:

```markdown
## 2026-07-22T21:16:03-07:00 — Short request label

### User input

> The user's input, preserved verbatim.

### Notable updates

- Important investigation, decision, assumption, or implementation update.
- Files created, edited, moved, or removed.
- Material commands and their outcome.

### Verification

- Checks performed and their results.

### Final output

The final response delivered to the user, preserved verbatim.
```

Routine read-only commands and long raw tool output should be summarized. Credentials, tokens, authentication codes, private keys, and sensitive personal information must never be stored; use `[REDACTED]` in their place.

Audit history is append-only. If an earlier entry needs correction, append a correction rather than changing the historical record.
