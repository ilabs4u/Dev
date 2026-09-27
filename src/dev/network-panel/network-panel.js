/**
 * Dev Browser - Network Hacker Mode Controller
 * Logic for the Network & Proxy Center settings panel.
 */

let ProxyManagerClass, IPMonitorClass, PROXY_MODES_DEF, DnsEngineClass;
if (typeof require !== "undefined") {
  try {
    const pm = require("./proxy-manager");
    ProxyManagerClass = pm.ProxyManager;
    PROXY_MODES_DEF = pm.PROXY_MODES;
    IPMonitorClass = require("./ip-monitor").IPMonitor;
    DnsEngineClass = require("./dns-engine").DnsEngine;
  } catch {
    ProxyManagerClass = window.ProxyManager;
    IPMonitorClass = window.IPMonitor;
    PROXY_MODES_DEF = window.PROXY_MODES;
    DnsEngineClass = window.DnsEngine;
  }
} else {
  ProxyManagerClass = window.ProxyManager;
  IPMonitorClass = window.IPMonitor;
  PROXY_MODES_DEF = window.PROXY_MODES;
  DnsEngineClass = window.DnsEngine;
}

class NetworkPanelUI {
  constructor(options = {}) {
    this.proxyManager = options.proxyManager || (ProxyManagerClass ? new ProxyManagerClass() : null);
    this.ipMonitor = options.ipMonitor || (IPMonitorClass ? new IPMonitorClass() : null);
    this.dnsEngine = options.dnsEngine || (DnsEngineClass ? new DnsEngineClass() : null);
    this.dnsResolver = options.dnsResolver || "cloudflare-doh";

    const getEl = id => (typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null);
    const queryAll = sel => (typeof document !== "undefined" && document.querySelectorAll ? document.querySelectorAll(sel) : []);

    this.dom = {
      globalStatusBadge: getEl("global-status-badge"),
      displayIP: getEl("display-ip-address"),
      displayMode: getEl("display-routing-mode"),
      displayLastChecked: getEl("display-last-checked"),
      refreshBtn: getEl("refresh-ip-btn"),
      rotateBtn: getEl("quick-rotate-btn"),
      newTorIdBtn: getEl("new-tor-identity-btn"),
      modeCards: queryAll(".mode-card"),
      dnsRadios: queryAll("input[name='doh-resolver']"),
      customDohInput: getEl("custom-doh-url"),
      setCustomDohBtn: getEl("set-custom-doh-btn"),
      overrideDomainInput: getEl("dns-override-domain"),
      overrideIpInput: getEl("dns-override-ip"),
      addOverrideBtn: getEl("add-dns-override-btn"),
      overrideTbody: getEl("dns-override-tbody")
    };

    this.initEvents();
    this.updateDisplay();
    this.renderOverrides();
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
          if (this.dnsEngine) {
            this.dnsEngine.setResolver(e.target.value);
          }
        });
      });
    }

    if (this.dom.setCustomDohBtn && this.dom.customDohInput) {
      this.dom.setCustomDohBtn.addEventListener("click", () => {
        const url = this.dom.customDohInput.value.trim();
        if (url && this.dnsEngine) {
          this.dnsEngine.setResolver(url);
          this.dnsResolver = url;
        }
      });
    }

    if (this.dom.addOverrideBtn && this.dom.overrideDomainInput && this.dom.overrideIpInput) {
      this.dom.addOverrideBtn.addEventListener("click", () => {
        const domain = this.dom.overrideDomainInput.value.trim();
        const ip = this.dom.overrideIpInput.value.trim();
        if (domain && ip && this.dnsEngine) {
          this.dnsEngine.setOverride(domain, ip);
          this.dom.overrideDomainInput.value = "";
          this.dom.overrideIpInput.value = "";
          this.renderOverrides();
        }
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

  renderOverrides() {
    if (!this.dom.overrideTbody || !this.dnsEngine) return;
    this.dom.overrideTbody.innerHTML = "";
    const overrides = this.dnsEngine.listOverrides();
    if (overrides.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3" style="padding: 10px; color: var(--text-muted, #6c7086); text-align: center;">No DNS overrides active</td>`;
      this.dom.overrideTbody.appendChild(tr);
      return;
    }

    overrides.forEach(({ domain, ip }) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border-color, #45475a)";
      tr.innerHTML = `
        <td style="padding: 6px; font-family: monospace;">${domain}</td>
        <td style="padding: 6px; font-family: monospace; color: var(--accent-primary, #cba6f7);">${ip}</td>
        <td style="padding: 6px; text-align: right;">
          <button class="btn btn-sm btn-delete-override" data-domain="${domain}" style="padding: 2px 8px; font-size: 11px;">✕ Remove</button>
        </td>
      `;
      const btn = tr.querySelector(".btn-delete-override");
      if (btn) {
        btn.addEventListener("click", () => {
          this.dnsEngine.removeOverride(domain);
          this.renderOverrides();
        });
      }
      this.dom.overrideTbody.appendChild(tr);
    });
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
