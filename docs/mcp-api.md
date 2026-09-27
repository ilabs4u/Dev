# MCP API Reference

## What is MCP?
The Model Context Protocol (MCP) allows AI agents to interact securely with local applications. Dev Browser has a native MCP server built-in to allow AI assistants (like Claude) to control the browser, read pages, and assist developers.

## Connection
- **Transport**: stdio or WebSocket.
- **Port**: 9222 (WebSocket).

## Tools
Agents can invoke the following tools:
- `navigate_to`
- `go_back`
- `go_forward`
- `reload`
- `get_current_url`
- `list_tabs`
- `new_tab`
- `close_tab`
- `switch_tab`
- `get_interactive_elements`
- `click`
- `fill`
- `get_page_content`
- `screenshot`
- `evaluate_js`
- `get_console_logs`
- `get_css`
- `get_performance`
- `get_accessibility_tree`

## Resources
Agents can read the following resources:
- `mcp://dom/current`: Current page DOM.
- `mcp://network/failed`: Failed network requests.
- `mcp://console/errors`: Console errors.

## Example: Connecting Claude Desktop
To connect Claude Desktop to Dev Browser, add the following to your Claude configuration:
```json
{
  "mcpServers": {
    "dev-browser": {
      "command": "node",
      "args": ["path/to/dev-browser/mcp/stdio-server.js"]
    }
  }
}
```

## Permission Model
Dev Browser uses a strict permission model. The user must approve sensitive actions (like clicking or filling forms) initiated by the MCP server, unless explicitly configured otherwise via the Lua API.
