/**
 * Dev Browser - Network Toolbar Widget
 * Toolbar button & quick-switch dropdown for Direct, SOCKS5, and Tor modes,
 * with real-time IP address display.
 */

const { PROXY_MODES } = require("./proxy-manager");

const MODE_METADATA = {
  [PROXY_MODES.DIRECT]: {
    label: "Direct",
    icon: "🌐",
    color: "#22c55e",
    description: "No proxy (direct connection)"
  },
  [PROXY_MODES.SOCKS5]: {
    label: "SOCKS5",
    icon: "🧦",
    color: "#38bdf8",
    description: "Local SOCKS5 (127.0.0.1:1080)"
  },
  [PROXY_MODES.TOR]: {
    label: "Tor",
    icon: "🧅",
    color: "#a855f7",
    description: "Tor Onion Network (127.0.0.1:9050)"
  }
};

class NetworkToolbarWidget {
  constructor(options = {}) {
    this.proxyManager = options.proxyManager;
    this.ipMonitor = options.ipMonitor;
    this.container = options.container || null;
    this.isOpen = false;
    this.activeTabId = options.activeTabId || 1;

    this.dom = {
      button: null,
      modeIcon: null,
      modeLabel: null,
      ipBadge: null,
      dropdown: null
    };

    this._cleanupFns = [];
    this._boundDocClick = null;

    if (this.proxyManager) {
      const unsub = this.proxyManager.on("modeChange", () => this.updateUI());
      if (typeof unsub === "function") this._cleanupFns.push(unsub);
    }

    if (this.ipMonitor) {
      const unsub1 = this.ipMonitor.on("ipChange", () => this.updateUI());
      const unsub2 = this.ipMonitor.on("statusChange", () => this.updateUI());
      if (typeof unsub1 === "function") this._cleanupFns.push(unsub1);
      if (typeof unsub2 === "function") this._cleanupFns.push(unsub2);
    }

    if (this.container) {
      this.mount(this.container);
    }
  }

  mount(container) {
    if (this._boundDocClick && typeof document !== "undefined") {
      document.removeEventListener("click", this._boundDocClick);
    }

    this.container = container;
    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "dev-network-toolbar-widget";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "dev-network-toolbar-button";
    button.title = "Proxy & IP Switcher (Dev Browser)";
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");

    const modeIcon = document.createElement("span");
    modeIcon.className = "dev-network-mode-icon";

    const modeLabel = document.createElement("span");
    modeLabel.className = "dev-network-mode-label";

    const ipBadge = document.createElement("span");
    ipBadge.className = "dev-network-ip-badge";

    button.appendChild(modeIcon);
    button.appendChild(modeLabel);
    button.appendChild(ipBadge);

    // Dropdown menu
    const dropdown = document.createElement("div");
    dropdown.className = "dev-network-dropdown dev-network-hidden";

    widget.appendChild(button);
    widget.appendChild(dropdown);
    container.appendChild(widget);

    this.dom = {
      widget,
      button,
      modeIcon,
      modeLabel,
      ipBadge,
      dropdown
    };

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    this._boundDocClick = (e) => {
      if (!widget.contains(e.target) && this.isOpen) {
        this.closeDropdown();
      }
    };

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("click", this._boundDocClick);
    }

