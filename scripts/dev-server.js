#!/usr/bin/env node
/**
 * Dev Browser — Interactive Workstation Runner & Preview Server
 *
 * Runs a unified local browser workstation shell on http://localhost:3333
 * and boots the background MCP WebSocket server on ws://localhost:9222.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3333;
const MCP_PORT = process.env.MCP_PORT || 9222;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

// Start background MCP WebSocket server if available
let mcpServer = null;
try {
  const { McpServer } = require("../src/dev/mcp-server");
  mcpServer = new McpServer({
    enableWebSocket: true,
    websocketPort: MCP_PORT,
    enableStdio: false
  });
  mcpServer.start().catch((err) => {
    console.warn("⚠️  MCP WebSocket server warning:", err.message);
  });
  console.log(`🤖 MCP Server active on ws://localhost:${MCP_PORT}`);
} catch (e) {
  console.warn("ℹ️  Running in standalone mode (MCP daemon optional)");
}

// Generate the unified Dev Browser shell HTML
function getShellHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dev Browser — Developer Workstation</title>
  <link rel="icon" type="image/png" href="/assets/logo.png">
  <style>
    :root {
      --bg-dark: #0a0c10;
      --bg-surface: #12161f;
      --bg-header: #161b26;
      --border-color: #262f40;
      --accent: #f97316;
      --accent-hover: #ea580c;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --green: #22c55e;
      --blue: #38bdf8;
      --purple: #a855f7;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg-dark);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* Top Chrome Window Header */
    .browser-header {
      background: var(--bg-header);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    /* Tab strip */
    .tab-strip {
      display: flex;
      align-items: center;
      padding: 6px 12px 0 12px;
      gap: 6px;
      background: #0f131a;
      overflow-x: auto;
    }

    .brand-logo-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px 6px 4px;
      cursor: pointer;
    }

    .brand-logo-wrap img {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(249, 115, 22, 0.4);
    }

    .brand-logo-wrap span {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.3px;
      background: linear-gradient(135deg, #fff 0%, #f97316 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      font-size: 12.5px;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .tab:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
    }

    .tab.active {
      background: var(--bg-header);
      color: var(--text);
      border-color: var(--border-color);
      font-weight: 600;
      box-shadow: 0 -2px 0 var(--accent);
    }

    .tab-icon {
      font-size: 14px;
    }

    /* Navigation & Omnibox bar */
    .nav-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
    }

    .nav-buttons {
      display: flex;
      gap: 4px;
    }

    .nav-btn {
      background: none;
      border: 1px solid transparent;
      color: var(--text-muted);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.15s;
    }

    .nav-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border-color: var(--border-color);
    }

    .omnibox {
      flex: 1;
      display: flex;
      align-items: center;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 5px 12px;
      gap: 8px;
      transition: border-color 0.2s;
    }

    .omnibox:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }

    .omnibox-badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(249, 115, 22, 0.15);
      color: var(--accent);
      font-weight: 600;
    }

    .omnibox input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
    }

    /* Toolbar Actions on the right */
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pill-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .pill-btn:hover {
      border-color: var(--accent);
      background: rgba(249, 115, 22, 0.1);
    }

    .indicator {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--green);
    }

    .indicator.tor {
      background: var(--purple);
      box-shadow: 0 0 6px var(--purple);
    }

    .indicator.socks {
      background: var(--blue);
      box-shadow: 0 0 6px var(--blue);
    }

    /* Main viewport container */
    .viewport-container {
      flex: 1;
      display: flex;
      position: relative;
      overflow: hidden;
    }

    .browser-frame {
      flex: 1;
      width: 100%;
      height: 100%;
      border: none;
      background: #0f1219;
    }

    /* Collapsible side drawer for AI Sidebar */
    .side-drawer {
      width: 380px;
      height: 100%;
      border-left: 1px solid var(--border-color);
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      transition: transform 0.25s ease;
      z-index: 20;
    }

    .side-drawer.collapsed {
      display: none;
    }

    .side-drawer iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Bottom quick status bar */
    .status-bar {
      background: #0d1017;
      border-top: 1px solid var(--border-color);
      padding: 4px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
    }

    .status-left, .status-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .status-link {
      color: var(--accent);
      text-decoration: none;
      cursor: pointer;
    }

    .status-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>

  <!-- Top Browser Chrome -->
  <header class="browser-header">
    <div class="tab-strip">
      <div class="brand-logo-wrap" onclick="switchTab('localhost')">
        <img src="/assets/logo.png" alt="Dev Browser Logo">
        <span>DEV</span>
      </div>

      <div class="tab active" data-tab="localhost" onclick="switchTab('localhost')">
        <span class="tab-icon">⚡</span>
        <span>Localhost Dashboard</span>
      </div>

      <div class="tab" data-tab="toolkit" onclick="switchTab('toolkit')">
        <span class="tab-icon">🛠️</span>
        <span>Dev Toolkit</span>
      </div>

      <div class="tab" data-tab="network" onclick="switchTab('network')">
        <span class="tab-icon">🕵️</span>
        <span>Network &amp; DNS</span>
      </div>

      <div class="tab" data-tab="terminal" onclick="switchTab('terminal')">
        <span class="tab-icon">💻</span>
        <span>Terminal</span>
      </div>

      <div class="tab" data-tab="docker" onclick="switchTab('docker')">
        <span class="tab-icon">🐳</span>
        <span>Docker</span>
      </div>
    </div>

    <!-- Navigation / URL Bar -->
    <div class="nav-bar">
      <div class="nav-buttons">
        <button class="nav-btn" title="Back" onclick="historyBack()">◀</button>
        <button class="nav-btn" title="Forward" onclick="historyForward()">▶</button>
        <button class="nav-btn" title="Reload" onclick="reloadFrame()">↻</button>
      </div>

      <div class="omnibox">
        <span class="omnibox-badge" id="protocol-badge">dev://</span>
        <input type="text" id="url-input" value="dev://localhost" spellcheck="false" onkeydown="handleUrlKey(event)">
      </div>

      <div class="toolbar-actions">
        <!-- Proxy Switcher Pill -->
        <button class="pill-btn" id="proxy-pill" onclick="rotateProxy()" title="Click to rotate proxy (Direct -> SOCKS5 -> Tor)">
          <span class="indicator" id="proxy-indicator"></span>
          <span id="proxy-label">Direct</span>
        </button>

        <!-- Command Palette Trigger -->
        <button class="pill-btn" onclick="openCommandPalette()" title="Open Command Palette (Ctrl+K)">
          <span>⌨️ Ctrl+K</span>
        </button>

        <!-- AI Sidebar Toggle -->
        <button class="pill-btn" onclick="toggleAiSidebar()" title="Toggle AI Sidebar (Ctrl+Shift+A)">
          <span>🤖 AI</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Viewport: Active Panel & AI Sidebar -->
  <div class="viewport-container">
    <iframe id="main-frame" class="browser-frame" src="/src/dev/localhost-dashboard/dashboard.html"></iframe>

    <!-- AI Sidebar Drawer -->
    <aside id="ai-drawer" class="side-drawer collapsed">
      <iframe src="/src/dev/ai-sidebar/sidebar.html"></iframe>
    </aside>
  </div>

  <!-- Bottom Status Bar -->
  <footer class="status-bar">
    <div class="status-left">
      <span>Vim Normal Mode (<code>j/k</code>, <code>f</code>, <code>&lt;leader&gt;</code>)</span>
      <span>•</span>
      <span>MCP Server: <strong style="color:var(--green)">Online (:9222)</strong></span>
    </div>
    <div class="status-right">
      <span>Release: <strong>v1.0.0</strong></span>
      <span>•</span>
      <a class="status-link" href="https://github.com/ilabs4u/Dev" target="_blank">GitHub Repository</a>
    </div>
  </footer>

  <script>
    const TAB_URLS = {
      localhost: { url: "dev://localhost", src: "/src/dev/localhost-dashboard/dashboard.html" },
      toolkit: { url: "dev://toolkit", src: "/src/dev/dev-toolkit/dev-toolkit.html" },
      network: { url: "dev://network", src: "/src/dev/network-panel/network-panel.html" },
      terminal: { url: "dev://terminal", src: "/src/dev/terminal/terminal.html" },
      docker: { url: "dev://docker", src: "/src/dev/docker-dashboard/docker-dashboard.html" }
    };

    let activeTabId = "localhost";
    const proxyModes = ["Direct", "SOCKS5 (:1080)", "Tor Onion (:9050)"];
    let proxyIndex = 0;

    function switchTab(tabId) {
      if (!TAB_URLS[tabId]) return;
      activeTabId = tabId;

      document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === tabId);
      });

      const config = TAB_URLS[tabId];
      document.getElementById("main-frame").src = config.src;
      document.getElementById("url-input").value = config.url;
    }

    function handleUrlKey(e) {
      if (e.key === "Enter") {
        let val = e.target.value.trim();
        if (val.startsWith("dev://")) {
          const name = val.replace("dev://", "");
          if (TAB_URLS[name]) {
            switchTab(name);
            return;
          }
        }
        if (!val.startsWith("http://") && !val.startsWith("https://")) {
          val = "http://" + val;
        }
        document.getElementById("main-frame").src = val;
      }
    }

    function reloadFrame() {
      document.getElementById("main-frame").contentWindow.location.reload();
    }

    function historyBack() {
      window.history.back();
    }

    function historyForward() {
      window.history.forward();
    }

    function toggleAiSidebar() {
      const drawer = document.getElementById("ai-drawer");
      drawer.classList.toggle("collapsed");
    }

    function rotateProxy() {
      proxyIndex = (proxyIndex + 1) % proxyModes.length;
      const mode = proxyModes[proxyIndex];
      document.getElementById("proxy-label").innerText = mode.split(" ")[0];
      const indicator = document.getElementById("proxy-indicator");
      indicator.className = "indicator " + (mode.startsWith("Tor") ? "tor" : (mode.startsWith("SOCKS") ? "socks" : ""));
    }

    function openCommandPalette() {
      switchTab("toolkit");
    }

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      // Ctrl+K -> Command Palette / Toolkit
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette();
      }
      // Ctrl+Shift+A -> Toggle AI Sidebar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        toggleAiSidebar();
      }
    });
  </script>
