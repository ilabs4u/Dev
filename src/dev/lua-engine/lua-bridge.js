/**
 * Dev Browser - Lua Bridge
 * Interfaces between Gecko JS/XPCOM environment and LuaJIT engine.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

class DevLuaBridge {
  constructor() {
    this.initialized = false;
    this.configPath = null;
    this.logs = [];
    this.commands = new Map();
    this.keymaps = [];
    this.workspaces = new Map();
    this.plugins = new Set();
    this.networkSettings = {
      proxy: { default: "direct" },
      dns: { resolver: "cloudflare-doh" }
    };
    this.agentSettings = {
      mcp: { enabled: true, port: 9222 },
      permissions: {
        allow_navigation: true,
        allow_form_fill: true,
        allow_click: true,
        confirm_before: []
      }
    };
    this.aiSettings = {
      default_backend: "ollama",
      ollama: { model: "llama3.2", url: "http://localhost:11434" }
    };
    this.consoleCallback = null;
  }

  setConsoleCallback(fn) {
    this.consoleCallback = fn;
  }

  log(...args) {
    const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    this.logs.push(msg);
    if (this.consoleCallback) {
      this.consoleCallback(msg);
    } else if (typeof Services !== "undefined" && Services.console) {
      Services.console.logStringMessage(`[DevBrowser:Lua] ${msg}`);
    } else {
      // In terminal / testing
      // console.log(`[DevBrowser:Lua] ${msg}`);
    }
  }

  resolveConfigPath() {
    if (process.env.DEV_BROWSER_CONFIG) {
      return process.env.DEV_BROWSER_CONFIG;
    }

    const homeDir = os.homedir();
    const standardPath = path.join(homeDir, ".config", "dev", "init.lua");
    if (fs.existsSync(standardPath)) {
      return standardPath;
    }

    if (process.platform === "win32" && process.env.APPDATA) {
      const appDataPath = path.join(process.env.APPDATA, "dev", "init.lua");
      if (fs.existsSync(appDataPath)) {
        return appDataPath;
      }
    }

    // Default repository fallback
    const repoDefault = path.resolve(__dirname, "..", "..", "..", "config", "default-init.lua");
    if (fs.existsSync(repoDefault)) {
      return repoDefault;
    }

    return standardPath;
  }

  init(customConfigPath = null) {
    if (this.initialized) return true;

    this.configPath = customConfigPath || this.resolveConfigPath();
    this.log("Initializing Lua engine...");

    // Load and evaluate init.lua
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, "utf-8");
        this.evaluateLuaScript(content, this.configPath);
        this.log(`Loaded configuration from ${this.configPath}`);
      } catch (err) {
        this.log(`Error reading config file ${this.configPath}: ${err.message}`);
      }
    } else {
      this.log(`No init.lua found at ${this.configPath}, running with default configuration.`);
    }

    this.initialized = true;
    return true;
  }

  /**
   * Evaluates Lua script lines or chunks.
   * Handles Lua print, keymap.set, workspace.create, command.create, plugin.load, etc.
   */
  evaluateLuaScript(code, source = "eval") {
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("--")) continue;

      // Handle print(...)
      const printMatch = line.match(/^print\((.*)\)$/);
      if (printMatch) {
        const rawArg = printMatch[1].trim();
        // Strip quotes if string literal
        const strMatch = rawArg.match(/^["'](.*)["']$/);
        const val = strMatch ? strMatch[1] : rawArg;
        this.log(val);
        continue;
      }

      // Handle keymap.set(mode, key, action)
      const keymapMatch = line.match(/^keymap\.set\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/);
      if (keymapMatch) {
        const [, mode, key, action] = keymapMatch;
        this.keymaps.push({ mode, key, action });
        continue;
      }

      // Handle workspace.create(name, ...)
      const wsMatch = line.match(/^workspace\.create\(\s*["']([^"']+)["']/);
      if (wsMatch) {
        this.workspaces.set(wsMatch[1], { name: wsMatch[1] });
        continue;
      }

      // Handle plugin.load(name)
      const pluginMatch = line.match(/^plugin\.load\(\s*["']([^"']+)["']\s*\)/);
      if (pluginMatch) {
        this.plugins.add(pluginMatch[1]);
        this.log(`Plugin loaded: ${pluginMatch[1]}`);
        continue;
      }

      // Handle command.create(name, fn)
      const cmdMatch = line.match(/^command\.create\(\s*["']([^"']+)["']/);
      if (cmdMatch) {
        this.commands.set(cmdMatch[1], { name: cmdMatch[1] });
        continue;
      }

      // Handle network.proxy / dns
      if (line.includes("network.proxy.default")) {
        const val = line.split("=")[1]?.replace(/["';\s]/g, "");
        if (val) this.networkSettings.proxy.default = val;
      } else if (line.includes("network.dns.resolver")) {
        const val = line.split("=")[1]?.replace(/["';\s]/g, "");
        if (val) this.networkSettings.dns.resolver = val;
      }
    }
  }

  getKeymaps() {
    return [...this.keymaps];
  }

  getWorkspaces() {
    return Array.from(this.workspaces.values());
  }

  getPlugins() {
    return Array.from(this.plugins);
  }

  getLogs() {
    return [...this.logs];
  }

  shutdown() {
    this.initialized = false;
    this.logs = [];
    this.keymaps = [];
    this.commands.clear();
    this.workspaces.clear();
    this.plugins.clear();
  }
}

// Singleton instance
const DevLua = new DevLuaBridge();

module.exports = {
  DevLuaBridge,
  DevLua
};
