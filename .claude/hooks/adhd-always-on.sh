#!/bin/bash
# SessionStart hook: inject the i-have-adhd ruleset into every session in this
# repo, so the output style is on by default instead of needing /i-have-adhd.
#
# The skill itself carries `disable-model-invocation: true`, which is what makes
# it opt-in — so turning it on by default has to happen here, not by editing the
# vendored SKILL.md (that would drift from upstream and break the re-sync).
#
# Adapted from upstream's hooks/always-on.sh (MIT, github.com/ayghri/i-have-adhd).
# Two deliberate differences: no opt-in flag file (committing this file IS the
# opt-in, and a flag in ~/.claude would not survive this repo's ephemeral cloud
# containers), and the path is resolved from CLAUDE_PROJECT_DIR rather than $0.
#
# Never blocks session start: every failure path exits 0.

skill="${CLAUDE_PROJECT_DIR:-.}/.claude/skills/i-have-adhd/SKILL.md"
[ -f "$skill" ] || exit 0

# Strip the YAML frontmatter. An unterminated fence is not frontmatter, so the
# whole file is kept unless the closing delimiter exists — hence two passes.
body=$(awk '
  NR == FNR {
    if (NR == 1 && $0 ~ /^---[[:space:]]*$/) { in_fm = 1; next }
    if (in_fm && $0 ~ /^---[[:space:]]*$/)   { in_fm = 0; closed = 1 }
    next
  }
  FNR == 1 { strip = closed }
  strip && FNR == 1 && $0 ~ /^---[[:space:]]*$/ { skipping = 1; next }
  skipping && $0 ~ /^---[[:space:]]*$/          { skipping = 0; next }
  !skipping { print }
' "$skill" "$skill") || exit 0

printf 'ADHD MODE ACTIVE (on by default in this repo). The ruleset below applies to every response. Say "stop adhd mode" to turn it off for this session.\n\n%s\n' "$body"
