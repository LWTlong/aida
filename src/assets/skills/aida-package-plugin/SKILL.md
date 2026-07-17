---
name: aida-package-plugin
description: Use when the user wants to package AI assets into a Claude Plugin for team reuse, OR wants to build the AIDA tool itself as a plugin for sharing with other developers.
---

# AIDA Package Plugin

## Goal
Package the right assets into a shareable Claude Plugin with minimal noise and clear risk. Also supports packaging the built-in AIDA skills themselves.

## Two Modes

### Mode A: Package Project Assets
Package rules, skills, docs, etc. from the current project for team sharing.

1. Call `aida_list_assets` to enumerate available assets.
2. Select the safest and most reusable assets (rules with IDs, skill files with clear descriptions).
3. Confirm the selection with the user.
4. Call `aida_build_plugin` with the selected `assetIds`, a `name`, `description`, and optional `version`.
5. Call `aida_audit_plugin_risk` on the returned `outputPath`.
6. Show the risk report and advise on next steps.

### Mode B: Package AIDA Itself
Package all built-in AIDA skills (aida-analyze, aida-cleanup, aida-remember, etc.) as a self-contained plugin for team sharing.

1. Call `aida_build_self_plugin` (no args needed — outputs to `.aida/plugins/aida-<version>/` by default).
2. Show the returned `outputPath` and `skills` list.
3. Tell the user: share the output directory with teammates who can install it via their AI tool's plugin install flow, or `aida copy-to cursor` to copy skills to `.cursor/`.

## Safety Rules
- Always run `aida_audit_plugin_risk` on Mode A output before sharing.
- Do not include tokens, private URLs, or absolute local paths in packaged assets.
- If risk level is `high`, show full findings and let the user decide before sharing.

## Output Format

### Result
| Metric | Value |
|--------|-------|
| Mode | A — project assets / B — AIDA self |
| Assets / Skills included | N |
| Output path | `.aida/plugins/...` |
| Risk level | low / medium / high |

**Next steps**: Share the output directory with teammates, or install into `.claude/` via your AI tool's plugin flow.
