/**
 * Dev Browser - Terminal UI Controller
 * Binds TerminalController to terminal.html DOM elements.
 */

let TerminalControllerClass;
if (typeof require !== "undefined") {
  try {
    TerminalControllerClass = require("./terminal-controller").TerminalController;
  } catch {
    TerminalControllerClass = window.TerminalController;
  }
} else {
  TerminalControllerClass = window.TerminalController;
}

class TerminalUI {
  constructor(options = {}) {
    this.controller = options.controller || (TerminalControllerClass ? new TerminalControllerClass() : null);

    const getEl = id => (typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null);

    this.dom = {
      container: getEl("terminal-drawer"),
      tabBar: getEl("terminal-tabs-strip"),
      addTabBtn: getEl("terminal-add-tab"),
      splitHBtn: getEl("terminal-split-h"),
      splitVBtn: getEl("terminal-split-v"),
      clearBtn: getEl("terminal-clear-btn"),
      closeBtn: getEl("terminal-close-btn"),
      screenPrimary: getEl("terminal-screen-primary"),
      screenSecondary: getEl("terminal-screen-secondary"),
      terminalSplitWrapper: getEl("terminal-split-wrapper")
    };

    if (this.controller) {
      this.bindController();
      this.initEvents();
      this.render();
    }
  }

  bindController() {
    this.controller.on("visibilityChange", (visible) => {
      if (this.dom.container) {
        if (visible) {
          this.dom.container.classList.add("open");
        } else {
          this.dom.container.classList.remove("open");
        }
      }
    });

    this.controller.on("tabsChange", () => this.renderTabs());
    this.controller.on("tabSwitched", () => this.renderScreen());
    this.controller.on("splitChange", () => this.renderSplit());
  }

  initEvents() {
    if (this.dom.addTabBtn) {
      this.dom.addTabBtn.addEventListener("click", () => {
        this.controller.createTab();
      });
    }

    if (this.dom.closeBtn) {
      this.dom.closeBtn.addEventListener("click", () => {
        this.controller.close();
      });
    }

    if (this.dom.clearBtn) {
      this.dom.clearBtn.addEventListener("click", () => {
        this.controller.clearActive();
        this.renderScreen();
      });
    }

    if (this.dom.splitHBtn) {
      this.dom.splitHBtn.addEventListener("click", () => {
        const next = this.controller.splitMode === "horizontal" ? "none" : "horizontal";
        this.controller.setSplit(next);
      });
    }

    if (this.dom.splitVBtn) {
      this.dom.splitVBtn.addEventListener("click", () => {
        const next = this.controller.splitMode === "vertical" ? "none" : "vertical";
        this.controller.setSplit(next);
      });
    }

    // Keyboard input handling for terminal screen
    if (this.dom.screenPrimary) {
      this.dom.screenPrimary.setAttribute("tabindex", "0");
      this.dom.screenPrimary.addEventListener("keydown", (e) => {
        this.handleKeyDown(e);
      });
    }
  }

  handleKeyDown(e) {
    const session = this.controller.getActiveSession();
    if (!session) return;

    if (e.key === "Enter") {
      session.send("\r");
      e.preventDefault();
    } else if (e.key === "Backspace") {
      session.send("\b");
      e.preventDefault();
    } else if (e.key === "Tab") {
      session.send("\t");
      e.preventDefault();
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      session.send("\u0003"); // SIGINT
      e.preventDefault();
    } else if (e.ctrlKey && e.key.toLowerCase() === "v") {
      if (this.controller.clipboard) {
        session.send(this.controller.clipboard);
      }
      e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      session.send(e.key);
      e.preventDefault();
    }
  }

  render() {
    this.renderTabs();
    this.renderScreen();
    this.renderSplit();
  }

  renderTabs() {
    if (!this.dom.tabBar || !this.controller) return;
    this.dom.tabBar.innerHTML = "";

    const tabs = this.controller.getTabs();
    tabs.forEach(tab => {
      const tabEl = document.createElement("div");
      tabEl.className = `terminal-tab ${tab.id === this.controller.activeTabId ? "active" : ""}`;
      tabEl.innerHTML = `
        <span class="tab-title">${tab.title}</span>
        <button class="tab-close" data-id="${tab.id}">✕</button>
      `;

      tabEl.addEventListener("click", (e) => {
        if (!e.target.classList.contains("tab-close")) {
          this.controller.switchTab(tab.id);
        }
      });

      const closeBtn = tabEl.querySelector(".tab-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.controller.closeTab(tab.id);
        });
      }

      this.dom.tabBar.appendChild(tabEl);
    });
  }

  renderScreen() {
    const session = this.controller ? this.controller.getActiveSession() : null;
    if (this.dom.screenPrimary && session) {
      this.dom.screenPrimary.innerHTML = session.getBufferHtml() || '<span style="color: #6c7086;">Ready.</span>';
      this.dom.screenPrimary.scrollTop = this.dom.screenPrimary.scrollHeight;

      // Listen for output to update dynamically
      session.removeAllListeners("output");
      session.on("output", () => {
        this.dom.screenPrimary.innerHTML = session.getBufferHtml();
        this.dom.screenPrimary.scrollTop = this.dom.screenPrimary.scrollHeight;
      });
    }
  }

  renderSplit() {
    if (!this.dom.terminalSplitWrapper) return;
    const mode = this.controller ? this.controller.splitMode : "none";
    this.dom.terminalSplitWrapper.className = `terminal-split-wrapper split-${mode}`;

    if (this.dom.screenSecondary) {
      if (mode !== "none") {
        this.dom.screenSecondary.style.display = "block";
        const secSession = this.controller.getSecondarySession();
        if (secSession) {
          this.dom.screenSecondary.innerHTML = secSession.getBufferHtml() || '<span style="color: #6c7086;">Ready.</span>';
        }
      } else {
        this.dom.screenSecondary.style.display = "none";
      }
    }
  }
}

if (typeof document !== "undefined" && document.getElementById("terminal-drawer")) {
  document.addEventListener("DOMContentLoaded", () => {
    new TerminalUI();
  });
}

module.exports = {
  TerminalUI
};
