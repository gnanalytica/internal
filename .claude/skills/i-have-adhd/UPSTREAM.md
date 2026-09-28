# Vendored skill

Source: https://github.com/ayghri/i-have-adhd (MIT)
Commit: 839872f9d1cd634fed642b4589ce7226199cc15f (2026-09-19)
Path upstream: `skills/i-have-adhd/`

Only the skill is vendored. The upstream repo also ships a plugin manifest and a
SessionStart hook that injects this ruleset permanently; neither is taken — the
skill carries `disable-model-invocation: true`, so it is opt-in per session via
`/i-have-adhd`, which is the point. Re-sync by copying `skills/i-have-adhd/`
from a newer upstream commit and updating the sha above.
