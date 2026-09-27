/**
 * Dev Browser - Dev Toolkit UI Controller
 * Manages active tools, event handlers, and data transformations in the UI.
 */

let base64Module, jwtModule, jsonModule, hashModule, uuidModule, timestampModule, regexModule, httpModule;

if (typeof require !== "undefined") {
  base64Module = require("./base64");
  jwtModule = require("./jwt");
  jsonModule = require("./json-tools");
  hashModule = require("./hash");
  uuidModule = require("./uuid-tools");
  timestampModule = require("./timestamp");
  regexModule = require("./regex-tools");
  httpModule = require("./http-client");
}

class DevToolkitUI {
  constructor(options = {}) {
    this.activeTool = options.initialTool || "base64";
    this.tools = {
      base64: base64Module,
      jwt: jwtModule,
      json: jsonModule,
      hash: hashModule,
      uuid: uuidModule,
      timestamp: timestampModule,
      regex: regexModule,
      http: httpModule
    };

    if (typeof document !== "undefined") {
      this.initDom();
    }
  }

  setTool(toolName) {
    if (!this.tools[toolName]) {
      throw new Error(`Unknown toolkit tool: ${toolName}`);
    }
    this.activeTool = toolName;
    if (typeof document !== "undefined") {
      this.updateActiveTabDom();
    }
    return this.activeTool;
  }

  getActiveTool() {
    return this.activeTool;
  }

  // Base64 actions
  encodeBase64(input, { urlSafe = false } = {}) {
    return this.tools.base64.encode(input, { urlSafe });
  }

  decodeBase64(input, { urlSafe = false } = {}) {
    return this.tools.base64.decode(input, { urlSafe });
  }

  // JWT actions
  inspectJwt(token) {
    return this.tools.jwt.inspect(token);
  }

  // JSON actions
  formatJson(input, options) {
    return this.tools.json.formatJson(input, options);
  }

  minifyJson(input) {
    return this.tools.json.minifyJson(input);
  }

  validateJson(input) {
    return this.tools.json.validateJson(input);
  }

  // Hash actions
  generateHashes(input, options) {
    return this.tools.hash.generateAll(input, options);
  }

  // UUID actions
  generateUuid(options) {
    return this.tools.uuid.v4(options);
  }

  generateBatchUuids(count, options) {
    return this.tools.uuid.generateBatch(count, options);
  }

  // Timestamp actions
  parseTimestamp(input) {
    return this.tools.timestamp.parseTimestamp(input);
  }

  // Regex actions
  testRegex(pattern, flags, str) {
    return this.tools.regex.testRegex(pattern, flags, str);
  }

  replaceRegex(pattern, flags, str, replacement) {
    return this.tools.regex.replaceRegex(pattern, flags, str, replacement);
  }

  // HTTP actions
  parseHttp(content) {
    return this.tools.http.parseHttpFile(content);
  }

  async executeHttp(req, options) {
    return await this.tools.http.executeRequest(req, options);
  }

  initDom() {
    const tabButtons = document.querySelectorAll(".toolkit-tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (tool) this.setTool(tool);
      });
    });
    this.updateActiveTabDom();
  }

  updateActiveTabDom() {
    if (typeof document === "undefined") return;

    const tabButtons = document.querySelectorAll(".toolkit-tab-btn");
    tabButtons.forEach(btn => {
      if (btn.getAttribute("data-tool") === this.activeTool) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    const panels = document.querySelectorAll(".toolkit-panel");
    panels.forEach(p => {
      if (p.getAttribute("data-panel") === this.activeTool) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });
  }
}

if (typeof document !== "undefined" && document.querySelector(".toolkit-container")) {
  document.addEventListener("DOMContentLoaded", () => {
    new DevToolkitUI();
  });
}

module.exports = {
  DevToolkitUI
};
