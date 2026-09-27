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

## 🟢 Phase 2C — AI Sidebar (BYOM) (Completed)

### Task 2C.1: Bring Your Own Model Providers
- **Goal:** Abstract `BaseProvider` streaming interface, native `OllamaProvider` (NDJSON), `OpenAIProvider` (SSE with custom `baseUrl`), `ClaudeProvider` (Anthropic Messages API), `LMStudioProvider` (`http://localhost:1234/v1`), and dynamic `ProviderRegistry`.
- **Files:** `src/dev/ai-sidebar/providers/`
- **Status:** ✅ Completed

### Task 2C.2: Responsive Collapsible Chat Sidebar UI
- **Goal:** Dark-themed sidebar panel with streaming token append, markdown parsing, code blocks with copy button, stop generation, clear chat, and model selector.
- **Files:** `src/dev/ai-sidebar/sidebar.html`, `sidebar.css`, `sidebar.js`
- **Status:** ✅ Completed

### Task 2C.3: Active Page Context Extractor
- **Goal:** Extract active tab content, text selection, console error buffer, and Agent Tree interactive elements into prompt actions ("Summarize page", "Explain error", "Analyze page").
- **Files:** `src/dev/ai-sidebar/context.js`
- **Status:** ✅ Completed

### Task 2C.4: Lua Bridge & Vim Mode Integration
- **Goal:** Expose `ai.default_backend`, `ai.ask(prompt)`, `ai.summarize(text)` to Lua engine; wire `<leader>ai` shortcut to toggle AI sidebar.
- **Files:** `src/dev/lua-engine/lua-bridge.js`, `src/dev/vim-mode/vim-controller.js`, `src/dev/lua-engine/keymap.js`
- **Status:** ✅ Completed (61 new tests passing; 228 total passing)

---

## 🟢 Phase 3 — Developer Workstation (Completed)

### Task 3.1: Embedded Terminal
- **Goal:** Terminal controller and UI (`terminal.html`, `terminal.css`, `terminal.js`), WebSocket bridge to daemon PTY, multi-tab terminal, horizontal/vertical split view, clipboard copy/paste, clear, and `<leader>t` shortcut integration.
- **Files:** `src/dev/terminal/`, `src/dev/vim-mode/vim-controller.js`, `src/dev/lua-engine/keymap.js`
- **Status:** ✅ Completed

### Task 3.2: Comprehensive Offline Dev Toolkit
- **Goal:** 8 offline developer tools (Base64 standard & url-safe, JWT inspector & claims, JSON formatter/validator/minifier, Hash generator MD5/SHA-1/SHA-256/SHA-512 with native `dev.crypto.digest` bridge for `plugins/hash.lua`, UUID v4 generator & batch, Timestamp/Epoch converter with relative times, Regex tester with flags/indices/groups, `.http` RFC 7230 REST client with timing) and UI panel.
- **Files:** `src/dev/dev-toolkit/`, `src/dev/lua-engine/lua-bridge.js`
- **Status:** ✅ Completed

### Task 3.3: DNS Panel & DNS-over-HTTPS (DoH) Engine
- **Goal:** DoH engine supporting Cloudflare, Quad9, Google, NextDNS, and custom DoH resolvers, per-domain DNS override table (e.g. `test.local` -> `127.0.0.1`), query logging, and Lua bridge (`network.dns.set`, `network.dns.override`).
- **Files:** `src/dev/network-panel/dns-engine.js`, `src/dev/network-panel/network-panel.html/js/css`, `src/dev/lua-engine/lua-bridge.js`
- **Status:** ✅ Completed

### Task 3.4: Theme Engine & Arc-Style Boosts
- **Goal:** 7 built-in developer themes (`gruvbox-dark`, `catppuccin-mocha`, `tokyo-night`, `dracula`, `nord`, `one-dark`, `light`), CSS variable token injection across browser chrome and panels, scheduled day/night auto-switching, per-domain CSS/JS Boost injection (`boost.create()`), and Lua bridge integration.
- **Files:** `src/dev/theme-engine/`, `src/dev/lua-engine/lua-bridge.js`
- **Status:** ✅ Completed (65 new tests passing; 293 total passing)

---

## 🟡 Phase 4 / Phase 3 Remaining — Docker Dashboard & Packaging (Next)
- Docker Dashboard (`daemon` bridge), full cross-platform build infrastructure and packaging.
- **Status:** ⬜ Next

