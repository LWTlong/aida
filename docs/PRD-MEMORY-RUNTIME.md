# AIDA Memory Runtime PRD

> Historical design reference. This document captures an earlier transition design between 1.x runtime memory and the later 2.0 truth-source model. For the current public behavior, use [README.md](../README.md), [COMMANDS.md](../COMMANDS.md), and [docs/AIDA-2.0-DESIGN.md](./AIDA-2.0-DESIGN.md) as the canonical references.

## Background

AIDA already manages project rules, skills, MCP access, and development observability. What is still missing is stable context recovery across:

- different machines
- different AI tools
- long time gaps between iterations
- repeated changes to the same business module under different tickets

The current system relies too much on short-lived model session context and ad hoc file reading. This causes code generation drift when the model does not know historical module constraints, prior design decisions, or hidden implementation pitfalls.

## Problem Statement

When a developer returns to a module after days or months, the AI often lacks:

- module purpose
- historical design decisions
- known pitfalls
- key entry files
- previous tickets that changed the same area

Reading all history on every run is not token-efficient. Not reading history at all increases deviation risk.

## Product Goals

1. Recover high-value module context with low token cost.
2. Make rules and memory lookup part of the enforced runtime workflow.
3. Keep JSON as the single system source of truth.
4. Use build to generate AI-readable views.
5. Make MCP the primary execution channel for structured writes and guarded reads.

## Non-Goals

1. Do not build a fully autonomous multi-agent runtime in the first release.
2. Do not require every project to use built-in skills.
3. Do not make AI read the entire project memory corpus on every task.

## Target Users

- developers switching between office and home machines
- teams switching between Claude Code, Cursor, Codex, and other tools
- long-lived projects with repeated work on the same module

## Core Product Principles

1. `rules` and `memory` are mandatory for the full AIDA value proposition.
2. built-in `skills` are optional acceleration layers.
3. MCP is the primary runtime contract.
4. Memory must be discoverable before it is readable.
5. No large monolithic context file.

## User Stories

1. As a developer, when I start working on "personal center", AIDA should let the AI quickly discover whether the project already has memory for that module.
2. As a developer, when the AI finds relevant module memory, it should read only that module memory instead of the full history.
3. As a developer, when no module memory exists, the AI should fall back to normal code analysis without breaking the workflow.
4. As a developer, after finishing a ticket, I want the important summary and decisions to be written back into structured memory for future retrieval.
5. As a team lead, I want rule sedimentation and memory updates to happen through MCP so the process is consistent and auditable.

## Scope

### Required

- project-level memory index
- module-scoped memory records
- run-scoped context records
- build-generated markdown views
- MCP tools for memory search/get/upsert
- guide/runtime enforcement for rules + memory lookup

### Optional

- automatic memory rebuild from existing run data
- selective import from historical docs
- optional use of built-in skills

## Information Architecture

### Source of Truth

- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/tool-configs.json`
- `.aida/memories/index.json`
- `.aida/memories/modules/{moduleKey}.json`
- `.aida/runs/{branch}/context.json`

### Generated Views

- AI tool rule files
- AI tool skill files
- `.aida/memories/modules/{moduleKey}.md`
- `.aida/runs/{branch}/context.md`

## Main Workflow

1. AI starts task.
2. Read guide.
3. Read rule files.
4. Search memory index for current module.
5. If matched, read matched module memory and branch context.
6. Execute task.
7. If a new project-level rule is discovered, use MCP to write it into JSON.
8. If the task produces meaningful historical knowledge, update run context and module memory through MCP.

## Functional Requirements

### FR-1 Memory Index

The system must support a small searchable module index that includes:

- module key
- title
- summary
- keywords
- related paths
- updatedAt

### FR-2 Module Memory

The system must support one JSON memory document per module containing:

- purpose
- key files
- data flow
- decisions
- constraints
- pitfalls
- related rules
- related tickets

### FR-3 Run Context

The system must support one branch-scoped context record that stores:

- ticket
- summary
- current phase
- completed/in-progress/next
- linked modules
- key files
- risks

### FR-4 Build

The build pipeline must convert structured memory JSON into AI-readable markdown views.

### FR-5 MCP Runtime

The MCP server must expose memory capabilities:

- search
- get
- upsert
- rebuild in later phases

### FR-6 Runtime Enforcement

The guide and AI tool entry files must require:

1. read rules
2. search relevant memory
3. read matched memory before implementation

### FR-7 Graceful Fallback

If no matching memory exists, the system must continue with standard code analysis.

## Success Metrics

1. lower deviation rate on repeated-module changes
2. fewer rule-missing deviations on mature modules
3. lower token spend than full-history reads
4. higher consistency across machines and AI tools

## Risks

1. models may skip reads without MCP/runtime enforcement
2. oversized memory records can become another prompt burden
3. low-quality summaries will create false confidence
4. memory without ownership will go stale

## Roadmap

### Phase 1

- memory data model
- path helpers
- MCP memory tools
- guide enforcement

### Phase 2

- memory rebuild from runs / analysis / requirement
- path-based and keyword-based matching
- better review-time enforcement

### Phase 3

- context package assembly
- lightweight runtime orchestration
- selective automatic memory maintenance
