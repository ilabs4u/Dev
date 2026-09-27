const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { detectService, LocalhostScanner, extractTitle } = require("../src/dev/localhost-dashboard");

describe("Task 1.4: Localhost Dashboard & Framework Detection", () => {
  it("detects Python HTTP Server from response headers", () => {
    const info = {
      port: 8000,
      headers: {
        "server": "SimpleHTTP/0.6 Python/3.11.4",
        "content-type": "text/html"
      },
      body: "<html><head><title>Directory listing for /</title></head><body><h1>Directory listing</h1></body></html>"
    };

    const res = detectService(info);
    assert.equal(res.framework, "Python HTTP Server");
    assert.equal(res.category, "Python");
    assert.equal(res.icon, "🐍");
    assert.equal(res.title, "Directory listing for /");
  });

  it("detects Next.js and Vite dev servers", () => {
    const nextInfo = {
      port: 3000,
      headers: { "x-powered-by": "Next.js" },
      body: "<div id='__next'><script id='__NEXT_DATA__'>{}</script></div>"
    };
    const nextRes = detectService(nextInfo);
    assert.equal(nextRes.framework, "Next.js");

    const viteInfo = {
      port: 5173,
      headers: {},
      body: "<html><head><script type='module' src='/@vite/client'></script><title>Vite App</title></head></html>"
    };
    const viteRes = detectService(viteInfo);
    assert.equal(viteRes.framework, "Vite Dev Server");
    assert.equal(viteRes.title, "Vite App");
  });

  it("detects Ollama AI API on port 11434", () => {
    const ollamaInfo = {
      port: 11434,
      headers: {},
      body: "Ollama is running"
    };
    const ollamaRes = detectService(ollamaInfo);
    assert.equal(ollamaRes.framework, "Ollama AI API");
    assert.equal(ollamaRes.category, "AI");
  });

  it("extracts HTML title tag accurately", () => {
    assert.equal(extractTitle("<title>My Super App</title>"), "My Super App");
    assert.equal(extractTitle("<TITLE>  Padded Title  </TITLE>"), "Padded Title");
    assert.equal(extractTitle("<div>No title here</div>"), "");
  });

  it("scanner completes scan of common dev ports in under 2 seconds", async () => {
    // Mock fetch for port scan simulation
    const mockFetch = async (url) => {
      // Simulate active server on port 8000 (Python) and 5173 (Vite)
      if (url.includes(":8000")) {
        return {
          status: 200,
          headers: new Map([
            ["server", "SimpleHTTP/0.6 Python/3.12.0"],
            ["content-type", "text/html"]
          ]),
          text: async () => "<title>Python Server</title><body>Hello</body>"
        };
      }
      if (url.includes(":5173")) {
        return {
          status: 200,
          headers: new Map([["content-type", "text/html"]]),
          text: async () => "<script src='/@vite/client'></script><title>My Vite Project</title>"
        };
      }
      // Other ports are closed / connection refused
      throw new Error("ECONNREFUSED");
    };

    const scanner = new LocalhostScanner({
      fetchFn: mockFetch,
      probeTimeoutMs: 100,
      maxScanTimeMs: 2000
    });

    const result = await scanner.scan();

    assert.ok(result.scanDurationMs < 2000, `Scan must finish in <2000ms, took ${result.scanDurationMs}ms`);
    assert.equal(result.services.length, 2);

    const s8000 = result.services.find(s => s.port === 8000);
    assert.ok(s8000, "Port 8000 service should be found");
    assert.equal(s8000.framework, "Python HTTP Server");
    assert.equal(s8000.title, "Python Server");

    const s5173 = result.services.find(s => s.port === 5173);
    assert.ok(s5173, "Port 5173 service should be found");
    assert.equal(s5173.framework, "Vite Dev Server");
  });
});
