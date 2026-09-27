/**
 * Dev Browser - Network Hacker Mode Controller
 * Logic for the Network & Proxy Center settings panel.
 */

let ProxyManagerClass, IPMonitorClass, PROXY_MODES_DEF;
if (typeof require !== "undefined") {
  try {
    const pm = require("./proxy-manager");
    ProxyManagerClass = pm.ProxyManager;
    PROXY_MODES_DEF = pm.PROXY_MODES;
    IPMonitorClass = require("./ip-monitor").IPMonitor;
  } catch {
    ProxyManagerClass = window.ProxyManager;
    IPMonitorClass = window.IPMonitor;
    PROXY_MODES_DEF = window.PROXY_MODES;
  }
} else {
  ProxyManagerClass = window.ProxyManager;
  IPMonitorClass = window.IPMonitor;
  PROXY_MODES_DEF = window.PROXY_MODES;
}

class NetworkPanelUI {
  constructor(options = {}) {
    this.proxyManager = options.proxyManager || (ProxyManagerClass ? new ProxyManagerClass() : null);
    this.ipMonitor = options.ipMonitor || (IPMonitorClass ? new IPMonitorClass() : null);
    this.dnsResolver = options.dnsResolver || "cloudflare-doh";

    this.dom = {
      globalStatusBadge: document.getElementById("global-status-badge"),
      displayIP: document.getElementById("display-ip-address"),
      displayMode: document.getElementById("display-routing-mode"),
      displayLastChecked: document.getElementById("display-last-checked"),
      refreshBtn: document.getElementById("refresh-ip-btn"),
      rotateBtn: document.getElementById("quick-rotate-btn"),
      newTorIdBtn: document.getElementById("new-tor-identity-btn"),
      modeCards: document.querySelectorAll(".mode-card"),
      dnsRadios: document.querySelectorAll("input[name='doh-resolver']")
    };

    this.initEvents();
    this.updateDisplay();
    if (this.ipMonitor) {
      this.ipMonitor.refreshIP();
    }
  }

  initEvents() {
    if (this.dom.modeCards) {
      this.dom.modeCards.forEach(card => {
        card.addEventListener("click", () => {
          const mode = card.getAttribute("data-mode");
          this.setMode(mode);
        });
      });
    }

    if (this.dom.refreshBtn) {
      this.dom.refreshBtn.addEventListener("click", () => {
        if (this.ipMonitor) {
          this.ipMonitor.refreshIP();
        }
      });
    }

    if (this.dom.rotateBtn) {
      this.dom.rotateBtn.addEventListener("click", () => {
        if (this.proxyManager) {
          const next = this.proxyManager.rotateProxy();
          this.setMode(next);
        }
      });
    }

    if (this.dom.newTorIdBtn) {
      this.dom.newTorIdBtn.addEventListener("click", () => {
        this.requestNewTorIdentity();
      });
    }

    if (this.dom.dnsRadios) {
      this.dom.dnsRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
          this.dnsResolver = e.target.value;
        });
      });
    }

    if (this.proxyManager) {
      this.proxyManager.on("modeChange", () => this.updateDisplay());
    }

    if (this.ipMonitor) {
      this.ipMonitor.on("statusChange", () => this.updateDisplay());
      this.ipMonitor.on("ipChange", () => this.updateDisplay());
    }
  }

  async setMode(mode) {
    if (this.proxyManager) {
      this.proxyManager.setMode(mode);
    }
    this.updateDisplay();

    if (this.ipMonitor) {
      await this.ipMonitor.refreshIP();
      this.updateDisplay();
    }
  }

  async requestNewTorIdentity() {
    // Switch to Tor if not already
    if (this.proxyManager && this.proxyManager.getMode() !== "tor") {
      this.proxyManager.setMode("tor");
    }

    if (this.dom.newTorIdBtn) {
      this.dom.newTorIdBtn.textContent = "🧅 Requesting new circuit...";
    }

    // Refresh IP to verify identity change
    if (this.ipMonitor) {
      await this.ipMonitor.refreshIP();
    }

    if (this.dom.newTorIdBtn) {
      this.dom.newTorIdBtn.textContent = "🧅 New Tor Identity (SIGNAL NEWNYM)";
    }
    this.updateDisplay();
  }

  updateDisplay() {
    const mode = this.proxyManager ? this.proxyManager.getMode() : "direct";
    const ip = this.ipMonitor ? this.ipMonitor.getIP() : null;
    const status = this.ipMonitor ? this.ipMonitor.getStatus() : {};

    // 1. Update Global Status Badge
    if (this.dom.globalStatusBadge) {
      this.dom.globalStatusBadge.className = `status-badge ${mode}`;
      if (mode === "tor") {
        this.dom.globalStatusBadge.textContent = "🧅 Tor Network Active";
      } else if (mode === "socks5") {
        this.dom.globalStatusBadge.textContent = "🧦 SOCKS5 Proxy Active";
      } else {
        this.dom.globalStatusBadge.textContent = "🌐 Direct Connection";
      }
    }

    // 2. Update Mode Cards
    if (this.dom.modeCards) {
      this.dom.modeCards.forEach(card => {
        if (card.getAttribute("data-mode") === mode) {
          card.classList.add("active");
        } else {
          card.classList.remove("active");
        }
      });
    }

    // 3. Update IP Info
    if (this.dom.displayIP) {
      if (status.status === "fetching") {
        this.dom.displayIP.textContent = "Checking IP...";
      } else {
        this.dom.displayIP.textContent = ip || "Unavailable";
      }
    }

    if (this.dom.displayMode) {
      this.dom.displayMode.textContent = mode.toUpperCase();
    }

    if (this.dom.displayLastChecked) {
      if (status.lastChecked) {
        const d = new Date(status.lastChecked);
        this.dom.displayLastChecked.textContent = d.toLocaleTimeString();
      } else {
        this.dom.displayLastChecked.textContent = "Never";
      }
    }
  }
}

if (typeof document !== "undefined" && document.getElementById("global-status-badge")) {
  document.addEventListener("DOMContentLoaded", () => {
    new NetworkPanelUI();
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    NetworkPanelUI
  };
}
