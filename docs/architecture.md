# Dev Browser Architecture

## Overview
```
+----------------------------------------------------------------+
|                          Dev Browser                           |
|                                                                |
|  +-----------------+  +-----------------+  +----------------+  |
|  |                 |  |                 |  |                |  |
|  |   Lua Engine    |  |   MCP Server    |  |  Agent Tree    |  |
|  |                 |  |                 |  |                |  |
|  +--------+--------+  +--------+--------+  +-------+--------+  |
|           |                    |                   |           |
|  +--------v--------+  +--------v--------+  +-------v--------+  |
|  |                 |  |                 |  |                |  |
|  |   AI Sidebar    |  |   Dev Toolkit   |  | Network Panel  |  |
|  |                 |  |                 |  |                |  |
|  +-----------------+  +-----------------+  +----------------+  |
|                                                                |
+-------------------------------+--------------------------------+
                                |
                    +-----------v-----------+
                    |                       |
                    |     Helper Daemon     |
                    |                       |
                    +-----------------------+
```

## The Soft-Fork Approach
Dev Browser is built as a soft-fork of Firefox/Zen Browser. 
- `src/dev/`: Contains all our custom code (Lua bindings, MCP server, UI panels).
- `engine/`: The upstream browser source code (downloaded during setup).
- `patches/`: Git patches applied to the `engine/` to hook our custom code into the browser startup and internals.

## Components
- **Lua Engine**: Embedded LuaJIT that runs configuration and plugins.
- **MCP Server**: Built-in Model Context Protocol server exposing browser capabilities to AI agents.
- **Agent Tree**: Task management and UI for managing AI agents.
- **AI Sidebar**: Quick access to AI chats and context.
- **Dev Toolkit**: Command palette, localhost dashboard, and DOM tools.
- **Network Panel**: Advanced network control, proxy switching, and DNS.
- **Helper Daemon**: A background Rust process (`daemon/`) handling OS-level tasks.

## Data Flow
Lua bindings connect to Gecko internals via XPCOM/JSM. The Lua engine calls JavaScript functions exposed by our patches, which in turn access deep browser APIs.

## How Patches Work
When a developer modifies a file in the engine:
1. They run a patch-export script.
2. A `.patch` file is generated in the `patches/` directory.
3. During the build process (`npm run patch:apply`), these patches are applied over a clean `engine/` checkout.

## Directory Structure
- `src/dev/` - Custom feature code
- `engine/` - Upstream browser code
- `patches/` - Hooks into the upstream code
- `docs/` - Documentation
- `scripts/` - Build and setup scripts
- `daemon/` - Helper Rust daemon
