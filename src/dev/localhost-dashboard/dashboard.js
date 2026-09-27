/**
 * Dev Browser - Localhost Dashboard Logic
 */

// If running in browser, require/import scanner or use window.DevLocalhost
let LocalhostScannerClass;
if (typeof require !== "undefined") {
  try {
    LocalhostScannerClass = require("./scanner").LocalhostScanner;
  } catch {
    LocalhostScannerClass = window.LocalhostScanner;
  }
} else {
  LocalhostScannerClass = window.LocalhostScanner;
}

class DashboardUI {
  constructor() {
    this.scanner = LocalhostScannerClass ? new LocalhostScannerClass() : null;
    this.services = [];
    this.filterQuery = "";

    this.grid = document.getElementById("services-grid");
    this.emptyState = document.getElementById("empty-state");
    this.statusText = document.getElementById("status-text");
    this.countBadge = document.getElementById("service-count-badge");
    this.searchInput = document.getElementById("search-input");
    this.refreshBtn = document.getElementById("refresh-btn");

    this.initEvents();
    this.startScan();
  }

  initEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.filterQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener("click", () => {
        this.startScan();
      });
    }
  }

  async startScan() {
    if (!this.scanner) return;

    if (this.statusText) {
      this.statusText.textContent = "Scanning 127.0.0.1 ports...";
    }
    if (this.refreshBtn) {
      this.refreshBtn.classList.add("loading");
    }

    try {
      const result = await this.scanner.scan();
      this.services = result.services || [];

      if (this.statusText) {
        this.statusText.textContent = `Scanned in ${result.scanDurationMs}ms • ${this.services.length} active services on 127.0.0.1`;
      }
    } catch (err) {
      if (this.statusText) {
        this.statusText.textContent = `Scan failed: ${err.message}`;
      }
    } finally {
      if (this.refreshBtn) {
        this.refreshBtn.classList.remove("loading");
      }
      this.render();
    }
  }

  render() {
    if (!this.grid) return;

    const filtered = this.services.filter(s => {
      if (!this.filterQuery) return true;
      const haystack = `${s.port} ${s.framework} ${s.title} ${s.category} ${s.url}`.toLowerCase();
      return haystack.includes(this.filterQuery);
    });

    if (this.countBadge) {
      this.countBadge.textContent = `${filtered.length} detected`;
    }

    if (filtered.length === 0) {
      this.grid.innerHTML = "";
      if (this.emptyState) this.emptyState.classList.remove("hidden");
      return;
    }

    if (this.emptyState) this.emptyState.classList.add("hidden");

    this.grid.innerHTML = filtered.map(s => `
      <div class="service-card" data-port="${s.port}">
        <div class="service-card-header">
          <div class="service-info">
            <span class="service-icon">${s.icon || "🌐"}</span>
            <div>
              <div class="service-title">${escapeHtml(s.title || `localhost:${s.port}`)}</div>
              <div class="service-framework">${escapeHtml(s.framework || "HTTP Service")}</div>
            </div>
          </div>
          <span class="port-badge">:${s.port}</span>
        </div>

        <div class="service-meta">
          <a href="${s.url}" class="service-url" target="_blank">${s.url}</a>
          <span class="latency">${s.latencyMs || 0}ms</span>
        </div>

        <div class="service-actions">
          <a href="${s.url}" target="_blank" class="card-btn primary">Open Tab</a>
          <button class="card-btn" onclick="navigator.clipboard.writeText('${s.url}')">Copy URL</button>
        </div>
      </div>
    `).join("");
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

if (typeof document !== "undefined" && document.getElementById("services-grid")) {
  document.addEventListener("DOMContentLoaded", () => {
    new DashboardUI();
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    DashboardUI,
    escapeHtml
  };
}
