/**
 * Dev Browser - Terminal Controller
 * Manages embedded terminal tabs, split-view layouts, clipboard, and panel visibility.
 */

const { EventEmitter } = require("events");
const { PtyBridge } = require("./pty-bridge");
const { TerminalSession } = require("./terminal-session");

class TerminalController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isOpen = Boolean(options.openInitially);
    this.ptyBridge = options.ptyBridge || new PtyBridge();
    this.tabs = new Map();
    this.activeTabId = null;
    this.splitMode = "none"; // 'none' | 'horizontal' | 'vertical'
    this.secondaryTabId = null;
    this.clipboard = "";

    // Automatically create first tab
    if (options.createDefaultTab !== false) {
      this.createTab("Terminal 1");
    }
  }

  open() {
    if (!this.isOpen) {
      this.isOpen = true;
      this.emit("open");
      this.emit("visibilityChange", true);
    }
    return this.isOpen;
  }

  close() {
    if (this.isOpen) {
      this.isOpen = false;
      this.emit("close");
      this.emit("visibilityChange", false);
    }
    return this.isOpen;
  }

  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  createTab(title = null, options = {}) {
    const tabNum = this.tabs.size + 1;
    const tabTitle = title || `Terminal ${tabNum}`;
    const session = new TerminalSession({
      title: tabTitle,
      ptyBridge: this.ptyBridge,
      ...options
    });

    this.tabs.set(session.id, session);

    // Spawn session in PTY
    this.ptyBridge.spawn(session.id, {
      cols: session.cols,
      rows: session.rows,
      shell: options.shell || "pwsh"
    });

    // If first tab or explicitly requested, make active
    if (!this.activeTabId) {
      this.activeTabId = session.id;
      session.isActive = true;
    }

    this.emit("tabCreated", session);
    this.emit("tabsChange");
    return session;
  }

  switchTab(tabId) {
    if (!this.tabs.has(tabId)) {
      throw new Error(`Terminal tab "${tabId}" not found`);
    }

    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      this.tabs.get(this.activeTabId).isActive = false;
    }

    this.activeTabId = tabId;
    const session = this.tabs.get(tabId);
    session.isActive = true;

    this.emit("tabSwitched", session);
    this.emit("tabsChange");
    return session;
  }

  closeTab(tabId) {
    const session = this.tabs.get(tabId);
    if (!session) return false;

    session.destroy();
    this.tabs.delete(tabId);

    // If closing active tab, switch to another tab or create new
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      if (remaining.length > 0) {
        this.switchTab(remaining[0]);
      } else {
        this.activeTabId = null;
        // Keep at least one tab open
        this.createTab("Terminal 1");
      }
    }

    // Clean up secondary split if it was closed
    if (this.secondaryTabId === tabId) {
      this.secondaryTabId = null;
      this.splitMode = "none";
    }

    this.emit("tabClosed", tabId);
    this.emit("tabsChange");
    return true;
  }

  getTabs() {
    return Array.from(this.tabs.values());
  }

  getActiveSession() {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  getSecondarySession() {
    if (!this.secondaryTabId) return null;
    return this.tabs.get(this.secondaryTabId) || null;
  }

  setSplit(mode, secondaryTabId = null) {
    if (!["none", "horizontal", "vertical"].includes(mode)) {
      throw new Error(`Invalid split mode: "${mode}". Expected: none, horizontal, vertical`);
    }

    this.splitMode = mode;
    if (mode === "none") {
      this.secondaryTabId = null;
    } else {
      if (secondaryTabId && this.tabs.has(secondaryTabId)) {
        this.secondaryTabId = secondaryTabId;
      } else {
        // Find another tab or create one
        const candidates = Array.from(this.tabs.keys()).filter(id => id !== this.activeTabId);
        if (candidates.length > 0) {
          this.secondaryTabId = candidates[0];
        } else {
          const newTab = this.createTab("Terminal (Split)");
          this.secondaryTabId = newTab.id;
        }
      }
    }

    this.emit("splitChange", {
      mode: this.splitMode,
      activeTabId: this.activeTabId,
      secondaryTabId: this.secondaryTabId
    });
  }

  copySelection(text) {
    if (text) {
      this.clipboard = String(text);
      this.emit("copy", this.clipboard);
    }
    return this.clipboard;
  }

  paste(customText = null) {
    const textToPaste = customText !== null ? customText : this.clipboard;
    const session = this.getActiveSession();
    if (session && textToPaste) {
      session.send(textToPaste);
      this.emit("paste", textToPaste);
    }
    return textToPaste;
  }

  clearActive() {
    const session = this.getActiveSession();
    if (session) {
      session.clear();
    }
  }

  shutdown() {
    for (const session of this.tabs.values()) {
      session.destroy();
    }
    this.tabs.clear();
    this.activeTabId = null;
    this.secondaryTabId = null;
    this.splitMode = "none";
    this.isOpen = false;
    if (this.ptyBridge) {
      this.ptyBridge.disconnect();
    }
  }
}

module.exports = {
  TerminalController
};
