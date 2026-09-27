/**
 * Dev Browser - MCP Server
 * Central entry point for Model Context Protocol server.
 */

const { McpProtocolHandler, PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION } = require("./protocol");
const { BrowserContext } = require("./browser-context");
const { PermissionManager } = require("./permission-manager");
const { StdioTransport } = require("./transports/stdio");
const { WebSocketTransport } = require("./transports/websocket");
const { allTools, listTools, getTool } = require("./tools");
const { allResources, listResources, getResource } = require("./resources");

class McpServer {
  /**
   * @param {Object} [options]
   * @param {BrowserContext} [options.context]
   * @param {PermissionManager} [options.permissions]
   * @param {number} [options.port] - Default 9222
   */
  constructor(options = {}) {
    this.context = options.context || new BrowserContext(options);
    this.permissions = options.permissions || new PermissionManager(options);
    this.handler = new McpProtocolHandler({
      context: this.context,
      permissions: this.permissions
    });

    this.port = options.port || 9222;
    this.wsTransport = null;
    this.stdioTransport = null;
    this.running = false;
  }

  /**
   * Start WebSocket server.
   * @param {number} [port]
   * @returns {Promise<number>}
   */
  async startWebSocket(port = null) {
    if (port) this.port = port;
    if (!this.wsTransport) {
      this.wsTransport = new WebSocketTransport({
        handler: this.handler,
        port: this.port
      });
    }
    const boundPort = await this.wsTransport.start();
    this.port = boundPort;
    this.running = true;
    return boundPort;
  }

  /**
   * Stop WebSocket server.
   */
  async stopWebSocket() {
    if (this.wsTransport) {
      await this.wsTransport.stop();
      this.wsTransport = null;
    }
    this.running = false;
  }

  /**
   * Start Stdio transport.
   * @param {Object} [io]
   */
  startStdio(io = {}) {
    if (!this.stdioTransport) {
      this.stdioTransport = new StdioTransport({
        handler: this.handler,
        stdin: io.stdin || process.stdin,
        stdout: io.stdout || process.stdout
      });
    }
    this.stdioTransport.start();
  }

  /**
   * Stop Stdio transport.
   */
  stopStdio() {
    if (this.stdioTransport) {
      this.stdioTransport.stop();
      this.stdioTransport = null;
    }
  }

  /**
   * Stop all transports.
   */
  async stop() {
    await this.stopWebSocket();
    this.stopStdio();
  }
}

/**
 * Factory to create an MCP server instance.
 * @param {Object} [options]
 * @returns {McpServer}
 */
function createMcpServer(options = {}) {
  return new McpServer(options);
}

module.exports = {
  McpServer,
  createMcpServer,
  McpProtocolHandler,
  PermissionManager,
  BrowserContext,
  StdioTransport,
  WebSocketTransport,
  PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
  allTools,
  listTools,
  getTool,
  allResources,
  listResources,
  getResource
};