    this.renderDropdown();
    this.updateUI();
  }

  unmount() {
    if (this._boundDocClick && typeof document !== "undefined" && typeof document.removeEventListener === "function") {
      document.removeEventListener("click", this._boundDocClick);
      this._boundDocClick = null;
    }
    if (this.container && this.dom.widget) {
      if (typeof this.dom.widget.remove === "function") {
        this.dom.widget.remove();
      }
    }
  }

  destroy() {
    this.unmount();
    for (const cleanup of this._cleanupFns) {
      try {
        cleanup();
      } catch {
        // Ignore cleanup error
      }
    }
    this._cleanupFns = [];
  }

  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.isOpen = true;
    if (this.dom.dropdown) {
      this.dom.dropdown.classList.remove("dev-network-hidden");
      this.dom.button.setAttribute("aria-expanded", "true");
      this.renderDropdown();
    }
  }

  closeDropdown() {
    this.isOpen = false;
    if (this.dom.dropdown) {
      this.dom.dropdown.classList.add("dev-network-hidden");
      this.dom.button.setAttribute("aria-expanded", "false");
    }
  }

  renderDropdown() {
    if (!this.dom.dropdown) return;

    const currentMode = this.proxyManager ? this.proxyManager.getMode() : PROXY_MODES.DIRECT;
    const currentIP = this.ipMonitor ? this.ipMonitor.getIP() : "Unknown IP";
    const ipStatus = this.ipMonitor ? this.ipMonitor.getStatus() : {};

    this.dom.dropdown.innerHTML = `
      <div class="dev-network-dropdown-header">
        <span class="dropdown-title">Proxy & IP Switcher</span>
        <button class="dropdown-refresh-btn" title="Refresh IP">⟳ Refresh</button>
      </div>

      <div class="dev-network-ip-status-box">
        <div class="ip-label">CURRENT PUBLIC IP</div>
        <div class="ip-value">${currentIP || "Detecting..."}</div>
        <div class="ip-sub">${ipStatus.status === "fetching" ? "Checking network..." : (currentMode === PROXY_MODES.TOR ? "🧅 Tor Exit Node" : "Standard Connection")}</div>
      </div>

      <div class="dev-network-modes-list">
        ${[PROXY_MODES.DIRECT, PROXY_MODES.SOCKS5, PROXY_MODES.TOR].map(mode => {
          const meta = MODE_METADATA[mode];
          const isSelected = mode === currentMode;
          return `
            <div class="dev-network-mode-option ${isSelected ? "selected" : ""}" data-mode="${mode}">
              <span class="mode-opt-icon">${meta.icon}</span>
              <div class="mode-opt-details">
                <div class="mode-opt-name">${meta.label}</div>
                <div class="mode-opt-desc">${meta.description}</div>
              </div>
              ${isSelected ? '<span class="mode-opt-check">✓</span>' : ''}
            </div>
          `;
        }).join("")}
      </div>

      <div class="dev-network-dropdown-actions">
        <button class="action-btn rotate-btn">🔄 Rotate Mode (Direct → SOCKS5 → Tor)</button>
      </div>
    `;

    // Hook events inside dropdown
    const options = this.dom.dropdown.querySelectorAll(".dev-network-mode-option");
    options.forEach(opt => {
      opt.addEventListener("click", () => {
        const mode = opt.getAttribute("data-mode");
        this.selectMode(mode);
      });
    });

    const refreshBtn = this.dom.dropdown.querySelector(".dropdown-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.ipMonitor) {
          this.ipMonitor.refreshIP();
        }
      });
    }

    const rotateBtn = this.dom.dropdown.querySelector(".rotate-btn");
    if (rotateBtn) {
      rotateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.proxyManager) {
          this.proxyManager.rotateProxy();
          if (this.ipMonitor) this.ipMonitor.refreshIP();
        }
      });
    }
  }

  async selectMode(mode) {
    if (this.proxyManager) {
      this.proxyManager.setMode(mode);
    }
    this.closeDropdown();

    if (this.ipMonitor) {
      await this.ipMonitor.refreshIP();
    }
    this.updateUI();
  }

  updateUI() {
    const currentMode = this.proxyManager ? this.proxyManager.getMode() : PROXY_MODES.DIRECT;
    const meta = MODE_METADATA[currentMode] || MODE_METADATA[PROXY_MODES.DIRECT];
    const ip = this.ipMonitor ? this.ipMonitor.getIP() : null;
    const status = this.ipMonitor ? this.ipMonitor.getStatus() : {};

    if (this.dom.modeIcon) {
      this.dom.modeIcon.textContent = meta.icon;
    }

    if (this.dom.modeLabel) {
      this.dom.modeLabel.textContent = meta.label;
    }

    if (this.dom.ipBadge) {
      if (status.status === "fetching") {
        this.dom.ipBadge.textContent = "Checking...";
        this.dom.ipBadge.className = "dev-network-ip-badge fetching";
      } else if (ip) {
        this.dom.ipBadge.textContent = ip;
        this.dom.ipBadge.className = `dev-network-ip-badge mode-${currentMode}`;
      } else {
        this.dom.ipBadge.textContent = "No IP";
        this.dom.ipBadge.className = "dev-network-ip-badge";
      }
    }

    if (this.dom.button) {
      this.dom.button.style.borderColor = meta.color;
    }

    if (this.isOpen) {
      this.renderDropdown();
    }
  }
}

module.exports = {
  MODE_METADATA,
  NetworkToolbarWidget
};
