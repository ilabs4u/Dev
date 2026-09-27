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

      // Handle newline-delimited JSON
      let newlineIndex;
      while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);

        if (!line) continue;

        // Strip optional Content-Length headers if present
        if (line.toLowerCase().startsWith("content-length:")) {
          continue;
        }

        try {
          const response = await this.handler.handleMessage(line);
          if (response) {
            this.send(response);
          }
        } catch (err) {
          this.send(this.handler.formatError(null, -32603, err.message));
        }
      }
    };

    this.stdin.on("data", this.onDataHandler);
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
