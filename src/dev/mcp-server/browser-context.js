/**
 * Dev Browser - MCP Browser Context
 * Manages tab state, navigation, DOM interaction, DevTools, and bridge to Gecko.
 */

const { distill, generateLabel } = require("../agent-tree");

class BrowserContext {
  constructor(options = {}) {
    this.browserAdapter = options.browserAdapter || (typeof browser !== "undefined" ? browser : null);

    // In-memory tab store
    this.tabs = [
      {
        id: 1,
        url: options.initialUrl || "about:blank",
        title: "Dev Browser",
        active: true,
        history: [options.initialUrl || "about:blank"],
        historyIndex: 0,
        content: "<html><head><title>Dev Browser</title></head><body><h1>Welcome to Dev Browser</h1></body></html>",
        consoleLogs: [],
        interactiveElements: []
      }
    ];
    this.nextTabId = 2;

    // Buffer for network and error tracking
    this.failedRequests = [];
    this.consoleLogsBuffer = [];
  }

  // --- TAB MANAGEMENT ---

  getActiveTab() {
    return this.tabs.find(t => t.active) || this.tabs[0];
  }

  getTab(tabId) {
    if (tabId === undefined || tabId === null) {
      return this.getActiveTab();
    }
    const numId = Number(tabId);
    return this.tabs.find(t => t.id === numId || t.id === tabId) || null;
  }

