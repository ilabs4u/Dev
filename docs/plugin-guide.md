# Plugin Guide

## Structure
A Lua plugin for Dev Browser must return a table containing `name`, `description`, `version`, and lifecycle functions (`init`, `unload`).

```lua
local plugin = {
    name = "Lorem Ipsum",
    description = "Generates placeholder text",
    version = "1.0.0"
}

function plugin.init()
    -- initialization code
end

return plugin
```

## Commands and UI
Use `command.create()` to register actions in the command palette. You can also inject sidebar panels via UI APIs.

## Accessing Browser APIs
Plugins can access all built-in Lua modules (`tab`, `network`, `dev`, etc.). 

## Testing
Use the `Busted` framework for testing plugins. Dev Browser provides a mock environment for tests.

## Publishing
Submit a PR to the `plugins/` directory of the official Dev Browser repository to share your plugin.
