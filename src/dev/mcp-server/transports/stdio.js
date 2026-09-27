/**
 * Dev Browser - MCP Stdio Transport
 * Enables integration with Claude Desktop, Cursor, and CLI-based MCP tools.
 */

const { McpProtocolHandler } = require("../protocol");
const { BrowserContext } = require("../browser-context");
const { PermissionManager } = require("../permission-manager");

class StdioTransport {
  /**
   * @param {Object} [options]
   * @param {McpProtocolHandler} [options.handler]
   * @param {NodeJS.ReadableStream} [options.stdin]
   * @param {NodeJS.WritableStream} [options.stdout]
   */
  constructor(options = {}) {
    this.handler = options.handler || new McpProtocolHandler();
    this.stdin = options.stdin || process.stdin;
    this.stdout = options.stdout || process.stdout;
    this.buffer = "";
    this.running = false;
    this.onDataHandler = null;
  }

  start() {
    if (this.running) return;
    this.running = true;

    this.stdin.setEncoding("utf8");

    this.onDataHandler = async (chunk) => {
      this.buffer += chunk;
      await this.processBuffer();
    };

    this.onEndHandler = async () => {
      const remaining = this.buffer.trim();
      this.buffer = "";
      if (remaining) {
        await this.handleSingleMessage(remaining);
      }
    };

    this.stdin.on("data", this.onDataHandler);
    this.stdin.on("end", this.onEndHandler);
  }

  async processBuffer() {
    while (this.buffer.length > 0) {
      const trimmed = this.buffer.trimStart();
      if (!trimmed) {
        this.buffer = "";
        break;
      }

      // Check for Content-Length framing (LSP/MCP standard)
      if (trimmed.toLowerCase().startsWith("content-length:")) {
        const headerEnd = this.buffer.indexOf("\r\n\r\n");
        const headerEndAlt = this.buffer.indexOf("\n\n");
        let bodyStart = -1;
        if (headerEnd !== -1 && (headerEndAlt === -1 || headerEnd < headerEndAlt)) {
          bodyStart = headerEnd + 4;
        } else if (headerEndAlt !== -1) {
          bodyStart = headerEndAlt + 2;
        }

        if (bodyStart === -1) {
          // Incomplete headers, wait for more data
          break;
        }

        const headerStr = this.buffer.slice(0, bodyStart);
        const match = headerStr.match(/content-length:\s*(\d+)/i);
        if (!match) {
          this.buffer = this.buffer.slice(bodyStart);
          continue;
        }

        const contentLen = parseInt(match[1], 10);
        if (this.buffer.length < bodyStart + contentLen) {
          // Incomplete body, wait for more data
          break;
        }

        const body = this.buffer.slice(bodyStart, bodyStart + contentLen);
        this.buffer = this.buffer.slice(bodyStart + contentLen);

        await this.handleSingleMessage(body);
        continue;
      }

      // Newline-delimited JSON (NDJSON) or multiline JSON
      const nlIdx = this.buffer.indexOf("\n");
      if (nlIdx === -1) {
        // Wait for newline or end event
        break;
      }

      const candidate = this.buffer.slice(0, nlIdx).trim();
      if (!candidate) {
        this.buffer = this.buffer.slice(nlIdx + 1);
        continue;
      }

      // Try parsing single line JSON
      try {
        JSON.parse(candidate);
        this.buffer = this.buffer.slice(nlIdx + 1);
        await this.handleSingleMessage(candidate);
      } catch {
        // Line might be part of multiline pretty-printed JSON
        let parsed = false;
        let searchPos = nlIdx + 1;
        while ((searchPos = this.buffer.indexOf("\n", searchPos)) !== -1) {
          const multiCandidate = this.buffer.slice(0, searchPos).trim();
          try {
            JSON.parse(multiCandidate);
            this.buffer = this.buffer.slice(searchPos + 1);
            await this.handleSingleMessage(multiCandidate);
            parsed = true;
            break;
          } catch {
            searchPos++;
          }
        }

        if (!parsed) {
          if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
            // Not a JSON object or array, pass candidate to trigger proper error
            this.buffer = this.buffer.slice(nlIdx + 1);
            await this.handleSingleMessage(candidate);
          } else {
            // Incomplete JSON object, wait for next chunks
            break;
          }
        }
      }
    }
  }

  async handleSingleMessage(raw) {
    if (!raw) return;
    try {
      const response = await this.handler.handleMessage(raw);
      if (response) {
        this.send(response);
      }
    } catch (err) {
      this.send(this.handler.formatError(null, -32603, err.message));
    }
  }

  send(message) {
    if (!this.running) return;
    const jsonStr = typeof message === "string" ? message : JSON.stringify(message);
    try {
      this.stdout.write(jsonStr + "\n");
    } catch {
      // Stream may be closed
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.onDataHandler) {
      this.stdin.removeListener("data", this.onDataHandler);
      this.onDataHandler = null;
    }
    if (this.onEndHandler) {
      this.stdin.removeListener("end", this.onEndHandler);
      this.onEndHandler = null;
    }
  }
}

// Standalone execution entry point for Claude Desktop
if (require.main === module) {
  const context = new BrowserContext();
  const permissions = new PermissionManager();
  const handler = new McpProtocolHandler({ context, permissions });
  const transport = new StdioTransport({ handler });
  transport.start();

  process.on("SIGINT", () => {
    transport.stop();
    process.exit(0);
  });
}

module.exports = {
  StdioTransport
};
