# 🚀 Dev Browser

The world's first AI-agent-native, Lua-scriptable developer browser.

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

Everything in Dev Browser can be configured via `init.lua`. Here's a quick example:

```lua
-- ~/.dev/init.lua
dev.ui.set_theme("gruvbox")

dev.keys.bind("ctrl+shift+k", function()
    dev.tabs.new("https://github.com")
end)

dev.network.on_request(function(req)
    if req.url:match("tracker") then
        return req:cancel()
    end
end)
```

## AI Agent Integration

Dev Browser natively supports the Model Context Protocol (MCP). Integrate local or remote agents seamlessly:

```json
{
  "mcp": {
    "servers": [
      {
        "name": "dev-assistant",
        "command": "python -m my_mcp_server"
      }
    ]
  }
}
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

## License

This project is licensed under the Mozilla Public License Version 2.0 - see the [LICENSE](LICENSE) file for details.

## Community

Join our [Discord](https://discord.gg/devbrowser) to discuss the future of the web, share your Lua configurations, and get help from the community!
