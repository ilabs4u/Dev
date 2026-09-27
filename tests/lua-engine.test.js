const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { DevLuaBridge } = require("../src/dev/lua-engine/lua-bridge");

describe("Task 1.1: LuaJIT Engine & Bridge Integration", () => {
  it("initializes and loads default-init.lua configuration", () => {
    const bridge = new DevLuaBridge();
    const configPath = path.resolve(__dirname, "..", "config", "default-init.lua");
    assert.ok(fs.existsSync(configPath), "default-init.lua should exist");

    bridge.init(configPath);
    assert.equal(bridge.initialized, true, "Bridge should be initialized");

    const keymaps = bridge.getKeymaps();
    assert.ok(keymaps.length > 5, `Should register keymaps, got ${keymaps.length}`);

    // Verify keymap.set("n", "j", "scroll_down") parsed
    const jKeymap = keymaps.find(k => k.mode === "n" && k.key === "j");
    assert.ok(jKeymap, "j keymap should be found");
    assert.equal(jKeymap.action, "scroll_down");

    // Verify workspaces parsed
    const workspaces = bridge.getWorkspaces();
    assert.ok(workspaces.length >= 2, "Workspaces should be parsed");

    // Verify plugins parsed
    const plugins = bridge.getPlugins();
    assert.ok(plugins.includes("base64"));
    assert.ok(plugins.includes("uuid"));
  });

  it("handles print() output and routes to logs", () => {
    const bridge = new DevLuaBridge();
    let consoleOutput = "";
    bridge.setConsoleCallback(msg => {
      consoleOutput += msg + "\n";
    });

    bridge.init();
    bridge.evaluateLuaScript('print("hello from lua")');

    assert.ok(consoleOutput.includes("hello from lua"), "print output must be captured");
    assert.ok(bridge.getLogs().includes("hello from lua"));
  });

  it("vendors required LuaJIT C headers", () => {
    const vendorDir = path.resolve(__dirname, "..", "src", "dev", "lua-engine", "vendor");
    const requiredHeaders = ["lua.h", "luaconf.h", "lualib.h", "lauxlib.h", "luajit.h"];
    for (const header of requiredHeaders) {
      const fullPath = path.join(vendorDir, header);
      assert.ok(fs.existsSync(fullPath), `Header ${header} must exist in vendor dir`);
    }
  });

  it("contains valid patch file for Gecko hooks", () => {
    const patchPath = path.resolve(__dirname, "..", "patches", "003-lua-engine-hooks.patch");
    assert.ok(fs.existsSync(patchPath), "003-lua-engine-hooks.patch must exist");
    const patchContent = fs.readFileSync(patchPath, "utf-8");
    assert.ok(patchContent.includes("browser-delayed-startup-finished"));
    assert.ok(patchContent.includes("moz.build"));
    assert.ok(patchContent.includes("luajit-5.1"));
  });
});
