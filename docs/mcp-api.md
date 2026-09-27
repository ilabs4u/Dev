# MCP API Reference

## What is MCP?
The Model Context Protocol (MCP) allows AI agents to interact securely with local applications. Dev Browser has a native MCP server built-in to allow AI assistants (like Claude, Cursor, Copilot) to control the browser, read pages, and assist developers.

## Connection
- **Transport**: stdio or WebSocket.
- **Port**: 9222 (WebSocket, configurable via `agent.mcp.port` in Lua config).

## Tools (19 Tools)
Agents can invoke the following tools:

### Navigation
- `navigate_to`: Navigate active or specified tab to a URL.
- `go_back`: Navigate back in history.
- `go_forward`: Navigate forward in history.
- `reload`: Reload the current page.
- `get_current_url`: Get URL and title of active tab.

### Tabs
- `list_tabs`: List all open tabs.
- `new_tab`: Open a new tab with optional URL.
- `close_tab`: Close a tab by ID.
- `switch_tab`: Switch active focus to a tab ID.

### Interaction (Agent Tree)
- `get_interactive_elements`: Extract all clickable and fillable elements labeled with Agent Tree labels (`A`, `B`, `C`...).
- `click`: Click element by CSS selector or Agent Tree label.
- `fill`: Fill form field by CSS selector or Agent Tree label.

### Content
- `get_page_content`: Get page content formatted as text, HTML, or markdown.
- `screenshot`: Capture tab viewport as base64 PNG/JPEG.
- `evaluate_js`: Run JavaScript expression in page context.
- `get_console_logs`: Retrieve recent page console logs.

### DevTools
- `get_css`: Get computed styles for an element matching selector.
- `get_performance`: Get page load timing and resource metrics.
- `get_accessibility_tree`: Get semantic accessibility tree with roles and names.

## Resources (3 Resources)
Agents can read the following resources:
- `mcp://dom/current`: Current page simplified DOM (cleaned of scripts and styles).
- `mcp://network/failed`: Recent failed network requests (status, url, error).
- `mcp://console/errors`: Recent console errors and warnings.

## Connecting Claude Desktop
To connect Claude Desktop to Dev Browser, add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "dev-browser": {
      "command": "node",
      "args": ["<PATH_TO_DEV_BROWSER>/src/dev/mcp-server/transports/stdio.js"]
    }
  }
}
```

## Connecting via WebSocket (Port 9222)
Any client supporting WebSocket MCP can connect to `ws://127.0.0.1:9222`.

## Permission Model
Dev Browser uses a strict security and permission model configured via Lua:
```lua
agent.mcp.enabled = true
agent.mcp.port = 9222
agent.permissions.allow_navigation = true
agent.permissions.allow_form_fill = true
agent.permissions.allow_click = true
agent.permissions.allow_evaluate_js = false
agent.permissions.confirm_before = { "submit_form", "delete_*", "purchase_*" }
```
- Actions matching `confirm_before` or actions not pre-approved trigger a native user confirmation dialog.
