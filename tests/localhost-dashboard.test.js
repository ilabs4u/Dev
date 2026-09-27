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

  it("avoids false positives on common words (invite, reactive, revenue, rails)", () => {
    // Port 7000 is not in PORT_HEURISTICS
    const textInfo = {
      port: 7000,
      headers: {},
      body: "<html><body>Please invite your team to review reactive code near the revenue office with hand rails.</body></html>"
    };
    const res = detectService(textInfo);
    assert.notEqual(res.framework, "Vite Dev Server", "Should not match 'invite' as Vite");
    assert.notEqual(res.framework, "React App", "Should not match 'reactive' as React");
    assert.notEqual(res.framework, "Vue App", "Should not match 'revenue' as Vue");
    assert.notEqual(res.framework, "Ruby on Rails", "Should not match 'rails' as Ruby on Rails");
    assert.equal(res.framework, "HTTP Service");
  });

  it("requires specific markers for React App rather than generic react substring", () => {
    const genericReact = {
      port: 7001,
      headers: {},
      body: "<html><body>Welcome to the Chemical Reaction Portal</body></html>"
    };
    const res = detectService(genericReact);
    assert.notEqual(res.framework, "React App");
    assert.equal(res.framework, "HTTP Service");

    const realReact = {
      port: 7001,
      headers: {},
      body: "<html><body><div id='root' data-reactroot=''>Hello</div></body></html>"
    };
    const realRes = detectService(realReact);
    assert.equal(realRes.framework, "React App");
  });

  it("escapes special HTML characters in shared utils", () => {
    const { escapeHtml } = require("../src/dev/shared/utils");
    assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(escapeHtml("Hello 'world' & \"friends\""), "Hello &#39;world&#39; &amp; &quot;friends&quot;");
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
  });
});
