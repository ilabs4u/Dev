/**
 * Dev Browser - Lua Bridge ESM (Gecko)
 * ESM export for Gecko browser integration.
 */

export class DevLuaBridge {
  constructor() {
    this.initialized = false;
    this.logs = [];
    this.keymaps = [];
    this.commands = new Map();
    this.workspaces = new Map();
    this.plugins = new Set();
  }

  log(msg) {
    this.logs.push(msg);
    if (typeof Services !== "undefined" && Services.console) {
      Services.console.logStringMessage(`[DevBrowser:Lua] ${msg}`);
    } else {
      dump(`[DevBrowser:Lua] ${msg}\n`);
    }
  }

  init(customConfigPath = null) {
    if (this.initialized) return;
    this.log("Lua engine initialized in Gecko runtime.");
    this.initialized = true;
  }
}

export const DevLua = new DevLuaBridge();
