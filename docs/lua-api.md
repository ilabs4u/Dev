# Lua API Reference

Dev Browser exposes its internals to Lua via a set of modules, allowing for deep customization and plugin development.

## Modules

### `keymap`
- `keymap.set(mode, key, action)`: Set a keybinding.
- `keymap.del(mode, key)`: Delete a keybinding.

### `tab`
- `tab.open(url)`: Open a new tab.
- `tab.close(id?)`: Close a tab.
- `tab.list()`: List open tabs.
- `tab.current()`: Get current tab.
- `tab.switch(id)`: Switch to tab.

### `workspace`
- `workspace.create(name, opts)`: Create a workspace.
- `workspace.switch(name)`: Switch workspace.
- `workspace.list()`: List workspaces.

### `command`
- `command.create(name, fn)`: Create a command palette entry.
- `command.run(name)`: Run a command.

### `autocmd`
- `autocmd.create(event, pattern, fn)`: Run a function on browser events.

### `network`
- `network.proxy.set(type, config)`: Set proxy configuration.
- `network.dns.set(resolver)`: Set DNS resolver.

### `agent`
- `agent.mcp.enabled`: Toggle MCP server.
- `agent.permissions.*`: Manage agent permissions.

### `ai`
- `ai.default_backend`: Set default AI provider.
- `ai.summarize(text)`: Summarize text.
- `ai.ask(question)`: Ask the AI a question.

### `plugin`
- `plugin.load(name)`: Load a plugin.
- `plugin.list()`: List loaded plugins.

### `dev`
- `dev.crypto.digest(algo, input)`: Cryptographic hash.
- `dev.clipboard.read()`: Read clipboard.
- `dev.clipboard.write(text)`: Write to clipboard.

### `boost`
- `boost.create(domain, { css = ..., js = ... })`: Inject custom CSS/JS on domains.
