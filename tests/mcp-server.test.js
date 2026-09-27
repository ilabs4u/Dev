const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  createMcpServer,
  McpProtocolHandler,
  PermissionManager,
  BrowserContext,
  StdioTransport,
  WebSocketTransport,
  listTools,
  listResources,
  PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION
} = require("../src/dev/mcp-server");

describe("Phase 2A: MCP Server Core & Tools", () => {
  let context;
  let permissions;
  let handler;

  beforeEach(() => {
    context = new BrowserContext({
      initialUrl: "https://example.com"
    });
    context.setTabContent(`
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Welcome</h1>
          <a href="https://example.com/about">About Us</a>
          <button id="submit-btn">Submit</button>
          <input type="text" id="username" name="username" placeholder="Username" value="" />
          <textarea id="bio" name="bio">Initial bio</textarea>
        </body>
      </html>
    `, 1, "Test Page");

    permissions = new PermissionManager({
      permissions: {
        allow_navigation: true,
        allow_click: true,
        allow_form_fill: true,
        allow_evaluate_js: true,
        confirm_before: []
      }
    });

    handler = new McpProtocolHandler({ context, permissions });
  });

  // ==========================================
  // 1. JSON-RPC Protocol Core
  // ==========================================
  describe("Protocol Core (JSON-RPC 2.0)", () => {
    it("handles initialize handshake and returns capabilities and server info", async () => {
      const req = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      };

      const res = await handler.handleMessage(req);
      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, 1);
      assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
      assert.equal(res.result.serverInfo.name, SERVER_NAME);
      assert.equal(res.result.serverInfo.version, SERVER_VERSION);
      assert.ok(res.result.capabilities.tools);
      assert.ok(res.result.capabilities.resources);
    });

    it("processes notifications/initialized without sending response", async () => {
      const notify = {
        jsonrpc: "2.0",
        method: "notifications/initialized"
      };
      const res = await handler.handleMessage(notify);
      assert.equal(res, null, "Notifications must not produce a response");
      assert.equal(handler.initialized, true);
    });

    it("responds to ping with empty result", async () => {
      const ping = {
        jsonrpc: "2.0",
        id: "ping-123",
        method: "ping"
      };
      const res = await handler.handleMessage(ping);
      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, "ping-123");
      assert.deepEqual(res.result, {});
    });

    it("returns Parse error (-32700) for malformed JSON string", async () => {
      const res = await handler.handleMessage("{malformed json");
      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, null);
      assert.equal(res.error.code, -32700);
      assert.ok(res.error.message.includes("Parse error"));
    });

    it("returns Invalid Request (-32600) for non-2.0 jsonrpc or invalid structure", async () => {
      const res1 = await handler.handleMessage({ jsonrpc: "1.0", id: 2, method: "ping" });
      assert.equal(res1.error.code, -32600);

      const res2 = await handler.handleMessage({ jsonrpc: "2.0", id: 3 }); // missing method
      assert.equal(res2.error.code, -32600);
    });

    it("returns Method not found (-32601) for unknown methods", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 4,
        method: "unknown_future_method"
      });
      assert.equal(res.error.code, -32601);
    });
  });

  // ==========================================
  // 2. Tools Registry (All 19 Tools)
  // ==========================================
  describe("Tools Registry", () => {
    const EXPECTED_TOOLS = [
      "navigate_to",
      "go_back",
      "go_forward",
      "reload",
      "get_current_url",
      "list_tabs",
      "new_tab",
      "close_tab",
      "switch_tab",
      "get_interactive_elements",
      "click",
      "fill",
      "get_page_content",
      "screenshot",
      "evaluate_js",
      "get_console_logs",
      "get_css",
      "get_performance",
      "get_accessibility_tree"
    ];

    it("tools/list returns exactly 19 tools with descriptions and schemas", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/list"
      });

      assert.ok(res.result.tools);
      assert.equal(res.result.tools.length, 19, "Must implement all 19 tools documented in docs/mcp-api.md");

      const names = res.result.tools.map(t => t.name);
      for (const expected of EXPECTED_TOOLS) {
        assert.ok(names.includes(expected), `Tool '${expected}' must be present in tools/list`);
      }

      for (const tool of res.result.tools) {
        assert.ok(tool.description && tool.description.length > 5, `Tool '${tool.name}' must have description`);
        assert.ok(tool.inputSchema && tool.inputSchema.type === "object", `Tool '${tool.name}' must have valid inputSchema`);
      }
    });
  });

  // ==========================================
  // 3. Navigation Tools
  // ==========================================
  describe("Navigation Tools (5 tools)", () => {
    it("navigate_to updates active tab URL", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: {
          name: "navigate_to",
          arguments: { url: "https://news.ycombinator.com" }
        }
      });

      assert.equal(res.result.isError, false);
      assert.ok(res.result.content[0].text.includes("https://news.ycombinator.com"));

      const activeTab = context.getActiveTab();
      assert.equal(activeTab.url, "https://news.ycombinator.com");
    });

    it("navigate_to reports isError: true when url argument is missing", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 21,
        method: "tools/call",
        params: {
          name: "navigate_to",
          arguments: {}
        }
      });
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("Missing required argument 'url'"));
    });

    it("go_back and go_forward navigate browser history", async () => {
      await context.navigateTo("https://first.com");
      await context.navigateTo("https://second.com");

      // Back
      const backRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 22,
        method: "tools/call",
        params: { name: "go_back", arguments: {} }
      });
      assert.equal(backRes.result.isError, false);
      assert.equal(context.getActiveTab().url, "https://first.com");

      // Forward
      const fwdRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 23,
        method: "tools/call",
        params: { name: "go_forward", arguments: {} }
      });
      assert.equal(fwdRes.result.isError, false);
      assert.equal(context.getActiveTab().url, "https://second.com");
    });

    it("reload reloads current page", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 24,
        method: "tools/call",
        params: { name: "reload", arguments: { bypassCache: true } }
      });
      assert.equal(res.result.isError, false);
      assert.ok(res.result.content[0].text.includes("Reloaded"));
    });

    it("get_current_url returns active tab details", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 25,
        method: "tools/call",
        params: { name: "get_current_url", arguments: {} }
      });
      assert.equal(res.result.isError, false);
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.url, "https://example.com");
      assert.equal(parsed.title, "Test Page");
    });
  });

  // ==========================================
  // 4. Tab Management Tools
  // ==========================================
  describe("Tab Management Tools (4 tools)", () => {
    it("list_tabs returns open tabs", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 30,
        method: "tools/call",
        params: { name: "list_tabs", arguments: {} }
      });
      assert.equal(res.result.isError, false);
      const tabs = JSON.parse(res.result.content[0].text);
      assert.equal(tabs.length, 1);
      assert.equal(tabs[0].url, "https://example.com");
    });

    it("new_tab opens a new tab and sets it active", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 31,
        method: "tools/call",
        params: {
          name: "new_tab",
          arguments: { url: "https://github.com", active: true }
        }
      });
      assert.equal(res.result.isError, false);
      assert.equal(context.tabs.length, 2);
      assert.equal(context.getActiveTab().url, "https://github.com");
    });

    it("switch_tab changes active tab", async () => {
      await context.newTab({ url: "https://tab2.com" });
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 32,
        method: "tools/call",
        params: { name: "switch_tab", arguments: { tabId: 1 } }
      });
      assert.equal(res.result.isError, false);
      assert.equal(context.getActiveTab().id, 1);
    });

    it("close_tab removes tab", async () => {
      const tab2 = await context.newTab({ url: "https://tab2.com" });
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 33,
        method: "tools/call",
        params: { name: "close_tab", arguments: { tabId: tab2.id } }
      });
      assert.equal(res.result.isError, false);
      assert.equal(context.tabs.length, 1);
    });
  });

  // ==========================================
  // 5. Page Interaction & Agent Tree
  // ==========================================
  describe("Page Interaction Tools (3 tools)", () => {
    it("get_interactive_elements labels interactive DOM elements for Agent Tree", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 40,
        method: "tools/call",
        params: { name: "get_interactive_elements", arguments: {} }
      });
      assert.equal(res.result.isError, false);
      const text = res.result.content[0].text;
      assert.ok(text.includes("[A]"));
      assert.ok(text.includes("[B]"));
      assert.ok(text.includes("submit-btn"));
    });

    it("click triggers click by selector or Agent Tree label", async () => {
      // By selector
      const clickSel = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 41,
        method: "tools/call",
        params: { name: "click", arguments: { selector: "#submit-btn" } }
      });
      assert.equal(clickSel.result.isError, false);
      assert.ok(clickSel.result.content[0].text.includes("Clicked"));

      // By label
      const clickLabel = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 42,
        method: "tools/call",
        params: { name: "click", arguments: { label: "A" } }
      });
      assert.equal(clickLabel.result.isError, false);
    });

    it("fill updates field value by selector or label", async () => {
      const fillRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 43,
        method: "tools/call",
        params: {
          name: "fill",
          arguments: { selector: "#username", text: "agent_smith" }
        }
      });
      assert.equal(fillRes.result.isError, false);
      assert.ok(fillRes.result.content[0].text.includes("agent_smith"));

      const elements = await context.getInteractiveElements();
      const userEl = elements.find(e => e.id === "username");
      assert.equal(userEl.value, "agent_smith");
    });
  });

  // ==========================================
  // 6. Page Content Tools
  // ==========================================
  describe("Page Content Tools (4 tools)", () => {
    it("get_page_content returns text and markdown formats", async () => {
      const textRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 50,
        method: "tools/call",
        params: { name: "get_page_content", arguments: { format: "text" } }
      });
      assert.equal(textRes.result.isError, false);
      assert.ok(textRes.result.content[0].text.includes("Welcome"));
      assert.ok(!textRes.result.content[0].text.includes("<h1>"));

      const mdRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 51,
        method: "tools/call",
        params: { name: "get_page_content", arguments: { format: "markdown" } }
      });
      assert.equal(mdRes.result.isError, false);
      assert.ok(mdRes.result.content[0].text.includes("# Welcome"));
    });

    it("screenshot captures viewport as base64 image", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 52,
        method: "tools/call",
        params: { name: "screenshot", arguments: { format: "png" } }
      });
      assert.equal(res.result.isError, false);
      assert.equal(res.result.content[0].type, "image");
      assert.equal(res.result.content[0].mimeType, "image/png");
      assert.ok(res.result.content[0].data.length > 20);
    });

    it("evaluate_js executes javascript in page context", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 53,
        method: "tools/call",
        params: { name: "evaluate_js", arguments: { script: "1 + 2 * 3" } }
      });
      assert.equal(res.result.isError, false);
      assert.equal(res.result.content[0].text, "7");
    });

    it("get_console_logs retrieves logged messages", async () => {
      context.addConsoleLog({ level: "info", message: "Application initialized" });
      context.addConsoleLog({ level: "warn", message: "Deprecated API called" });

      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 54,
        method: "tools/call",
        params: { name: "get_console_logs", arguments: { limit: 10 } }
      });
      assert.equal(res.result.isError, false);
      assert.ok(res.result.content[0].text.includes("Application initialized"));
      assert.ok(res.result.content[0].text.includes("Deprecated API called"));
    });
  });

  // ==========================================
  // 7. DevTools Tools
  // ==========================================
  describe("DevTools Tools (3 tools)", () => {
    it("get_css queries styles for selector", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 60,
        method: "tools/call",
        params: { name: "get_css", arguments: { selector: "#submit-btn", property: "display" } }
      });
      assert.equal(res.result.isError, false);
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.property, "display");
      assert.equal(parsed.value, "block");
    });

    it("get_performance returns navigation and timing metrics", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 61,
        method: "tools/call",
        params: { name: "get_performance", arguments: {} }
      });
      assert.equal(res.result.isError, false);
      const perf = JSON.parse(res.result.content[0].text);
      assert.ok(perf.timing);
      assert.ok(perf.timing.domContentLoadedMs > 0);
    });

    it("get_accessibility_tree returns semantic accessible structure", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 62,
        method: "tools/call",
        params: { name: "get_accessibility_tree", arguments: {} }
      });
      assert.equal(res.result.isError, false);
      const tree = JSON.parse(res.result.content[0].text);
      assert.equal(tree.role, "WebArea");
      assert.ok(tree.children.length > 0);
    });
  });

  // ==========================================
  // 8. Permission Manager & Security Model
  // ==========================================
  describe("Permission Manager & Policy Enforcement", () => {
    it("blocks click when allow_click is false", async () => {
      permissions.setPermissions({ allow_click: false });
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 70,
        method: "tools/call",
        params: { name: "click", arguments: { selector: "#submit-btn" } }
      });
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("Permission denied"));
    });

    it("blocks fill when allow_form_fill is false", async () => {
      permissions.setPermissions({ allow_form_fill: false });
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 71,
        method: "tools/call",
        params: { name: "fill", arguments: { selector: "#username", text: "unauthorized" } }
      });
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("Permission denied"));
    });

    it("blocks evaluate_js when allow_evaluate_js is false", async () => {
      permissions.setPermissions({ allow_evaluate_js: false });
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 72,
        method: "tools/call",
        params: { name: "evaluate_js", arguments: { script: "alert(1)" } }
      });
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("Permission denied"));
    });

    it("prompts user dialog handler when action matches confirm_before wildcard", async () => {
      permissions.setPermissions({
        allow_click: true,
        confirm_before: ["delete_*", "#dangerous-btn"]
      });

      let promptReceived = null;
      permissions.setPromptHandler(async (details) => {
        promptReceived = details;
        return false; // User denies
      });

      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 73,
        method: "tools/call",
        params: { name: "click", arguments: { selector: "#dangerous-btn" } }
      });

      assert.ok(promptReceived, "Prompt callback must be invoked");
      assert.equal(promptReceived.tool, "click");
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("rejected by user"));
    });

    it("allows action when user explicitly approves via prompt handler", async () => {
      permissions.setPermissions({
        allow_click: true,
        confirm_before: ["#dangerous-btn"]
      });

      permissions.setPromptHandler(async () => true); // User approves

      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 74,
        method: "tools/call",
        params: { name: "click", arguments: { selector: "#dangerous-btn" } }
      });

      assert.equal(res.result.isError, false);
    });
  });

  // ==========================================
  // 9. Resources Registry & Reading
  // ==========================================
  describe("Resources (3 resources)", () => {
    it("resources/list lists all 3 resources", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 80,
        method: "resources/list"
      });
      assert.equal(res.result.resources.length, 3);
      const uris = res.result.resources.map(r => r.uri);
      assert.ok(uris.includes("mcp://dom/current"));
      assert.ok(uris.includes("mcp://network/failed"));
      assert.ok(uris.includes("mcp://console/errors"));
    });

    it("resources/read returns current DOM for mcp://dom/current", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 81,
        method: "resources/read",
        params: { uri: "mcp://dom/current" }
      });
      assert.equal(res.result.contents[0].uri, "mcp://dom/current");
      assert.equal(res.result.contents[0].mimeType, "text/html");
      assert.ok(res.result.contents[0].text.includes("Test Page"));
    });

    it("resources/read returns failed network requests for mcp://network/failed", async () => {
      context.addFailedRequest({ url: "https://api.broken.com/data", status: 500, error: "Internal Server Error" });

      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 82,
        method: "resources/read",
        params: { uri: "mcp://network/failed" }
      });
      assert.equal(res.result.contents[0].uri, "mcp://network/failed");
      const list = JSON.parse(res.result.contents[0].text);
      assert.equal(list.length, 1);
      assert.equal(list[0].url, "https://api.broken.com/data");
    });

    it("resources/read returns console errors for mcp://console/errors", async () => {
      context.addConsoleLog({ level: "error", message: "Uncaught TypeError: null is not an object" });

      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 83,
        method: "resources/read",
        params: { uri: "mcp://console/errors" }
      });
      assert.equal(res.result.contents[0].uri, "mcp://console/errors");
      const list = JSON.parse(res.result.contents[0].text);
      assert.equal(list.length, 1);
      assert.ok(list[0].message.includes("TypeError"));
    });

    it("resources/read returns error for invalid URI", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 84,
        method: "resources/read",
        params: { uri: "mcp://invalid/resource" }
      });
      assert.equal(res.error.code, -32002);
      assert.ok(res.error.message.includes("Resource not found"));
    });
  });

  // ==========================================
  // 10. Transports (Stdio & WebSocket)
  // ==========================================
  describe("Transports", () => {
    it("StdioTransport reads newline-delimited JSON and writes JSON-RPC response", async () => {
      class MockReadable extends EventEmitter {
        setEncoding() {}
      }
      class MockWritable extends EventEmitter {
        constructor() {
          super();
          this.chunks = [];
        }
        write(chunk) {
          this.chunks.push(chunk);
          this.emit("data", chunk);
        }
      }

      const mockStdin = new MockReadable();
      const mockStdout = new MockWritable();

      const stdio = new StdioTransport({
        handler,
        stdin: mockStdin,
        stdout: mockStdout
      });

      stdio.start();

      const requestJson = JSON.stringify({
        jsonrpc: "2.0",
        id: "stdio-1",
        method: "ping"
      }) + "\n";

      mockStdin.emit("data", requestJson);

      // Allow tick for async handleMessage
      await new Promise(resolve => setTimeout(resolve, 20));

      assert.ok(mockStdout.chunks.length > 0);
      const response = JSON.parse(mockStdout.chunks[0].trim());
      assert.equal(response.id, "stdio-1");
      assert.deepEqual(response.result, {});

      stdio.stop();
    });

    it("WebSocketTransport serves MCP protocol on port 9222 and processes requests", async () => {
      // Use port 0 for dynamic available port in test to prevent port collision
      const wsTransport = new WebSocketTransport({
        handler,
        port: 0
      });

      const port = await wsTransport.start();
      assert.ok(port > 0, `WebSocket server should bind to port > 0, got ${port}`);

      // Connect with Node 24 native WebSocket client
      const wsClient = new globalThis.WebSocket(`ws://127.0.0.1:${port}`);

      await new Promise((resolve, reject) => {
        wsClient.onopen = resolve;
        wsClient.onerror = reject;
      });

      // Send initialize request over WebSocket
      const initPromise = new Promise((resolve) => {
        wsClient.onmessage = (event) => {
          const res = JSON.parse(event.data);
          resolve(res);
        };
      });

      wsClient.send(JSON.stringify({
        jsonrpc: "2.0",
        id: "ws-1",
        method: "initialize",
        params: { protocolVersion: PROTOCOL_VERSION }
      }));

      const initResponse = await initPromise;
      assert.equal(initResponse.id, "ws-1");
      assert.equal(initResponse.result.serverInfo.name, "dev-browser");

      // Send tool call over WebSocket
      const toolPromise = new Promise((resolve) => {
        wsClient.onmessage = (event) => {
          const res = JSON.parse(event.data);
          resolve(res);
        };
      });

      wsClient.send(JSON.stringify({
        jsonrpc: "2.0",
        id: "ws-2",
        method: "tools/call",
        params: {
          name: "navigate_to",
          arguments: { url: "https://websocket-test.org" }
        }
      }));

      const toolResponse = await toolPromise;
      assert.equal(toolResponse.id, "ws-2");
      assert.equal(toolResponse.result.isError, false);
      assert.equal(context.getActiveTab().url, "https://websocket-test.org");

      wsClient.close();
      await wsTransport.stop();
    });
  });

  // ==========================================
  // 11. McpServer Server Lifecycle
  // ==========================================
  describe("McpServer Lifecycle", () => {
    it("creates server, starts and stops WebSocket and Stdio transports cleanly", async () => {
      const server = createMcpServer({
        port: 0
      });

      const boundPort = await server.startWebSocket();
      assert.ok(boundPort > 0);
      assert.equal(server.running, true);

      await server.stop();
      assert.equal(server.running, false);
    });
  });

  // ==========================================
  // 12. Robustness & Edge Cases
  // ==========================================
  describe("Robustness & Protocol Hardening", () => {
    it("handles tools/call with arguments: null without crashing", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 90,
        method: "tools/call",
        params: { name: "navigate_to", arguments: null }
      });
      assert.equal(res.id, 90);
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("Missing required argument 'url'"));
    });

    it("supports requests with id: null according to JSON-RPC 2.0", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: null,
        method: "ping"
      });
      assert.equal(res.id, null);
      assert.equal(res.jsonrpc, "2.0");
      assert.deepEqual(res.result, {});
    });

    it("StdioTransport handles Content-Length framing without trailing newline", async () => {
      class MockReadable extends EventEmitter {
        setEncoding() {}
      }
      class MockWritable extends EventEmitter {
        constructor() {
          super();
          this.chunks = [];
        }
        write(chunk) {
          this.chunks.push(chunk);
        }
      }

      const mockStdin = new MockReadable();
      const mockStdout = new MockWritable();

      const stdio = new StdioTransport({
        handler,
        stdin: mockStdin,
        stdout: mockStdout
      });
      stdio.start();

      const pingBody = JSON.stringify({ jsonrpc: "2.0", id: "cl-1", method: "ping" });
      const rawPayload = `Content-Length: ${Buffer.byteLength(pingBody)}\r\n\r\n${pingBody}`;

      mockStdin.emit("data", rawPayload);
      await new Promise(resolve => setTimeout(resolve, 20));

      assert.ok(mockStdout.chunks.length > 0, "Response must be sent even without trailing newline");
      const res = JSON.parse(mockStdout.chunks[0].trim());
      assert.equal(res.id, "cl-1");

      stdio.stop();
    });

    it("StdioTransport handles pretty-printed multiline JSON messages", async () => {
      class MockReadable extends EventEmitter {
        setEncoding() {}
      }
      class MockWritable extends EventEmitter {
        constructor() {
          super();
          this.chunks = [];
        }
        write(chunk) {
          this.chunks.push(chunk);
        }
      }

      const mockStdin = new MockReadable();
      const mockStdout = new MockWritable();

      const stdio = new StdioTransport({
        handler,
        stdin: mockStdin,
        stdout: mockStdout
      });
      stdio.start();

      const multiline = JSON.stringify({
        jsonrpc: "2.0",
        id: "multi-1",
        method: "ping"
      }, null, 2) + "\n";

      mockStdin.emit("data", multiline);
      await new Promise(resolve => setTimeout(resolve, 20));

      assert.equal(mockStdout.chunks.length, 1);
      const res = JSON.parse(mockStdout.chunks[0].trim());
      assert.equal(res.id, "multi-1");

      stdio.stop();
    });

    it("StdioTransport flushes and executes pending message on stdin end event", async () => {
      class MockReadable extends EventEmitter {
        setEncoding() {}
      }
      class MockWritable extends EventEmitter {
        constructor() {
          super();
          this.chunks = [];
        }
        write(chunk) {
          this.chunks.push(chunk);
        }
      }

      const mockStdin = new MockReadable();
      const mockStdout = new MockWritable();

      const stdio = new StdioTransport({
        handler,
        stdin: mockStdin,
        stdout: mockStdout
      });
      stdio.start();

      mockStdin.emit("data", JSON.stringify({ jsonrpc: "2.0", id: "eof-1", method: "ping" }));
      mockStdin.emit("end");
      await new Promise(resolve => setTimeout(resolve, 20));

      assert.ok(mockStdout.chunks.length > 0);
      const res = JSON.parse(mockStdout.chunks[0].trim());
      assert.equal(res.id, "eof-1");

      stdio.stop();
    });

    it("navigate_to returns isError: true when targeting non-existent tabId", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 91,
        method: "tools/call",
        params: {
          name: "navigate_to",
          arguments: { url: "https://isolated.org", tabId: 99999 }
        }
      });
      assert.equal(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes("Tab not found: 99999"));
    });

    it("get_interactive_elements on empty page returns 0 elements (no bogus submit button)", async () => {
      const emptyTab = await context.newTab({ url: "about:blank" });
      context.setTabContent("<html><body><p>Just plain text</p></body></html>", emptyTab.id);

      const elements = await context.getInteractiveElements(emptyTab.id, true);
      assert.equal(elements.length, 0, "Empty page must not synthesize fake submit buttons");
    });

    it("get_interactive_elements extracts select elements as combobox", async () => {
      const selectTab = await context.newTab({ url: "https://select-test.org" });
      context.setTabContent(`
        <html>
          <body>
            <select id="country-select" name="country">
              <option value="US">USA</option>
              <option value="UK">UK</option>
            </select>
          </body>
        </html>
      `, selectTab.id);

      const elements = await context.getInteractiveElements(selectTab.id, true);
      const selectEl = elements.find(e => e.id === "country-select");
      assert.ok(selectEl, "Should find select element");
      assert.equal(selectEl.tag, "select");
      assert.equal(selectEl.role, "combobox");
    });

    it("click and fill return isError: true when given non-existent Agent Tree label", async () => {
      const clickRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 92,
        method: "tools/call",
        params: { name: "click", arguments: { label: "NONEXISTENT" } }
      });
      assert.equal(clickRes.result.isError, true);
      assert.ok(clickRes.result.content[0].text.includes("Element not found with Agent Tree label"));

      const fillRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 93,
        method: "tools/call",
        params: { name: "fill", arguments: { label: "NONEXISTENT", text: "val" } }
      });
      assert.equal(fillRes.result.isError, true);
      assert.ok(fillRes.result.content[0].text.includes("Element not found with Agent Tree label"));
    });

    it("close_tab automatically regenerates a blank tab when closing the only remaining tab", async () => {
      const tabs = await context.listTabs();
      for (const t of tabs) {
        await context.closeTab(t.id);
      }
      assert.equal(context.tabs.length, 1, "Context should always have at least 1 tab");
      assert.equal(context.getActiveTab().url, "about:blank");
    });

    it("PermissionManager handles glob patterns containing '?' without crashing regex", () => {
      const pm = new PermissionManager({
        permissions: {
          confirm_before: ["?test", "delete_?"]
        }
      });
      // Should not throw SyntaxError
      assert.equal(pm.isConfirmRequired("xtest"), true);
      assert.equal(pm.isConfirmRequired("delete_1"), true);
      assert.equal(pm.isConfirmRequired("delete_12"), false);
      assert.equal(pm.isConfirmRequired("safe_action"), false);
    });

    it("PermissionManager matches confirm_before against url, text, and script", () => {
      const pm = new PermissionManager({
        permissions: {
          confirm_before: ["*payment*", "*drop_table*"]
        }
      });
      assert.equal(pm.isConfirmRequired("navigate_to", { url: "https://shop.com/payment/checkout" }), true);
      assert.equal(pm.isConfirmRequired("fill", { text: "drop_table" }), true);
      assert.equal(pm.isConfirmRequired("evaluate_js", { script: "window.drop_table()" }), true);
    });

    it("evaluate_js sandbox isolates process and enforces timeout on infinite loop", async () => {
      // Isolation test: process should not be accessible
      const isoRes = await context.evaluateJs("typeof process");
      assert.equal(isoRes.result, "undefined", "process must not be accessible in evaluate_js sandbox");

      // Timeout test: infinite loop should terminate within timeout
      await assert.rejects(
        async () => {
          await context.evaluateJs("while(true){}");
        },
        /JavaScript evaluation error/
      );
    });

    it("WebSocketTransport reassembles fragmented WebSocket frames", async () => {
      const wsTransport = new WebSocketTransport({
        handler,
        port: 0
      });
      const port = await wsTransport.start();

      const net = require("node:net");
      const client = net.createConnection({ port, host: "127.0.0.1" });

      await new Promise(resolve => client.once("connect", resolve));

      // Handshake
      client.write([
        "GET / HTTP/1.1",
        "Host: 127.0.0.1",
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Version: 13",
        "\r\n"
      ].join("\r\n"));

      // Wait for handshake response
      await new Promise((resolve) => {
        client.once("data", resolve);
      });

      const fullMsg = JSON.stringify({ jsonrpc: "2.0", id: "frag-1", method: "ping" });
      const part1 = Buffer.from(fullMsg.slice(0, 10));
      const part2 = Buffer.from(fullMsg.slice(10));

      // Frame 1: FIN=0 (0x01), masked
      const maskKey = Buffer.from([1, 2, 3, 4]);
      const maskedPart1 = Buffer.alloc(part1.length);
      for (let i = 0; i < part1.length; i++) maskedPart1[i] = part1[i] ^ maskKey[i % 4];
      const frame1Header = Buffer.from([0x01, 0x80 | part1.length]);
      client.write(Buffer.concat([frame1Header, maskKey, maskedPart1]));

      // Frame 2: FIN=1 (0x80), opcode=0x00 (continuation), masked
      const maskedPart2 = Buffer.alloc(part2.length);
      for (let i = 0; i < part2.length; i++) maskedPart2[i] = part2[i] ^ maskKey[i % 4];
      const frame2Header = Buffer.from([0x80, 0x80 | part2.length]);

      const responsePromise = new Promise((resolve) => {
        client.on("data", (data) => {
          // Unmask response payload from server (server frames are not masked)
          const payloadLen = data[1] & 0x7f;
          const payload = data.slice(2, 2 + payloadLen);
          resolve(JSON.parse(payload.toString("utf8")));
        });
      });

      client.write(Buffer.concat([frame2Header, maskKey, maskedPart2]));

      const res = await responsePromise;
      assert.equal(res.id, "frag-1");
      assert.deepEqual(res.result, {});

      client.destroy();
      await wsTransport.stop();
    });
  });
});

