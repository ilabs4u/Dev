# 🤖 Agent Task Board

This file contains well-defined tasks that AI coding agents can pick up.
Each task has: context, goal, constraints, verification, and affected files.

## How to Use

AI agents (Antigravity, Claude, Cursor, etc.) can read this file and pick up tasks.
Each task is self-contained with enough context to implement independently.

---

## 🟢 Phase 1 — Foundation (Completed)

### Task 1.1: Integrate LuaJIT into Gecko Build
- **Status:** ✅ Completed (56 tests passing)

### Task 1.2: Implement keymap.set() Lua API
- **Status:** ✅ Completed

### Task 1.3: Build Command Palette
- **Status:** ✅ Completed

### Task 1.4: Build Localhost Dashboard
- **Status:** ✅ Completed

### Task 1.5: Implement Basic Proxy Switching
- **Status:** ✅ Completed

---

## 🟢 Phase 1.5 — Hotfix & Polish (Completed)

### Task 1.5.1: Guard `plugins/hash.lua` against missing `dev.crypto` bridge
- **Status:** ✅ Completed

### Task 1.5.2: Seed `plugins/uuid.lua` with non-deterministic random seed
- **Status:** ✅ Completed

### Task 1.5.3: Align `README.md` Lua API examples with implementation
- **Status:** ✅ Completed

### Task 1.5.4: Tighten localhost framework detector matching & negative tests
- **Status:** ✅ Completed

### Task 1.5.5: Shared `escapeHtml` utility and `s.url` escaping in dashboard
- **Status:** ✅ Completed

---

## 🟢 Phase 2A — MCP Server (Completed)

### Task 2A.1: MCP JSON-RPC 2.0 Protocol Core
- **Goal:** Implement JSON-RPC 2.0 protocol core (`initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`).
- **Files:** `src/dev/mcp-server/protocol.js`
- **Status:** ✅ Completed

### Task 2A.2: Stdio Transport
- **Goal:** Stdin/stdout transport for Claude Desktop / AI tools.
- **Files:** `src/dev/mcp-server/transports/stdio.js`
- **Status:** ✅ Completed

### Task 2A.3: WebSocket Transport
- **Goal:** Lightweight RFC 6455 WebSocket transport on port 9222.
- **Files:** `src/dev/mcp-server/transports/websocket.js`
- **Status:** ✅ Completed

### Task 2A.4: 19 Browser MCP Tools
- **Goal:** Implement all 19 tools (navigation, tabs, interaction, content, devtools).
- **Files:** `src/dev/mcp-server/tools/`
- **Status:** ✅ Completed

### Task 2A.5: Permission Manager
- **Goal:** Enforce `agent.permissions.*` security model and confirmation dialogs.
- **Files:** `src/dev/mcp-server/permission-manager.js`
- **Status:** ✅ Completed

### Task 2A.6: MCP Resources
- **Goal:** Implement `mcp://dom/current`, `mcp://network/failed`, `mcp://console/errors`.
- **Files:** `src/dev/mcp-server/resources/`
- **Status:** ✅ Completed

### Task 2A.7: Comprehensive Test Suite
- **Goal:** 30+ tests verifying protocol, tools, permissions, resources, transports.
- **Files:** `tests/mcp-server.test.js`
- **Status:** ✅ Completed (39 new tests passing; 100 total passing)

---

## 🟢 Phase 2B — Agent Tree (Distilled DOM) (Completed)

### Task 2B.1: DOM Distillation Engine
- **Goal:** Walk DOM, identify interactive elements, assign labels (A, B, C... AA, AB...), extract semantics in <100ms.
- **Files:** `src/dev/agent-tree/distiller.js`
- **Status:** ✅ Completed

### Task 2B.2: Visual Overlay
- **Goal:** Persistent toggleable overlay showing Agent Tree labels over interactive page elements.
- **Files:** `src/dev/agent-tree/overlay.js`, `overlay.css`
- **Status:** ✅ Completed

### Task 2B.3: Wire Agent Tree into MCP & Vim Mode
- **Goal:** Deepen `get_interactive_elements`, `click`, and `fill` tools with distiller output; wire `<leader>at` shortcut.
- **Files:** `src/dev/mcp-server/browser-context.js`, `src/dev/vim-mode/vim-controller.js`, `src/dev/lua-engine/keymap.js`
- **Status:** ✅ Completed (53 new tests passing; 167 total passing)

---

## 🟡 Phase 2C — AI Sidebar (BYOM) (Next)
- Providers (Ollama, OpenAI, Claude, LM Studio), Chat UI, and Lua AI API.
- **Status:** ⬜ Not started

---

## 🟢 Phase 3 — Developer Workstation (Future)
- Embedded Terminal, Dev Toolkit, DNS Panel, Theme Engine, Docker Dashboard.
- **Status:** ⬜ Not started
