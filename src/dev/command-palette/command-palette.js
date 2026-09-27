/**
 * Dev Browser - Command Palette Overlay
 * Ctrl+K fuzzy-search command bar for browser actions, open tabs, and Lua commands.
 */

const { fuzzyFilter } = require("./fuzzy");

class CommandPalette {
  constructor(options = {}) {
    this.isOpen = false;
    this.query = "";
    this.selectedIndex = 0;
    this.filteredResults = [];
    this.actions = [];
    this.customCommands = new Map();
    this.tabProvider = options.tabProvider || (() => []);
    this.lastOpenDurationMs = 0;
    this.overlayElement = null;
    this.inputElement = null;
    this.resultsElement = null;
    this.previousFocusedElement = null;
    this.onActionExecuted = options.onActionExecuted || null;

    this.registerDefaultActions();
    if (typeof document !== "undefined") {
      this.initDOM();
    }
  }

  registerDefaultActions() {
    this.actions = [
      {
        id: "tab.new",
        title: "New Tab",
        category: "Action",
        shortcut: "Ctrl+T",
        handler: () => {
          if (typeof window !== "undefined" && window.open) {
            window.open("about:blank", "_blank");
          }
          return "new_tab";
        }
      },
      {
        id: "tab.close",
        title: "Close Tab",
        category: "Action",
        shortcut: "Ctrl+W",
        handler: () => {
          if (typeof window !== "undefined" && window.close) {
            window.close();
          }
          return "close_tab";
        }
      },
      {
        id: "tab.duplicate",
        title: "Duplicate Tab",
        category: "Action",
        handler: () => "duplicate_tab"
      },
      {
        id: "tab.reopen",
        title: "Reopen Closed Tab",
        category: "Action",
        shortcut: "Ctrl+Shift+T",
        handler: () => "reopen_tab"
      },
      {
        id: "page.reload",
        title: "Reload Page",
        category: "Action",
        shortcut: "Ctrl+R",
        handler: () => {
          if (typeof location !== "undefined" && location.reload) {
            location.reload();
          }
          return "reload";
        }
      },
      {
        id: "page.hard_reload",
        title: "Hard Reload (Bypass Cache)",
        category: "Action",
        shortcut: "Ctrl+Shift+R",
        handler: () => "hard_reload"
      },
      {
        id: "devtools.toggle",
        title: "Toggle Developer Tools",
        category: "DevTools",
        shortcut: "F12",
        handler: () => "toggle_devtools"
      },
      {
        id: "terminal.toggle",
        title: "Toggle Terminal",
        category: "Developer",
        shortcut: "Ctrl+`",
        handler: () => "toggle_terminal"
      },
      {
        id: "ai.sidebar.toggle",
        title: "Toggle AI Sidebar",
        category: "AI",
        shortcut: "Alt+A",
        handler: () => "toggle_ai_sidebar"
      },
      {
        id: "network.proxy.rotate",
        title: "Rotate Proxy / Switch IP",
        category: "Network",
        handler: () => "rotate_proxy"
      },
      {
        id: "vim.toggle",
        title: "Toggle Vim Mode",
        category: "Settings",
        handler: () => "toggle_vim_mode"
      },
      {
        id: "browser.history",
        title: "View History",
        category: "Navigation",
        shortcut: "Ctrl+H",
        handler: () => "open_history"
      },
      {
        id: "browser.downloads",
        title: "View Downloads",
        category: "Navigation",
        shortcut: "Ctrl+J",
        handler: () => "open_downloads"
      },
      {
        id: "browser.settings",
        title: "Open Preferences / Settings",
        category: "Settings",
        handler: () => "open_settings"
      }
    ];
  }

  registerCommand(cmd) {
    if (!cmd || !cmd.id || !cmd.title) {
      throw new Error("Command must have id and title");
    }
    this.customCommands.set(cmd.id, {
      ...cmd,
      category: cmd.category || "Lua"
    });
  }

  unregisterCommand(id) {
    return this.customCommands.delete(id);
  }

  getAllItems() {
    const items = [...this.actions];

    // Add custom commands
    for (const cmd of this.customCommands.values()) {
      items.push(cmd);
    }

    // Add open tabs
    try {
      const tabs = this.tabProvider() || [];
      for (const t of tabs) {
        items.push({
          id: `tab:${t.id || t.url}`,
          title: `Tab: ${t.title || t.url}`,
          category: "Open Tab",
          url: t.url,
          handler: () => {
            if (typeof t.activate === "function") t.activate();
            return `switch_to_tab:${t.id || t.url}`;
          }
        });
      }
    } catch {
      // Ignore tab provider error
    }

    return items;
  }

