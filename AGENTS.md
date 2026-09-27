# 🤖 Agent Task Board

This file contains well-defined tasks that AI coding agents can pick up.
Each task has: context, goal, constraints, verification, and affected files.

## How to Use

AI agents (Antigravity, Claude, Cursor, etc.) can read this file and pick up tasks.
Each task is self-contained with enough context to implement independently.

---

## 🔴 Phase 1 — Foundation (Current)

### Task 1.1: Integrate LuaJIT into Gecko Build
- **Context:** Dev Browser is a Zen Browser fork. Custom code goes in `src/dev/`.
- **Goal:** Embed LuaJIT so that the browser loads `~/.config/dev/init.lua` at startup.
- **Constraints:** Don't modify engine/ files directly — generate patches. LuaJIT source should be vendored in `src/dev/lua-engine/vendor/`.
- **Verify:** `print("hello from lua")` in init.lua outputs to browser console.
- **Files:** `src/dev/lua-engine/`, `patches/003-lua-engine-hooks.patch`
- **Status:** ✅ Completed

### Task 1.2: Implement keymap.set() Lua API
- **Context:** LuaJIT is embedded (Task 1.1). Need to expose keyboard event interception.
- **Goal:** `keymap.set("n", "j", "scroll_down")` in init.lua makes `j` scroll the page down.
- **Constraints:** Must support modal editing (normal/insert modes). Must not interfere with text input fields.
- **Verify:** Press `j` on a webpage → page scrolls down. Type `j` in a text field → letter `j` appears.
- **Files:** `src/dev/lua-engine/keymap.js`, `src/dev/vim-mode/`
- **Status:** ✅ Completed

### Task 1.3: Build Command Palette
- **Context:** Zen Browser already has UI infrastructure. We need a Ctrl+K command bar.
- **Goal:** Pressing Ctrl+K opens a fuzzy-search overlay listing all browser actions, open tabs, and Lua commands.
- **Constraints:** Must be fast (<50ms to open). Must support keyboard navigation (arrow keys, Enter, Escape).
- **Verify:** Ctrl+K → type "new tab" → press Enter → new tab opens.
- **Files:** `src/dev/command-palette/`
- **Status:** ✅ Completed

### Task 1.4: Build Localhost Dashboard
- **Context:** New Tab page should show active localhost services.
- **Goal:** New tab scans ports 1000-65535 on 127.0.0.1 and displays active services.
- **Constraints:** Scan must complete in <2 seconds. Must detect service type from HTTP response headers.
- **Verify:** Start `python -m http.server 8000` → open new tab → shows "localhost:8000 — Python HTTP Server".
- **Files:** `src/dev/localhost-dashboard/`
- **Status:** ✅ Completed

### Task 1.5: Implement Basic Proxy Switching
- **Context:** Dev Browser should support one-click IP change via proxy.
- **Goal:** UI button in toolbar to switch between Direct, SOCKS5 proxy, and Tor.
- **Constraints:** Use Firefox's `proxy.onRequest` API. Must show current IP in toolbar.
- **Verify:** Click "Tor" → whatismyip.com shows a different IP.
- **Files:** `src/dev/network-panel/`
- **Status:** ✅ Completed

## 🟡 Phase 2 — AI Platform (Next)

### Task 2.1: Build MCP Server
- **Status:** ⬜ Not started
- *(Details to be added after Phase 1 completion)*

## 🟢 Phase 3 — Developer Workstation (Future)
## 🔵 Phase 4 — Ecosystem (Future)
