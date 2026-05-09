# AIDA Memory Runtime Technical Design

> Historical design reference. This document describes an earlier transition architecture before the final 2.0 truth-source cleanup. For the current public behavior, use [README.md](../README.md), [COMMANDS.md](../COMMANDS.md), and [docs/AIDA-2.0-DESIGN.md](./AIDA-2.0-DESIGN.md) as the canonical references.

## Objective

Refactor AIDA so future context recovery and runtime orchestration can evolve on top of a stable architecture instead of scattered command-specific logic.

## Current Architectural Issues

1. project source concepts are duplicated across `build`, `import`, and `init`
2. path logic is scattered
3. memory/runtime concepts do not have first-class schemas
4. MCP is present, but memory retrieval and update are not part of the runtime contract yet
5. guide enforcement exists for rules, but not for targeted memory retrieval

## Refactoring Direction

### 1. Source Layer

All durable project sources should be modeled explicitly:

- config
- rules registry
- skills registry
- imported tool config store
- memory index
- module memory
- run context

These should all be JSON-backed.

### 2. View Layer

Build transforms JSON sources into:

- AI tool rule files
- AI tool skill files
- AI-readable module memory markdown
- AI-readable branch context markdown

### 3. Runtime Layer

MCP becomes the contract for:

- rule sedimentation
- memory search
- memory read
- memory upsert
- later context rebuild

### 4. Optional Skill Layer

Built-in skills remain optional. They should not be required for the core value of:

- rules
- memory
- MCP runtime
- observability

## Proposed Files

### Schemas

- `src/schemas/aida-project.ts`

Contains:

- `AiToolChoice`
- `AidaConfig`
- `ToolConfigSnapshot`
- `ToolConfigStore`
- `ModuleMemoryRecord`
- `ModuleMemoryIndex`
- `RunContextRecord`

### Path Helpers

Extend `src/utils/paths.ts` with:

- `rulesRegistryPath`
- `skillsRegistryPath`
- `toolConfigStorePath`
- `memoryIndexPath`
- `moduleMemoryPath`
- `moduleMemoryViewPath`
- `runContextPath`
- `runContextViewPath`

### Memory Utility

- `src/utils/memory.ts`

Responsibilities:

- normalize module keys
- load/save memory index
- load/save module memory
- load/save run context

## Proposed Runtime APIs

### CLI

Future commands:

- `aida memory search <query>`
- `aida memory get <moduleKey>`
- `aida memory edit <moduleKey>`
- `aida context rebuild`

### MCP

Future tools:

- `aida_memory_search`
- `aida_memory_get`
- `aida_memory_upsert`
- `aida_context_get`
- `aida_context_upsert`
- `aida_context_rebuild`

## Retrieval Strategy

This should follow a two-step retrieval model:

1. search the small memory index
2. only if matched, load the target module memory

This is more token-efficient than:

- full-history reads
- monolithic context files

## Best-Practice References

The design aligns with mature patterns from:

1. Anthropic "Building Effective Agents"
2. Anthropic "Contextual Retrieval"
3. LangGraph / LangChain separation of short-term vs long-term memory

The key takeaways applied here:

- keep runtime simple and composable
- separate short-term and long-term memory
- use retrieval before loading heavy context
- do not depend on monolithic prompts

## Reliability Model

### Without MCP

- memory exists
- AI may ignore it
- no structured write-back
- low enforcement

### With MCP

- memory lookup is tool-driven
- write-back is structured
- guide can require specific tool use
- behavior becomes observable and auditable

Therefore, MCP is not just an optional addon. For the evolved AIDA architecture, it is the primary runtime control plane.

## Recommended Product Layering

### Mandatory

- rules
- memory
- MCP
- build
- observability

### Optional

- built-in skills
- quick commands
- tool-specific developer UX sugar

## Why Not Jump Directly to a Full Agent

A full autonomous agent runtime is a later-stage architecture. The immediate need is not autonomous planning but reliable memory-aware execution. The recommended sequence is:

1. memory runtime
2. retrieval + enforcement
3. context package assembly
4. lightweight agent orchestration

This avoids overbuilding before the memory model is validated.

## Implementation Plan

### Now

- centralize schemas and path helpers
- add memory data scaffolding
- keep current commands compiling on the new project model
- document the target architecture

### Next

- implement memory CLI + MCP tools
- extend guide/runtime contract
- add build output for memory markdown

### Later

- selective auto-rebuild from historical runs
- module-to-run linking
- context package assembly
- stronger runtime orchestration