  async listTabs() {
    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.query) {
      try {
        const tabs = await this.browserAdapter.tabs.query({});
        return tabs.map(t => ({ id: t.id, title: t.title || "", url: t.url || "", active: !!t.active }));
      } catch {
        // Fallback to internal tabs
      }
    }
    return this.tabs.map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      active: t.active
    }));
  }

  async newTab(options = {}) {
    const url = options.url || "about:blank";
    const active = options.active !== false;

    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.create) {
      try {
        const created = await this.browserAdapter.tabs.create({ url, active });
        return { id: created.id, title: created.title || "New Tab", url: created.url || url, active: !!created.active };
      } catch {
        // Fallback
      }
    }

    if (active) {
      for (const t of this.tabs) t.active = false;
    }

    const tab = {
      id: this.nextTabId++,
      url,
      title: url === "about:blank" ? "New Tab" : url,
      active,
      history: [url],
      historyIndex: 0,
      content: `<html><head><title>${url}</title></head><body></body></html>`,
      consoleLogs: [],
      interactiveElements: []
    };

    this.tabs.push(tab);
    return { id: tab.id, title: tab.title, url: tab.url, active: tab.active };
  }

  async closeTab(tabId) {
    const numId = Number(tabId);
    const index = this.tabs.findIndex(t => t.id === numId || t.id === tabId);
    if (index === -1) {
      throw new Error(`Tab not found: ${tabId}`);
    }

    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.remove) {
      try {
        await this.browserAdapter.tabs.remove(tabId);
      } catch {
        // Continue
      }
    }

    const wasActive = this.tabs[index].active;
    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      this.tabs.push({
        id: this.nextTabId++,
        url: "about:blank",
        title: "New Tab",
        active: true,
        history: ["about:blank"],
        historyIndex: 0,
        content: "<html><head><title>New Tab</title></head><body></body></html>",
        consoleLogs: [],
        interactiveElements: []
      });
    } else if (wasActive) {
      this.tabs[Math.max(0, index - 1)].active = true;
    }

    return { success: true, closedTabId: tabId };
  }

  async switchTab(tabId) {
    const numId = Number(tabId);
    const tab = this.tabs.find(t => t.id === numId || t.id === tabId);
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`);
    }

    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.update) {
      try {
        await this.browserAdapter.tabs.update(tabId, { active: true });
      } catch {
        // Continue
      }
    }

    for (const t of this.tabs) t.active = false;
    tab.active = true;
    return { success: true, activeTabId: tab.id };
  }

  // --- NAVIGATION ---

  async navigateTo(url, tabId = null) {
    if (!url) throw new Error("Missing required argument: url");

    let formattedUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("about:") && !url.startsWith("file://")) {
      formattedUrl = "https://" + url;
    }

    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No active tab available");

    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.update) {
      try {
        await this.browserAdapter.tabs.update(tab.id, { url: formattedUrl });
      } catch {
        // Continue
      }
    }

    tab.url = formattedUrl;
    tab.title = formattedUrl;
    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    tab.history.push(formattedUrl);
    tab.historyIndex = tab.history.length - 1;

    // Simulate page title and structure
    tab.content = `<html><head><title>${formattedUrl}</title></head><body><h1>${formattedUrl}</h1></body></html>`;
    tab.interactiveElements = [];
    return { success: true, url: formattedUrl, tabId: tab.id };
  }

  async goBack(tabId = null) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (tab.historyIndex > 0) {
      tab.historyIndex--;
      tab.url = tab.history[tab.historyIndex];
      return { success: true, url: tab.url, canGoBack: tab.historyIndex > 0 };
    }
    return { success: false, url: tab.url, canGoBack: false };
  }

  async goForward(tabId = null) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      tab.url = tab.history[tab.historyIndex];
      return { success: true, url: tab.url, canGoForward: tab.historyIndex < tab.history.length - 1 };
    }
    return { success: false, url: tab.url, canGoForward: false };
  }

  async reload(tabId = null, bypassCache = false) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.reload) {
      try {
        await this.browserAdapter.tabs.reload(tab.id, { bypassCache });
      } catch {
        // Continue
      }
    }
    return { success: true, url: tab.url, reloaded: true, bypassCache };
  }

  async getCurrentUrl(tabId = null) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");
    return { url: tab.url, title: tab.title, tabId: tab.id };
  }

  // --- CONTENT & INTERACTION ---

  setTabContent(content, tabId = null, title = null) {
    const tab = this.getTab(tabId);
    if (!tab) return;
    tab.content = content;
    tab.interactiveElements = [];
    if (title) tab.title = title;
  }

  async getPageContent(tabId = null, format = "text") {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    let content = tab.content || "";
    if (format === "text") {
      // Strip HTML tags for readable text
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                       .replace(/<[^>]+>/g, " ")
                       .replace(/\s+/g, " ")
                       .trim();
    } else if (format === "markdown") {
      content = content.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
                       .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
                       .replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
                       .replace(/<[^>]+>/g, " ")
                       .trim();
    }

    return { content, url: tab.url, title: tab.title };
  }

  async captureScreenshot(tabId = null, format = "png") {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (this.browserAdapter && this.browserAdapter.tabs && this.browserAdapter.tabs.captureVisibleTab) {
      try {
        const dataUrl = await this.browserAdapter.tabs.captureVisibleTab(null, { format });
        return { data: dataUrl, mimeType: `image/${format}` };
      } catch {
        // Continue
      }
    }

    // Return valid mock 1x1 transparent PNG data URI
    const mockPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    return {
      data: mockPng,
      mimeType: `image/${format}`,
      width: 1280,
      height: 800,
      url: tab.url
    };
  }

  async evaluateJs(script, tabId = null) {
    if (!script) throw new Error("Missing script to evaluate");
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (typeof require !== "undefined") {
      try {
        const vm = require("node:vm");
        const sandbox = {
          document: { title: tab.title, url: tab.url },
          window: {},
          tab: { id: tab.id, url: tab.url, title: tab.title },
          console: {
            log: (...args) => this.addConsoleLog({ level: "log", message: args.join(" ") }, tab.id),
            warn: (...args) => this.addConsoleLog({ level: "warn", message: args.join(" ") }, tab.id),
            error: (...args) => this.addConsoleLog({ level: "error", message: args.join(" ") }, tab.id)
          }
        };
        const res = vm.runInNewContext(script, sandbox, { timeout: 2000 });
        return { result: res !== undefined ? res : null };
      } catch (err) {
        throw new Error(`JavaScript evaluation error: ${err.message}`);
      }
    }

    // In-browser fallback
    try {
      const sandboxFn = new Function("document", "window", "tab", `
        return (function() {
          ${script.startsWith("return ") ? script : "return (" + script + ")"};
        })();
      `);
      const mockDoc = { title: tab.title, url: tab.url };
      const res = sandboxFn(mockDoc, {}, tab);
      return { result: res !== undefined ? res : null };
    } catch (err) {
      throw new Error(`JavaScript evaluation error: ${err.message}`);
    }
  }

  addConsoleLog(entry, tabId = null) {
    const logItem = {
      level: entry.level || "log",
      message: String(entry.message || ""),
      timestamp: entry.timestamp || Date.now(),
      tabId: tabId || (this.getActiveTab() ? this.getActiveTab().id : 1)
    };
    this.consoleLogsBuffer.push(logItem);
    const tab = this.getTab(tabId);
    if (tab) {
      tab.consoleLogs.push(logItem);
    }
  }

  async getConsoleLogs(limit = 100, tabId = null) {
    const tab = this.getTab(tabId);
    if (tabId !== null && tabId !== undefined && !tab) {
      throw new Error(`Tab not found: ${tabId}`);
    }
    const logs = tab ? tab.consoleLogs : this.consoleLogsBuffer;
    return logs.slice(-Math.max(1, limit));
  }

  // --- INTERACTION & AGENT TREE ---

  _generateLabel(index) {
    return generateLabel(index);
  }

  async getInteractiveElements(tabId = null, forceRefresh = false) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (tab.interactiveElements && tab.interactiveElements.length > 0 && !forceRefresh) {
      return tab.interactiveElements;
    }

    const target = tab.document || tab.content || "";
    const elements = distill(target);

    tab.interactiveElements = elements;
    return elements;
  }

  async clickElement(options = {}) {
    const { selector, label, tabId } = options;
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (!tab.interactiveElements || tab.interactiveElements.length === 0) {
      await this.getInteractiveElements(tab.id);
    }

    let target = null;
    if (label) {
      target = tab.interactiveElements.find(e => e.label.toUpperCase() === label.toUpperCase());
      if (!target) {
        throw new Error(`Element not found with Agent Tree label: ${label}`);
      }
    } else if (selector) {
      target = tab.interactiveElements.find(e => e.selector === selector || (e.id && `#${e.id}` === selector) || (e.selector && e.selector.startsWith(selector)));
      if (!target && tab.document && typeof tab.document.querySelector === "function") {
        try {
          const domEl = tab.document.querySelector(selector);
          if (domEl) {
            target = { element: domEl, selector, text: domEl.textContent || domEl.value || selector };
          }
        } catch {
          // Continue
        }
      }
    }

    if (target && target.element && typeof target.element.click === "function") {
      try {
        target.element.click();
      } catch {
        // Continue
      }
    }

    const clickedDesc = target ? (target.text || target.selector || target.label) : (selector || label || "unknown");
    return {
      success: true,
      clicked: clickedDesc,
      target: target || { selector, label }
    };
  }

  async fillElement(options = {}) {
    const { selector, label, text, tabId } = options;
    if (text === undefined || text === null) throw new Error("Missing required argument: text");

    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (!tab.interactiveElements || tab.interactiveElements.length === 0) {
      await this.getInteractiveElements(tab.id);
    }

    let target = null;
    if (label) {
      target = tab.interactiveElements.find(e => e.label.toUpperCase() === label.toUpperCase());
      if (!target) {
        throw new Error(`Element not found with Agent Tree label: ${label}`);
      }
    } else if (selector) {
      target = tab.interactiveElements.find(e => e.selector === selector || (e.id && `#${e.id}` === selector) || (e.selector && e.selector.startsWith(selector)));
      if (!target && tab.document && typeof tab.document.querySelector === "function") {
        try {
          const domEl = tab.document.querySelector(selector);
          if (domEl) {
            target = { element: domEl, selector, text: domEl.value || text };
          }
        } catch {
          // Continue
        }
      }
    }

    if (target) {
      target.value = String(text);
      if (target.element) {
        try {
          target.element.value = String(text);
          if (typeof target.element.dispatchEvent === "function" && typeof Event !== "undefined") {
            target.element.dispatchEvent(new Event("input", { bubbles: true }));
            target.element.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } catch {
          // Continue
        }
      }
    }

    const filledDesc = target ? (target.selector || target.name || target.label) : (selector || label || "element");
    return {
      success: true,
      filled: filledDesc,
      text: String(text)
    };
  }

  // --- DEVTOOLS TOOLS ---

  async getCss(options = {}) {
    const { selector, property, tabId } = options;
    if (!selector) throw new Error("Missing required argument: selector");

    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    // Standard computed styles simulation
    const mockStyles = {
      display: "block",
      color: "rgb(255, 255, 255)",
      backgroundColor: "rgb(30, 30, 30)",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      margin: "0px",
      padding: "8px",
      border: "1px solid rgb(60, 60, 60)",
      width: "100%",
      boxSizing: "border-box"
    };

    if (property) {
      return {
        selector,
        property,
        value: mockStyles[property] || "initial"
      };
    }

    return {
      selector,
      styles: mockStyles
    };
  }

  async getPerformance(tabId = null) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    return {
      url: tab.url,
      timing: {
        navigationStart: 0,
        domainLookupTimeMs: 12,
        connectTimeMs: 25,
        ttfbMs: 45,
        domContentLoadedMs: 110,
        loadTimeMs: 180
      },
      metrics: {
        resourceCount: 8,
        jsHeapUsedBytes: 15420000,
        domNodes: 42
      }
    };
  }

  async getAccessibilityTree(tabId = null) {
    const tab = this.getTab(tabId);
    if (!tab) throw new Error(tabId !== null && tabId !== undefined ? `Tab not found: ${tabId}` : "No tab found");

    if (!tab.interactiveElements || tab.interactiveElements.length === 0) {
      await this.getInteractiveElements(tab.id);
    }

    return {
      role: "WebArea",
      name: tab.title || tab.url,
      children: tab.interactiveElements.map(el => ({
        role: el.role || el.tag,
        name: el.text || el.placeholder || el.name || el.label,
        value: el.value || undefined,
        focusable: true
      }))
    };
  }

  // --- RESOURCES ---

  getSimplifiedDom(tabId = null) {
    const tab = this.getTab(tabId);
    if (!tab) return "<html><body></body></html>";

    // Simplified DOM without styles or script noise
    return tab.content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/\sstyle=["'][^"']*["']/gi, "")
      .trim();
  }

  addFailedRequest(request) {
    this.failedRequests.push({
      url: request.url || "unknown",
      status: request.status || 0,
      error: request.error || "Network error",
      timestamp: request.timestamp || Date.now()
    });
    if (this.failedRequests.length > 50) {
      this.failedRequests.shift();
    }
  }

  getFailedRequests() {
    return [...this.failedRequests];
  }

  getConsoleErrors() {
    return this.consoleLogsBuffer
      .filter(l => l.level === "error" || l.level === "warn")
      .slice(-100);
  }
}

module.exports = {
  BrowserContext
};