  initDOM() {
    if (this.overlayElement) return;

    this.overlayElement = document.createElement("div");
    this.overlayElement.id = "dev-command-palette-overlay";
    this.overlayElement.className = "dev-palette-hidden";
    this.overlayElement.innerHTML = `
      <div class="dev-palette-backdrop"></div>
      <div class="dev-palette-modal">
        <div class="dev-palette-header">
          <span class="dev-palette-icon">⚡</span>
          <input type="text" class="dev-palette-input" placeholder="Type a command or search tabs..." autocomplete="off" spellcheck="false" />
          <span class="dev-palette-badge">Ctrl+K</span>
        </div>
        <div class="dev-palette-results"></div>
        <div class="dev-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Execute</span>
          <span><kbd>esc</kbd> Dismiss</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayElement);

    this.inputElement = this.overlayElement.querySelector(".dev-palette-input");
    this.resultsElement = this.overlayElement.querySelector(".dev-palette-results");

    if (this.inputElement) {
      this.inputElement.addEventListener("input", (e) => {
        this.setQuery(e.target.value);
      });

      this.inputElement.addEventListener("keydown", (e) => {
        this.handleKeyDown(e);
      });
    }

    if (this.resultsElement) {
      this.resultsElement.addEventListener("click", (e) => {
        const itemEl = e.target.closest ? e.target.closest(".dev-palette-item") : null;
        if (itemEl) {
          const idx = parseInt(itemEl.getAttribute("data-index"), 10);
          if (!isNaN(idx)) {
            this.selectedIndex = idx;
            this.executeSelected();
          }
        }
      });
    }

    const backdrop = this.overlayElement.querySelector(".dev-palette-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => {
        this.close();
      });
    }
  }

  open() {
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    this.isOpen = true;
    this.query = "";
    this.selectedIndex = 0;
    this.updateResults();

    if (typeof document !== "undefined") {
      this.previousFocusedElement = document.activeElement;
      if (this.overlayElement) {
        this.overlayElement.classList.remove("dev-palette-hidden");
        this.overlayElement.classList.add("dev-palette-visible");
      }
      if (this.inputElement) {
        this.inputElement.value = "";
        this.inputElement.focus();
      }
      this.renderResults();
    }

    const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    this.lastOpenDurationMs = t1 - t0;
    return this.lastOpenDurationMs;
  }

  close() {
    this.isOpen = false;
    this.query = "";
    this.selectedIndex = 0;

    if (typeof document !== "undefined") {
      if (this.overlayElement) {
        this.overlayElement.classList.remove("dev-palette-visible");
        this.overlayElement.classList.add("dev-palette-hidden");
      }
      if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === "function") {
        this.previousFocusedElement.focus();
        this.previousFocusedElement = null;
      }
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setQuery(q) {
    this.query = q;
    this.selectedIndex = 0;
    this.updateResults();
    if (typeof document !== "undefined") {
      this.renderResults();
    }
  }

  updateResults() {
    const all = this.getAllItems();
    this.filteredResults = fuzzyFilter(this.query, all, (item) => item.title);
    if (this.selectedIndex >= this.filteredResults.length) {
      this.selectedIndex = Math.max(0, this.filteredResults.length - 1);
    }
  }

  selectNext() {
    if (this.filteredResults.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredResults.length;
    if (typeof document !== "undefined") {
      this.renderResults();
    }
  }

  selectPrev() {
    if (this.filteredResults.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.filteredResults.length) % this.filteredResults.length;
    if (typeof document !== "undefined") {
      this.renderResults();
    }
  }

  executeSelected() {
    if (this.filteredResults.length === 0) return null;
    const match = this.filteredResults[this.selectedIndex];
    if (!match || !match.item) return null;

    const item = match.item;
    let result = null;
    if (typeof item.handler === "function") {
      result = item.handler();
    }
    if (this.onActionExecuted) {
      this.onActionExecuted(item, result);
    }
    this.close();
    return result;
  }

  handleKeyDown(event) {
    if (!this.isOpen) return false;

    if (event.key === "Escape") {
      if (typeof event.preventDefault === "function") event.preventDefault();
      this.close();
      return true;
    }

    if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n") || (event.ctrlKey && event.key === "j")) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      this.selectNext();
      return true;
    }

    if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p") || (event.ctrlKey && event.key === "k")) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      this.selectPrev();
      return true;
    }

    if (event.key === "Enter") {
      if (typeof event.preventDefault === "function") event.preventDefault();
      this.executeSelected();
      return true;
    }

    return false;
  }

  renderResults() {
    if (!this.resultsElement) return;

    if (this.filteredResults.length === 0) {
      this.resultsElement.innerHTML = `
        <div class="dev-palette-empty">No commands or tabs found matching "${escapeHtml(this.query)}"</div>
      `;
      return;
    }

    const html = this.filteredResults.map((res, i) => {
      const isSelected = i === this.selectedIndex;
      const item = res.item;
      const highlightedTitle = highlightIndices(item.title, res.indices);
      const category = item.category || "Action";
      const shortcut = item.shortcut ? `<span class="dev-palette-item-shortcut">${escapeHtml(item.shortcut)}</span>` : "";

      return `
        <div class="dev-palette-item ${isSelected ? "selected" : ""}" data-index="${i}">
          <span class="dev-palette-item-category">[${escapeHtml(category)}]</span>
          <span class="dev-palette-item-title">${highlightedTitle}</span>
          ${shortcut}
        </div>
      `;
    }).join("");

    this.resultsElement.innerHTML = html;

    // Scroll active item into view
    const selectedEl = this.resultsElement.querySelector(".dev-palette-item.selected");
    if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }

  attachGlobalShortcut(target = null) {
    const el = target || (typeof window !== "undefined" ? window : null);
    if (!el || typeof el.addEventListener !== "function") return;

    el.addEventListener("keydown", (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.toggle();
      }
    }, true);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightIndices(text, indices) {
  if (!text) return "";
  if (!indices || indices.length === 0) {
    return escapeHtml(text);
  }
  const indexSet = new Set(indices);
  let html = "";
  for (let i = 0; i < text.length; i++) {
    const ch = escapeHtml(text[i]);
    if (indexSet.has(i)) {
      html += `<span class="match-char">${ch}</span>`;
    } else {
      html += ch;
    }
  }
  return html;
}

const commandPalette = new CommandPalette();

module.exports = {
  CommandPalette,
  commandPalette,
  escapeHtml,
  highlightIndices
};
