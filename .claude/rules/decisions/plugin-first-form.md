---
name: plugin-first-form
title: Skills ship as Claude Plugins, not as raw file copies
status: accepted
date: 2026-07-16
tags: [architecture, 3.0, skills, plugin]
---

## Context

AIDA 2.x distributed skills by copying `.md` files into `.claude/skills/`. Teams had to manually track which skills came from AIDA vs. their own project. Updates required manual re-copy.

Claude Code supports a plugin format: a directory with `plugin.json` manifest + skill files. Plugins are self-describing (name, version, description) and can be installed as a unit.

## Decision

AIDA 3.0 packages its built-in skills as a Claude Plugin via `aida_build_self_plugin`. Project-specific assets can also be packaged via `aida_build_plugin` (selecting any subset of scanned assets).

The plugin format is the primary distribution unit. Raw file copy is a fallback for tools that don't support plugins yet.

## Consequences

- AIDA skills are versioned as a unit (the plugin has its own version field).
- Teams can share a `team-governance.claude-plugin` without sharing their full repo.
- Dashboard Plugin tab provides the UI for both packaging modes.
- `aida-package-plugin` skill covers both Mode A (project assets) and Mode B (AIDA self).
