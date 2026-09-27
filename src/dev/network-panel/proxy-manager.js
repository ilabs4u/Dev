/**
 * Dev Browser - Proxy Manager
 * Handles proxy switching (Direct, SOCKS5, Tor), per-tab routing,
 * and Firefox browser.proxy.onRequest API integration.
 */

const PROXY_MODES = {
  DIRECT: "direct",
  SOCKS5: "socks5",
  TOR: "tor",
  HTTP: "http",
  HTTPS: "https",
  CUSTOM: "custom"
};

const DEFAULT_CONFIGS = {
  [PROXY_MODES.DIRECT]: {
    type: "direct"
  },
  [PROXY_MODES.SOCKS5]: {
    type: "socks",
    host: "127.0.0.1",
    port: 1080,
    proxyDNS: true
  },
  [PROXY_MODES.TOR]: {
    type: "socks",
    host: "127.0.0.1",
    port: 9050, // Standard Tor daemon; fallback 9150 (Tor Browser bundle)
    proxyDNS: true
  }
};

const DEFAULT_BYPASS_LIST = [
  "localhost",
  "127.0.0.1",
  "::1",
  "*.local"
];

class ProxyManager {
  constructor(options = {}) {
    this.currentMode = options.defaultMode || PROXY_MODES.DIRECT;
    this.configs = {
      [PROXY_MODES.DIRECT]: { ...DEFAULT_CONFIGS[PROXY_MODES.DIRECT] },
      [PROXY_MODES.SOCKS5]: { ...DEFAULT_CONFIGS[PROXY_MODES.SOCKS5], ...(options.socks5 || {}) },
      [PROXY_MODES.TOR]: { ...DEFAULT_CONFIGS[PROXY_MODES.TOR], ...(options.tor || {}) }
    };

    this.bypassList = [...(options.bypassList || DEFAULT_BYPASS_LIST)];
    this.forceTorOnion = options.forceTorOnion !== false; // Default true: .onion always routed via Tor

    this.tabOverrides = new Map(); // tabId -> mode / config
    this.workspaceOverrides = new Map(); // workspaceName -> mode / config
    this.domainRules = new Map(); // domain -> mode / config

    this.listeners = new Map();
    this.registeredWithBrowser = false;
    this.browserProxyApi = null;
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
          console.error(`Error in ProxyManager event listener [${event}]:`, err);
        }
      }
    }
  }

  getMode() {
    return this.currentMode;
  }

  getConfig(mode = this.currentMode) {
    return this.configs[mode] || { type: "direct" };
  }

  setMode(mode, customConfig = null) {
    const validModes = Object.values(PROXY_MODES);
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid proxy mode: "${mode}". Valid modes: ${validModes.join(", ")}`);
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    if (customConfig) {
      this.configs[mode] = { ...this.configs[mode], ...customConfig };
    }

    const activeConfig = this.getConfig(mode);
    this.emit("modeChange", {
      mode,
      previousMode,
      config: activeConfig
    });

    return activeConfig;
  }

  /**
   * Rotates between Direct -> SOCKS5 -> Tor -> Direct
   */
  rotateProxy() {
    const sequence = [PROXY_MODES.DIRECT, PROXY_MODES.SOCKS5, PROXY_MODES.TOR];
    const currentIndex = sequence.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % sequence.length;
    const nextMode = sequence[nextIndex];
    this.setMode(nextMode);
    return nextMode;
  }

  setTabProxy(tabId, modeOrConfig) {
    if (!modeOrConfig || modeOrConfig === "reset") {
      this.tabOverrides.delete(tabId);
    } else {
      this.tabOverrides.set(tabId, modeOrConfig);
    }
    this.emit("tabOverrideChange", { tabId, override: modeOrConfig });
  }

  getTabProxy(tabId) {
    return this.tabOverrides.get(tabId) || null;
  }

  clearTabProxy(tabId) {
    this.tabOverrides.delete(tabId);
  }

  setWorkspaceProxy(workspaceName, modeOrConfig) {
    if (!modeOrConfig || modeOrConfig === "reset") {
      this.workspaceOverrides.delete(workspaceName);
    } else {
      this.workspaceOverrides.set(workspaceName, modeOrConfig);
    }
  }

  getWorkspaceProxy(workspaceName) {
    return this.workspaceOverrides.get(workspaceName) || null;
  }

  setDomainRule(domain, modeOrConfig) {
    this.domainRules.set(domain.toLowerCase(), modeOrConfig);
  }

  isBypassed(hostname) {
    if (!hostname) return false;
    const lower = hostname.toLowerCase();

    for (const pattern of this.bypassList) {
      if (pattern.startsWith("*.")) {
        const root = pattern.slice(2).toLowerCase();
        if (lower === root || lower.endsWith("." + root)) {
          return true;
        }
      } else if (lower === pattern.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  resolveConfigFromSpec(spec) {
    if (!spec) return this.getConfig(this.currentMode);
    if (typeof spec === "string") {
      return this.getConfig(spec);
    }
    return spec;
  }

  /**
   * Firefox browser.proxy.onRequest filter implementation.
   * Receives requestDetails and returns proxyInfo.
   *
   * @param {object} requestDetails - { url, tabId, type, ... }
   * @returns {object|array} Firefox proxy info (e.g. { type: "socks", host: "127.0.0.1", port: 9050, proxyDNS: true })
   */
  handleProxyRequest(requestDetails) {
    const urlStr = requestDetails ? requestDetails.url : "";
    let hostname = "";
    try {
      if (urlStr) {
        const parsed = new URL(urlStr);
        hostname = parsed.hostname;
      }
    } catch {
      // In case of non-standard URL, leave hostname empty
    }

    // 1. Tor Onion addresses (.onion) - always route via Tor if enabled
    if (this.forceTorOnion && hostname && hostname.toLowerCase().endsWith(".onion")) {
      return [this.getConfig(PROXY_MODES.TOR)];
    }

    // 2. Bypass rules (localhost, 127.0.0.1, etc.)
    if (hostname && this.isBypassed(hostname)) {
      return [{ type: "direct" }];
    }

    // 3. Domain-specific rules
    if (hostname) {
      const domainRule = this.domainRules.get(hostname.toLowerCase());
      if (domainRule) {
        return [this.resolveConfigFromSpec(domainRule)];
      }
    }

    // 4. Per-tab override
    if (requestDetails && requestDetails.tabId !== undefined && requestDetails.tabId !== -1) {
      const tabOverride = this.tabOverrides.get(requestDetails.tabId);
      if (tabOverride) {
        return [this.resolveConfigFromSpec(tabOverride)];
      }
    }

    // 5. Per-workspace override
    if (requestDetails && requestDetails.workspace) {
      const wsOverride = this.workspaceOverrides.get(requestDetails.workspace);
      if (wsOverride) {
        return [this.resolveConfigFromSpec(wsOverride)];
      }
    }

    // 6. Global active mode
    const activeConfig = this.getConfig(this.currentMode);
    return [activeConfig];
  }

  /**
   * Registers this manager with Firefox / Gecko browser.proxy API
   */
  register(browserProxyApi) {
    this.browserProxyApi = browserProxyApi;
    if (browserProxyApi && browserProxyApi.onRequest && typeof browserProxyApi.onRequest.addListener === "function") {
      this.proxyListener = (details) => this.handleProxyRequest(details);
      browserProxyApi.onRequest.addListener(this.proxyListener, { urls: ["<all_urls>"] });
      this.registeredWithBrowser = true;
      return true;
    }
    return false;
  }

  unregister() {
    if (this.registeredWithBrowser && this.browserProxyApi && this.proxyListener) {
      this.browserProxyApi.onRequest.removeListener(this.proxyListener);
      this.registeredWithBrowser = false;
      this.proxyListener = null;
    }
  }
}

module.exports = {
  PROXY_MODES,
  DEFAULT_CONFIGS,
  DEFAULT_BYPASS_LIST,
  ProxyManager
};
