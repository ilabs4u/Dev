/**
 * Dev Browser - IP Monitor
 * Fetches, caches, and monitors public IP address changes (e.g. on proxy switch).
 */

const DEFAULT_IP_ENDPOINTS = [
  { url: "https://api.ipify.org?format=json", parse: (data) => data.ip },
  { url: "https://icanhazip.com", parse: (text) => text.trim() },
  { url: "https://ifconfig.me/ip", parse: (text) => text.trim() }
];

class IPMonitor {
  constructor(options = {}) {
    this.currentIP = options.initialIP || null;
    this.lastChecked = null;
    this.status = "idle"; // "idle" | "fetching" | "ready" | "error"
    this.error = null;
    this.timeoutMs = options.timeoutMs || 3000;
    this.fetchFn = options.fetchFn || (typeof fetch !== "undefined" ? fetch : null);
    this.endpoints = options.endpoints || DEFAULT_IP_ENDPOINTS;
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in IPMonitor event listener [${event}]:`, err);
        }
      }
    }
  }

  getIP() {
    return this.currentIP;
  }

  getStatus() {
    return {
      ip: this.currentIP,
      lastChecked: this.lastChecked,
      status: this.status,
      error: this.error
    };
  }

  /**
   * Fetches public IP using the configured fetcher.
   * If the IP changes, emits "ipChange".
   */
  async refreshIP() {
    if (!this.fetchFn) {
      this.status = "error";
      this.error = "No fetch implementation available";
      return null;
    }

    this.status = "fetching";
    this.error = null;
    this.emit("statusChange", { status: this.status });

    let detectedIP = null;

    for (const endpoint of this.endpoints) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

      try {
        const response = await this.fetchFn(endpoint.url, {
          method: "GET",
          signal: controller ? controller.signal : undefined,
          headers: { "Accept": "application/json, text/plain, */*" }
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (response && (response.ok || response.status === 200)) {
          let data;
          if (typeof response.json === "function") {
            try {
              data = await response.json();
            } catch {
              data = await response.text();
            }
          } else if (typeof response.text === "function") {
            data = await response.text();
          } else {
            data = response;
          }

          detectedIP = endpoint.parse(data);
          if (detectedIP && typeof detectedIP === "string" && detectedIP.length > 3) {
            break;
          }
        }
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        // Try next endpoint
      }
    }

    if (detectedIP) {
      const previousIP = this.currentIP;
      this.currentIP = detectedIP.trim();
      this.lastChecked = Date.now();
      this.status = "ready";
      this.error = null;

      this.emit("statusChange", { status: this.status, ip: this.currentIP });

      if (previousIP !== this.currentIP) {
        this.emit("ipChange", {
          ip: this.currentIP,
          previousIP,
          timestamp: this.lastChecked
        });
      }

      return this.currentIP;
    } else {
      this.status = "error";
      this.error = "Failed to determine public IP address";
      this.emit("statusChange", { status: this.status, error: this.error });
      return null;
    }
  }
}

module.exports = {
  DEFAULT_IP_ENDPOINTS,
  IPMonitor
};
