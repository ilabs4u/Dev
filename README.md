<p align="center">
  <img src="assets/logo.png" width="160" height="160" alt="Dev Browser Logo">
</p>

# <p align="center">Dev Browser</p>

<p align="center">
  <em>The world's first AI-agent-native, Lua-scriptable developer browser.</em>
</p>

![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)
![GitHub stars](https://img.shields.io/github/stars/ilabs4u/Dev)
![Discord](https://img.shields.io/badge/Discord-Join-7289DA)

## Features

- 🤖 **AI-Agent Native (MCP)**: Native integration for Model Context Protocol (MCP) servers and AI agent communication.
- 📜 **Lua-Scriptable**: Customize and extend everything in the browser with simple Lua scripts.
- 🛠️ **Developer Workstation**: Built for developers with deep system integration, devtools, and productivity in mind.
- 🕵️ **Network Hacker Mode**: Advanced network inspection and modification on the fly.
- 🧠 **Local AI (BYOM)**: Bring your own model (BYOM) support for running local LLMs and AI integrations seamlessly.

## Why Dev?

The browser is the modern developer's most important tool, yet it has remained stagnant for over a decade. Dev changes that by treating the browser as a scriptable developer environment, completely integrated with your favorite AI workflows.

## Quick Start

Download the latest release from the [Releases page](https://github.com/ilabs4u/Dev/releases) or build it from source.

## Building from Source

For detailed instructions on building Dev Browser from source, please see our [Building Guide](docs/building.md).

## Lua Configuration

Everything in Dev Browser can be configured via `init.lua` (`~/.config/dev/init.lua`). Here's a quick example:

```lua
-- ~/.config/dev/init.lua

-- Vim Keybindings
keymap.set("n", "j", "scroll_down")
keymap.set("n", "k", "scroll_up")
keymap.set("n", "t", "new_tab")
keymap.set("n", "<C-p>", "command_palette")
keymap.set("n", "<leader>ip", "rotate_proxy")

-- Workspaces
workspace.create("dev", {
  theme = "gruvbox",
  container = "development",
  proxy = "direct",
})

-- AI Agent & MCP
agent.mcp.enabled = true
agent.mcp.port = 9222
agent.permissions.allow_navigation = true
agent.permissions.allow_click = true

-- Plugins
plugin.load("base64")
plugin.load("uuid")
```

## AI Agent Integration

Dev Browser natively supports the Model Context Protocol (MCP). Connect Claude Desktop or any MCP client directly:

```json
{
  "mcpServers": {
    "dev-browser": {
      "command": "node",
      "args": ["path/to/dev-browser/src/dev/mcp-server/transports/stdio.js"]
    }
  }
}
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

## License

This project is licensed under the Mozilla Public License Version 2.0 - see the [LICENSE](LICENSE) file for details.

## Community

Join our [Discord](https://discord.gg/devbrowser) to discuss the future of the web, share your Lua configurations, and get help from the community!
