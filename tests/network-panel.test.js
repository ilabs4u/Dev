const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  ProxyManager,
  PROXY_MODES,
  IPMonitor,
  NetworkToolbarWidget,
  MODE_METADATA
} = require("../src/dev/network-panel");
const { DevLuaBridge } = require("../src/dev/lua-engine/lua-bridge");
const { keymap } = require("../src/dev/lua-engine/keymap");
const { VimController } = require("../src/dev/vim-mode/vim-controller");

describe("Task 1.5: Proxy Switching & Network Panel", () => {
  let proxyManager;

  beforeEach(() => {
    proxyManager = new ProxyManager();
  });

  describe("ProxyManager Mode Switching", () => {
    it("initializes with default DIRECT mode", () => {
      assert.equal(proxyManager.getMode(), PROXY_MODES.DIRECT);
      const config = proxyManager.getConfig();
      assert.deepEqual(config, { type: "direct" });
    });

    it("switches to SOCKS5 proxy mode with remote DNS resolution", () => {
      proxyManager.setMode(PROXY_MODES.SOCKS5);
      assert.equal(proxyManager.getMode(), PROXY_MODES.SOCKS5);

      const config = proxyManager.getConfig();
      assert.equal(config.type, "socks");
      assert.equal(config.host, "127.0.0.1");
      assert.equal(config.port, 1080);
      assert.equal(config.proxyDNS, true, "SOCKS5 must enable proxyDNS to prevent DNS leaks");
    });

    it("switches to Tor Onion mode on port 9050 with proxyDNS enabled", () => {
      proxyManager.setMode(PROXY_MODES.TOR);
      assert.equal(proxyManager.getMode(), PROXY_MODES.TOR);

      const config = proxyManager.getConfig();
      assert.equal(config.type, "socks");
      assert.equal(config.host, "127.0.0.1");
      assert.equal(config.port, 9050);
      assert.equal(config.proxyDNS, true, "Tor must enable proxyDNS to prevent ISP tracking");
    });

    it("rotates through modes in sequence: Direct -> SOCKS5 -> Tor -> Direct", () => {
      assert.equal(proxyManager.getMode(), PROXY_MODES.DIRECT);

      assert.equal(proxyManager.rotateProxy(), PROXY_MODES.SOCKS5);
      assert.equal(proxyManager.getMode(), PROXY_MODES.SOCKS5);

      assert.equal(proxyManager.rotateProxy(), PROXY_MODES.TOR);
      assert.equal(proxyManager.getMode(), PROXY_MODES.TOR);

      assert.equal(proxyManager.rotateProxy(), PROXY_MODES.DIRECT);
      assert.equal(proxyManager.getMode(), PROXY_MODES.DIRECT);
    });

    it("emits modeChange event with previous and new mode details", () => {
      let eventPayload = null;
      proxyManager.on("modeChange", (data) => {
        eventPayload = data;
      });

      proxyManager.setMode(PROXY_MODES.TOR);
      assert.ok(eventPayload);
      assert.equal(eventPayload.mode, PROXY_MODES.TOR);
      assert.equal(eventPayload.previousMode, PROXY_MODES.DIRECT);
      assert.equal(eventPayload.config.type, "socks");
    });

    it("throws error when setting invalid mode", () => {
      assert.throws(() => {
        proxyManager.setMode("invalid-protocol");
      }, /Invalid proxy mode/);
    });
  });

  describe("Firefox browser.proxy.onRequest API Filter", () => {
    it("returns Firefox proxyInfo array matching active mode", () => {
      // Direct
      let res = proxyManager.handleProxyRequest({ url: "https://example.com" });
      assert.deepEqual(res, [{ type: "direct" }]);

      // SOCKS5
      proxyManager.setMode(PROXY_MODES.SOCKS5);
      res = proxyManager.handleProxyRequest({ url: "https://example.com" });
      assert.deepEqual(res, [{
        type: "socks",
        host: "127.0.0.1",
        port: 1080,
        proxyDNS: true
      }]);

      // Tor
      proxyManager.setMode(PROXY_MODES.TOR);
      res = proxyManager.handleProxyRequest({ url: "https://example.com" });
      assert.deepEqual(res, [{
        type: "socks",
        host: "127.0.0.1",
        port: 9050,
        proxyDNS: true
      }]);
    });

    it("bypasses proxy for localhost and 127.0.0.1 even when Tor is active", () => {
      proxyManager.setMode(PROXY_MODES.TOR);

      const res1 = proxyManager.handleProxyRequest({ url: "http://localhost:3000/api" });
      assert.deepEqual(res1, [{ type: "direct" }]);

      const res2 = proxyManager.handleProxyRequest({ url: "http://127.0.0.1:8000/dashboard" });
      assert.deepEqual(res2, [{ type: "direct" }]);
    });

    it("always routes .onion domains via Tor even in Direct mode", () => {
      proxyManager.setMode(PROXY_MODES.DIRECT);

      const res = proxyManager.handleProxyRequest({
        url: "http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion"
      });

      assert.equal(res[0].type, "socks");
      assert.equal(res[0].port, 9050);
      assert.equal(res[0].proxyDNS, true);
    });

    it("supports per-tab proxy overrides", () => {
      proxyManager.setMode(PROXY_MODES.DIRECT);

      // Set tab 42 to use Tor
      proxyManager.setTabProxy(42, PROXY_MODES.TOR);

      const tab1Res = proxyManager.handleProxyRequest({ url: "https://whatismyip.com", tabId: 1 });
      assert.deepEqual(tab1Res, [{ type: "direct" }]);

      const tab42Res = proxyManager.handleProxyRequest({ url: "https://whatismyip.com", tabId: 42 });
      assert.equal(tab42Res[0].type, "socks");
      assert.equal(tab42Res[0].port, 9050);

      // Reset tab 42
      proxyManager.clearTabProxy(42);
      const tab42Reset = proxyManager.handleProxyRequest({ url: "https://whatismyip.com", tabId: 42 });
      assert.deepEqual(tab42Reset, [{ type: "direct" }]);
    });

    it("registers and unregisters with Gecko browser.proxy.onRequest API", () => {
      let registeredListener = null;
      let registeredFilter = null;
      let removedListener = null;

      const mockBrowserProxy = {
        onRequest: {
          addListener: (fn, filter) => {
            registeredListener = fn;
            registeredFilter = filter;
          },
          removeListener: (fn) => {
            removedListener = fn;
          }
        }
      };

      const success = proxyManager.register(mockBrowserProxy);
      assert.equal(success, true);
      assert.ok(registeredListener);
      assert.deepEqual(registeredFilter, { urls: ["<all_urls>"] });

      // Trigger listener
      const proxyResult = registeredListener({ url: "https://news.ycombinator.com" });
      assert.deepEqual(proxyResult, [{ type: "direct" }]);

      // Unregister
      proxyManager.unregister();
      assert.equal(removedListener, registeredListener);
    });
  });

  describe("IPMonitor & Public IP Tracking", () => {
    it("fetches and caches IP address", async () => {
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ip: "203.0.113.45" })
      });

      const monitor = new IPMonitor({ fetchFn: mockFetch });
      const ip = await monitor.refreshIP();

      assert.equal(ip, "203.0.113.45");
      assert.equal(monitor.getIP(), "203.0.113.45");
      assert.equal(monitor.getStatus().status, "ready");
    });

    it("detects IP change when switching to Tor", async () => {
      let currentMockIP = "198.51.100.12"; // User ISP IP
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ip: currentMockIP })
      });

      const monitor = new IPMonitor({ fetchFn: mockFetch });
      const ipEvents = [];
      monitor.on("ipChange", (data) => ipEvents.push(data));

      // Initial IP check (Direct)
      await monitor.refreshIP();
      assert.equal(monitor.getIP(), "198.51.100.12");
      assert.equal(ipEvents.length, 1);
      assert.equal(ipEvents[0].ip, "198.51.100.12");
      assert.equal(ipEvents[0].previousIP, null);

      // User clicks 'Tor' -> IP switches to Tor Exit Node
      currentMockIP = "185.220.101.5"; // Tor Exit Relay IP
      await monitor.refreshIP();

      assert.equal(monitor.getIP(), "185.220.101.5");
      assert.equal(ipEvents.length, 2);
      assert.equal(ipEvents[1].ip, "185.220.101.5");
      assert.equal(ipEvents[1].previousIP, "198.51.100.12");
    });

    it("handles fetch failure gracefully", async () => {
      const failingFetch = async () => {
        throw new Error("Network unreachable");
      };

      const monitor = new IPMonitor({ fetchFn: failingFetch, timeoutMs: 100 });
      const ip = await monitor.refreshIP();

      assert.equal(ip, null);
      assert.equal(monitor.getStatus().status, "error");
      assert.ok(monitor.getStatus().error.includes("Failed"));
    });
  });

  describe("Network Toolbar Widget UI", () => {
    // Minimal DOM mock for widget testing in Node environment
    function createMockDOM() {
      const container = {
        innerHTML: "",
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
        contains(target) {
          return this === target || this.children.includes(target);
        }
      };

      global.document = {
        createElement(tag) {
          return {
            tagName: tag.toUpperCase(),
            className: "",
            innerHTML: "",
            textContent: "",
            style: {},
            children: [],
            attributes: {},
            listeners: {},
            setAttribute(k, v) { this.attributes[k] = v; },
            getAttribute(k) { return this.attributes[k]; },
            classList: {
              classes: new Set(),
              add(c) { this.classes.add(c); },
              remove(c) { this.classes.delete(c); },
              contains(c) { return this.classes.has(c); }
            },
            appendChild(child) {
              this.children.push(child);
            },
            querySelectorAll(sel) {
              return [];
            },
            querySelector(sel) {
              return null;
            },
            contains(target) {
              return this === target;
            },
            addEventListener(ev, fn) {
              this.listeners[ev] = fn;
            }
          };
        },
        addEventListener() {}
      };

      return container;
    }

    it("mounts toolbar widget and displays initial Direct mode", () => {
      const container = createMockDOM();
      const widget = new NetworkToolbarWidget({
        proxyManager,
        container
      });

      assert.equal(widget.dom.modeLabel.textContent, "Direct");
      assert.equal(widget.dom.modeIcon.textContent, "🌐");
    });

    it("updates toolbar display when proxy mode changes", () => {
      const container = createMockDOM();
      const widget = new NetworkToolbarWidget({
        proxyManager,
        container
      });

      proxyManager.setMode(PROXY_MODES.TOR);
      assert.equal(widget.dom.modeLabel.textContent, "Tor");
      assert.equal(widget.dom.modeIcon.textContent, "🧅");

      proxyManager.setMode(PROXY_MODES.SOCKS5);
      assert.equal(widget.dom.modeLabel.textContent, "SOCKS5");
      assert.equal(widget.dom.modeIcon.textContent, "🧦");
    });

    it("updates toolbar display with detected IP address", async () => {
      const container = createMockDOM();
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ip: "185.220.101.5" })
      });
      const monitor = new IPMonitor({ fetchFn: mockFetch });

      const widget = new NetworkToolbarWidget({
        proxyManager,
        ipMonitor: monitor,
        container
      });

      await monitor.refreshIP();
      assert.equal(widget.dom.ipBadge.textContent, "185.220.101.5");
    });
  });

  describe("Lua Bridge & Keymap Integration", () => {
    it("handles network.proxy.set and network.dns.set in Lua", () => {
      const bridge = new DevLuaBridge();
      bridge.init();

      bridge.evaluateLuaScript(`
        network.proxy.set("socks5")
        network.dns.set("cloudflare-doh")
      `);

      assert.equal(bridge.networkSettings.proxy.default, "socks5");
      assert.equal(bridge.networkSettings.dns.resolver, "cloudflare-doh");
    });

    it("handles <leader>ip keybinding to rotate proxy via VimController", () => {
      let proxyRotated = false;
      const fakeDelegate = {
        rotateProxy: () => {
          proxyRotated = true;
          return proxyManager.rotateProxy();
        }
      };

      const vim = new VimController({
        keymap,
        browserDelegate: fakeDelegate
      });

      // Clear keymaps and add <leader>ip
      keymap.clear();
      keymap.set("n", "<leader>ip", "rotate_proxy");

      // Press Space (leader) then i then p in normal mode
      keymap.handleKeyEvent({ key: " " });
      keymap.handleKeyEvent({ key: "i" });
      keymap.handleKeyEvent({ key: "p" });

      assert.equal(proxyRotated, true, "<leader>ip must execute rotate_proxy action");
      assert.equal(proxyManager.getMode(), PROXY_MODES.SOCKS5);
    });
  });
});
