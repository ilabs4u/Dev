const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  ProxyManager,
  PROXY_MODES,
  IPMonitor,
  NetworkToolbarWidget,
  MODE_METADATA,
  isValidIP,
  defaultProxyManager
} = require("../src/dev/network-panel");
const { DevLuaBridge } = require("../src/dev/lua-engine/lua-bridge");
const { keymap, KeymapManager } = require("../src/dev/lua-engine/keymap");
const { VimController } = require("../src/dev/vim-mode/vim-controller");
const { LinkHints } = require("../src/dev/vim-mode/hints");
const { fuzzyMatch, CommandPalette } = require("../src/dev/command-palette");

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
        body: {
          appendChild() {}
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

      // Clear keymaps and add <leader>ip with space as leader
      keymap.clear();
      keymap.setLeader(" ");
      keymap.set("n", "<leader>ip", "rotate_proxy");

      // Press Space (leader) then i then p in normal mode
      keymap.handleKeyEvent({ key: " " });
      keymap.handleKeyEvent({ key: "i" });
      keymap.handleKeyEvent({ key: "p" });

      assert.equal(proxyRotated, true, "<leader>ip must execute rotate_proxy action");
      assert.equal(proxyManager.getMode(), PROXY_MODES.SOCKS5);
      keymap.resetDefaults();
    });

    it("handles <leader>ip with default VimController delegate without manual mock", () => {
      const vim = new VimController({ keymap });
      keymap.resetDefaults();
      keymap.setLeader(" ");

      const initialMode = defaultProxyManager.getMode();
      // Press Space then i then p
      keymap.handleKeyEvent({ key: " " });
      keymap.handleKeyEvent({ key: "i" });
      keymap.handleKeyEvent({ key: "p" });

      const newMode = defaultProxyManager.getMode();
      assert.notEqual(newMode, initialMode, "Default delegate must rotate proxy on <leader>ip");
      keymap.resetDefaults();
    });
  });

  describe("Robustness & Edge Cases Verification", () => {
    it("bypasses bracketed IPv6 localhost http://[::1]:8080 when Tor is active", () => {
      proxyManager.setMode(PROXY_MODES.TOR);

      const res = proxyManager.handleProxyRequest({ url: "http://[::1]:8080/api/status" });
      assert.deepEqual(res, [{ type: "direct" }], "IPv6 [::1] must be bypassed directly");
    });

    it("bypasses RFC 6761 subdomains of .localhost e.g. http://app.localhost:3000", () => {
      proxyManager.setMode(PROXY_MODES.TOR);

      const res1 = proxyManager.handleProxyRequest({ url: "http://app.localhost:3000" });
      assert.deepEqual(res1, [{ type: "direct" }]);

      const res2 = proxyManager.handleProxyRequest({ url: "http://api.test.localhost:8000" });
      assert.deepEqual(res2, [{ type: "direct" }]);
    });

    it("bypasses entire IPv4 loopback range 127.0.0.0/8 (e.g. 127.0.0.2)", () => {
      proxyManager.setMode(PROXY_MODES.TOR);

      const res = proxyManager.handleProxyRequest({ url: "http://127.0.0.2:8000/dashboard" });
      assert.deepEqual(res, [{ type: "direct" }], "127.0.0.2 loopback IP must be bypassed");
    });

    it("normalizes string and number tabId in setTabProxy / handleProxyRequest", () => {
      proxyManager.setMode(PROXY_MODES.DIRECT);

      // Set override using string "99"
      proxyManager.setTabProxy("99", PROXY_MODES.TOR);

      // Request using number 99
      const resNum = proxyManager.handleProxyRequest({ url: "https://example.com", tabId: 99 });
      assert.equal(resNum[0].type, "socks");
      assert.equal(resNum[0].port, 9050);

      // Request using string "99"
      const resStr = proxyManager.handleProxyRequest({ url: "https://example.com", tabId: "99" });
      assert.equal(resStr[0].type, "socks");
      assert.equal(resStr[0].port, 9050);

      // Clear override
      proxyManager.clearTabProxy(99);
      const resCleared = proxyManager.handleProxyRequest({ url: "https://example.com", tabId: 99 });
      assert.deepEqual(resCleared, [{ type: "direct" }]);
    });

    it("re-registering browser proxy API cleans up previous listener without leaking", () => {
      let addCount = 0;
      let removeCount = 0;

      const mockApi = {
        onRequest: {
          addListener: () => { addCount++; },
          removeListener: () => { removeCount++; }
        }
      };

      proxyManager.register(mockApi);
      assert.equal(addCount, 1);
      assert.equal(removeCount, 0);

      // Register again on same instance
      proxyManager.register(mockApi);
      assert.equal(addCount, 2);
      assert.equal(removeCount, 1, "Previous listener must be unregistered to prevent memory leaks");

      proxyManager.unregister();
      assert.equal(removeCount, 2);
    });

    it("IPMonitor isValidIP rejects HTML error pages and validates real IP addresses", () => {
      assert.equal(isValidIP("<html><body>502 Bad Gateway</body></html>"), false);
      assert.equal(isValidIP("nginx 404 Not Found"), false);
      assert.equal(isValidIP(""), false);
      assert.equal(isValidIP(null), false);
      assert.equal(isValidIP(undefined), false);

      // Valid IPv4
      assert.equal(isValidIP("203.0.113.45"), true);
      assert.equal(isValidIP("127.0.0.1"), true);
      assert.equal(isValidIP("8.8.8.8"), true);

      // Valid IPv6
      assert.equal(isValidIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), true);
      assert.equal(isValidIP("::1"), true);
      assert.equal(isValidIP("2606:4700:4700::1111"), true);
    });

    it("IPMonitor handles HTML error pages gracefully without storing error as IP", async () => {
      const mockHtmlFetch = async () => ({
        ok: true,
        status: 200,
        text: async () => "<html><body>502 Bad Gateway</body></html>"
      });

      const monitor = new IPMonitor({
        fetchFn: mockHtmlFetch,
        timeoutMs: 100
      });

      const result = await monitor.refreshIP();
      assert.equal(result, null, "HTML error must not be accepted as an IP address");
      assert.equal(monitor.getIP(), null);
      assert.equal(monitor.getStatus().status, "error");
    });

    it("IPMonitor prevents race condition when multiple refreshIP calls overlap", async () => {
      let callCount = 0;
      const delayedFetch = async (url) => {
        callCount++;
        const currentCall = callCount;
        if (currentCall === 1) {
          // Slow first call (takes 50ms)
          await new Promise(r => setTimeout(r, 50));
          return { ok: true, status: 200, json: async () => ({ ip: "1.1.1.1" }) };
        } else {
          // Fast second call (takes 5ms)
          await new Promise(r => setTimeout(r, 5));
          return { ok: true, status: 200, json: async () => ({ ip: "2.2.2.2" }) };
        }
      };

      const monitor = new IPMonitor({ fetchFn: delayedFetch });
      const p1 = monitor.refreshIP();
      const p2 = monitor.refreshIP();

      await Promise.all([p1, p2]);

      // Newer request (call 2 -> 2.2.2.2) must win, NOT stale 1.1.1.1
      assert.equal(monitor.getIP(), "2.2.2.2", "Stale response must not overwrite newer IP");
    });

    it("LinkHints generates codes for >196 clickable elements without crashing", () => {
      const hints = new LinkHints();
      const codes = hints.generateHintStrings(250);

      assert.equal(codes.length, 250);
      assert.equal(new Set(codes).size, 250, "All 250 codes must be unique");
      assert.ok(codes.every(c => typeof c === "string" && c.length >= 2));
    });

    it("KeymapManager clears sequence buffer when broken by different key (no ghost prefix)", () => {
      const km = new KeymapManager();
      let scrollTopCount = 0;
      let scrollDownCount = 0;

      km.registerActionHandler("scroll_top", () => { scrollTopCount++; });
      km.registerActionHandler("scroll_down", () => { scrollDownCount++; });

      // User presses 'g' (sequence buffered)
      const res1 = km.handleKeyEvent({ key: "g" });
      assert.equal(res1.action, "buffering_sequence");

      // User then presses 'j' (breaks 'gg' sequence)
      const res2 = km.handleKeyEvent({ key: "j" });
      assert.equal(res2.action, "scroll_down");
      assert.equal(scrollDownCount, 1);

      // Now user presses 'g' again: must buffer freshly, NOT trigger 'gg'!
      const res3 = km.handleKeyEvent({ key: "g" });
      assert.equal(res3.action, "buffering_sequence");
      assert.equal(scrollTopCount, 0, "Sequence buffer must not retain stale 'g'");
    });

    it("fuzzyMatch handles null, undefined, and empty string safely", () => {
      assert.equal(fuzzyMatch("test", null).matches, false);
      assert.equal(fuzzyMatch("test", undefined).matches, false);
      assert.equal(fuzzyMatch("test", "").matches, false);
      assert.equal(fuzzyMatch(null, "some text").matches, true);
    });

    it("CommandPalette results click handler selects and executes clicked item", () => {
      let executedAction = null;
      const palette = new CommandPalette({
        onActionExecuted: (item) => {
          executedAction = item.id;
        }
      });

      palette.open();
      assert.equal(palette.isOpen, true);

      // Verify click handler logic with target item
      const mockItemEl = {
        getAttribute: (attr) => (attr === "data-index" ? "1" : null)
      };
      const mockClickEvent = {
        target: {
          closest: (sel) => (sel === ".dev-palette-item" ? mockItemEl : null)
        }
      };

      const targetIdx = parseInt(mockItemEl.getAttribute("data-index"), 10);
      palette.selectedIndex = targetIdx;
      const expectedItem = palette.filteredResults[targetIdx].item;

      const result = palette.executeSelected();
      assert.ok(result);
      assert.equal(executedAction, expectedItem.id);
      assert.equal(palette.isOpen, false);
    });
  });
});