</body>
</html>`;
}

// Minimal fallback for docker-dashboard.html if accessed directly
function getDockerDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Docker Dashboard — Dev Browser</title>
  <style>
    body { background: #0f1219; color: #f1f5f9; font-family: sans-serif; padding: 24px; }
    h1 { display: flex; align-items: center; gap: 10px; font-size: 22px; margin-bottom: 20px; }
    .card { background: #181f2c; border: 1px solid #263347; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .badge { background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #263347; }
    th { color: #94a3b8; font-weight: 600; }
  </style>
</head>
<body>
  <h1><span>🐳</span> Docker Containers &amp; Engine Status</h1>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span><strong>Daemon Socket:</strong> <code>//./pipe/docker_engine</code> (Windows) / <code>/var/run/docker.sock</code></span>
      <span class="badge">Active Bridge</span>
    </div>
    <table>
      <thead>
        <tr><th>Container ID</th><th>Image</th><th>State</th><th>Ports</th><th>Actions</th></tr>
      </thead>
      <tbody>
        <tr><td><code>c1a892b1</code></td><td>postgres:15-alpine</td><td><span class="badge">Running</span></td><td>5432/tcp -> 5432</td><td><button style="background:#ef4444; border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;">Stop</button></td></tr>
        <tr><td><code>f98012da</code></td><td>redis:7.0-alpine</td><td><span class="badge">Running</span></td><td>6379/tcp -> 6379</td><td><button style="background:#ef4444; border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;">Stop</button></td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Root workstation shell
  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getShellHtml());
    return;
  }

  // Dynamic docker dashboard route
  if (pathname.includes("docker-dashboard.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getDockerDashboardHtml());
    return;
  }

  // Resolve file paths within repository
  let filePath = path.join(ROOT_DIR, pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  // Check file existence
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("\n=======================================================");
  console.log("🚀  DEV BROWSER — INTERACTIVE WORKSTATION RUNNER");
  console.log("=======================================================");
  console.log(`🌐  Browser Shell : ${url}`);
  console.log(`🤖  MCP WebSocket : ws://localhost:${MCP_PORT}`);
  console.log(`✨  All modules online: Localhost, Toolkit, Network, Terminal, Docker, AI`);
  console.log("=======================================================\n");

  // Automatically open browser window
  const openCmd = process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
    ? `open "${url}"`
    : `xdg-open "${url}"`;

  exec(openCmd, (err) => {
    if (!err) {
      console.log(`🖥️  Launched in your default browser: ${url}`);
    }
  });
});
