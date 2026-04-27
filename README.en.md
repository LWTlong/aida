<div align="center">

# AIDA

### Make Vibe Coding Measurable.

Every vibe coding session generates massive insights — deviations, patterns, quality signals.<br>
*But you close the terminal, and all of it vanishes. Next session, you start blind again.*<br>
**AIDA captures structured data at every development checkpoint, visualizes it in a live dashboard, and distills deviation patterns into rules that make your AI write better code — every single run.**

One line to integrate. Zero workflow changes.

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["-y", "ai-dev-analytics", "mcp"] } } }
```

[![npm version](https://img.shields.io/badge/npm-v1.1.6-0066ff)](https://www.npmjs.com/package/ai-dev-analytics)
[![license](https://img.shields.io/github/license/LWTlong/ai-dev-analytics?color=%23333)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-dev-analytics?color=%23339933)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](#testing)
[![Live Demo](https://img.shields.io/badge/🎯_Live_Demo-Interactive_Dashboard-FF4B4B)](https://lwtlong.github.io/ai-dev-analytics/)
[![ai-dev-analytics MCP server](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics/badges/score.svg)](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics)

[![ai-dev-analytics MCP server](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics/badges/card.svg)](https://glama.ai/mcp/servers/LWTlong/ai-dev-analytics)

[Quick Start](#-30-second-setup) · [Data Loop](#-the-data-driven-loop) · [Dashboard](#-the-dashboard) · [Command Reference](./COMMANDS.md) · [Docs](./docs/INDEX.md) · [中文](./README.md)

</div>

---

## The Insight

Vibe coding is powerful. But it's a black box.

You tell Claude to build a feature. It writes code. You ship it. But you have **zero visibility** into what actually happened:

- How many tasks did AI complete? How long did each take?
- Where did AI deviate from your project conventions? Why?
- Which deviations keep recurring? What rules would prevent them?
- What's the bug rate? Which phases produce the most bugs?

Without data, you can't improve. You're just vibing — over and over, with the same blind spots.

**AIDA makes the invisible visible.** It collects structured data from every vibe coding session, renders it in a real-time dashboard, and turns deviation patterns into project rules. Your AI doesn't just code — it **learns your project**.

---

## 🔄 The Data-Driven Loop

```
Vibe Coding Session
        ↓
   AIDA silently collects structured data
   (tasks, deviations, bugs, reviews, files, timeline)
        ↓
   Dashboard visualizes patterns
        ↓
   Deviation patterns identified → AI suggests rules → user confirms → sedimented
   .aida/rules.json
        ↓
   AI reads rules next session → same mistakes eliminated
```

See the Chinese main README for the latest product positioning and examples: [README.md](./README.md).

---

## 📊 The Dashboard

Run:

```bash
npx ai-dev-analytics dashboard
```

Then open `http://localhost:2375`.

Live demo: [https://lwtlong.github.io/ai-dev-analytics/](https://lwtlong.github.io/ai-dev-analytics/)

---

## ⚡ 30-Second Setup

Add one MCP entry:

```json
{ "mcpServers": { "aida": { "command": "npx", "args": ["-y", "ai-dev-analytics", "mcp"] } } }
```

For detailed command behavior, migration notes, dedupe rules, and rerun semantics, see [COMMANDS.md](./COMMANDS.md).
