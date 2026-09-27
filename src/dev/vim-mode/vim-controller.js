/**
 * Dev Browser - Vim Mode Controller
 * Integrates modal keybindings, scrolling, link hints, and HUD indicator.
 */

const { keymap, MODES } = require("../lua-engine/keymap");
const { PageScroller } = require("./scroller");
const { LinkHints } = require("./hints");

class VimController {
  constructor(options = {}) {
    this.keymap = options.keymap || keymap;
    this.scroller = new PageScroller(options.scroller || {});
    this.hints = new LinkHints();
    this.hudElement = null;
    const defaultDelegate = {
      newTab: () => (typeof window !== "undefined" && window.open ? window.open("about:blank", "_blank") : null),
      closeTab: () => (typeof window !== "undefined" && window.close ? window.close() : null),
      nextTab: () => {},
      prevTab: () => {},
      goBack: () => (typeof window !== "undefined" && window.history ? window.history.back() : null),
      goForward: () => (typeof window !== "undefined" && window.history ? window.history.forward() : null),
      commandPalette: () => {},
      rotateProxy: () => {
        try {
          const { defaultProxyManager } = require("../network-panel");
          return defaultProxyManager.rotateProxy();
        } catch {
          return null;
        }
      },
      toggleAgentTree: () => {
        try {
          const { defaultOverlay } = require("../agent-tree");
          return defaultOverlay.toggle();
        } catch {
          return null;
        }
      }
    };
    this.agentTreeOverlay = options.agentTreeOverlay || null;
    this.browserDelegate = Object.assign({}, defaultDelegate, options.browserDelegate || {});

    this.boundKeyHandler = this.onKeyDown.bind(this);
    this.setupActions();
    this.setupHUD();
  }

  setupActions() {
    this.keymap.registerActionHandler("scroll_down", () => this.scroller.scrollDown());
    this.keymap.registerActionHandler("scroll_up", () => this.scroller.scrollUp());
    this.keymap.registerActionHandler("scroll_half_down", () => this.scroller.scrollHalfDown());
    this.keymap.registerActionHandler("scroll_half_up", () => this.scroller.scrollHalfUp());
    this.keymap.registerActionHandler("scroll_top", () => this.scroller.scrollTop());
    this.keymap.registerActionHandler("scroll_bottom", () => this.scroller.scrollBottom());
    this.keymap.registerActionHandler("go_back", () => this.browserDelegate.goBack());
    this.keymap.registerActionHandler("go_forward", () => this.browserDelegate.goForward());
    this.keymap.registerActionHandler("new_tab", () => this.browserDelegate.newTab());
    this.keymap.registerActionHandler("close_tab", () => this.browserDelegate.closeTab());
    this.keymap.registerActionHandler("next_tab", () => this.browserDelegate.nextTab());
    this.keymap.registerActionHandler("prev_tab", () => this.browserDelegate.prevTab());
    this.keymap.registerActionHandler("link_hints", () => this.hints.show());
    this.keymap.registerActionHandler("command_palette", () => this.browserDelegate.commandPalette());
    this.keymap.registerActionHandler("rotate_proxy", () => {
      if (this.browserDelegate && typeof this.browserDelegate.rotateProxy === "function") {
        return this.browserDelegate.rotateProxy();
      }
      try {
        const { defaultProxyManager } = require("../network-panel");
        return defaultProxyManager.rotateProxy();
      } catch {
        return null;
      }
    });
    this.keymap.registerActionHandler("toggle_agent_tree", () => {
      if (this.agentTreeOverlay && typeof this.agentTreeOverlay.toggle === "function") {
        return this.agentTreeOverlay.toggle();
      }
      if (this.browserDelegate && typeof this.browserDelegate.toggleAgentTree === "function") {
        return this.browserDelegate.toggleAgentTree();
      }
      try {
        const { defaultOverlay } = require("../agent-tree");
        return defaultOverlay.toggle();
      } catch {
        return null;
      }
    });

    this.keymap.onModeChange((newMode) => {
      this.updateHUD(newMode);
    });
  }

  setupHUD() {
    if (typeof document === "undefined" || !document.body) return;

    this.hudElement = document.createElement("div");
    this.hudElement.id = "dev-vim-hud";
    this.hudElement.style.cssText = `
      position: fixed;
      bottom: 8px;
      left: 12px;
      padding: 3px 8px;
      background: rgba(18, 18, 24, 0.9);
      color: #38bdf8;
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      transition: opacity 0.2s ease;
    `;
    this.updateHUD(this.keymap.getMode());
    document.body.appendChild(this.hudElement);
  }

  updateHUD(mode) {
    if (!this.hudElement) return;
    const modeNames = {
      [MODES.NORMAL]: "-- NORMAL --",
      [MODES.INSERT]: "-- INSERT --",
      [MODES.VISUAL]: "-- VISUAL --",
      [MODES.COMMAND]: "-- COMMAND --"
    };
    this.hudElement.textContent = modeNames[mode] || `-- ${mode.toUpperCase()} --`;
    if (mode === MODES.INSERT) {
      this.hudElement.style.color = "#4ade80";
      this.hudElement.style.borderColor = "rgba(74, 222, 128, 0.4)";
    } else {
      this.hudElement.style.color = "#38bdf8";
      this.hudElement.style.borderColor = "rgba(56, 189, 248, 0.4)";
    }
  }

  onKeyDown(event) {
    // If hints active, delegate to hints
    if (this.hints.isActive) {
      const handled = this.hints.handleKey(event.key);
      if (handled) {
        event.preventDefault();
        return;
      }
    }

    this.keymap.handleKeyEvent(event);
  }

  attach(target = null) {
    const el = target || (typeof window !== "undefined" ? window : null);
    if (el && typeof el.addEventListener === "function") {
      el.addEventListener("keydown", this.boundKeyHandler, true);
    }
  }

  detach(target = null) {
    const el = target || (typeof window !== "undefined" ? window : null);
    if (el && typeof el.removeEventListener === "function") {
      el.removeEventListener("keydown", this.boundKeyHandler, true);
    }
  }
}

module.exports = {
  VimController
};
