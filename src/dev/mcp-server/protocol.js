/**
 * Dev Browser - MCP Protocol Core
 * JSON-RPC 2.0 protocol handler for Model Context Protocol (MCP).
 */

const { listTools, getTool } = require("./tools");
const { listResources, getResource } = require("./resources");
const { BrowserContext } = require("./browser-context");
const { PermissionManager } = require("./permission-manager");

// MCP Specification protocol version
const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "dev-browser";
const SERVER_VERSION = "0.2.0";

class McpProtocolHandler {
  /**
   * @param {Object} [options]
   * @param {BrowserContext} [options.context]
   * @param {PermissionManager} [options.permissions]
   */
  constructor(options = {}) {
    this.context = options.context || new BrowserContext();
    this.permissions = options.permissions || new PermissionManager();
    this.initialized = false;
    this.clientInfo = null;
  }

  /**
   * Handle incoming raw string or parsed JSON-RPC message.
   * @param {string|Object} rawMessage
   * @returns {Promise<Object|null>} JSON-RPC response object, or null if notification
   */
  async handleMessage(rawMessage) {
    let message;
    if (typeof rawMessage === "string") {
      try {
        message = JSON.parse(rawMessage);
      } catch (err) {
        return this.formatError(null, -32700, `Parse error: ${err.message}`);
      }
    } else {
      message = rawMessage;
    }

    if (!message || typeof message !== "object") {
      return this.formatError(null, -32600, "Invalid Request: message must be an object");
    }

    // Check JSON-RPC version
    if (message.jsonrpc !== "2.0") {
      return this.formatError(message.id, -32600, "Invalid Request: jsonrpc must be '2.0'");
    }

    const { id, method, params } = message;

    // Handle notifications (missing id or notifications/ prefix)
    const isNotification = id === undefined || (typeof method === "string" && method.startsWith("notifications/"));

    if (!method || typeof method !== "string") {
      if (isNotification) return null;
      return this.formatError(id, -32600, "Invalid Request: method is required and must be a string");
    }

    try {
      const result = await this.routeMethod(method, params || {});

      // Notifications do not return responses
      if (isNotification) {
        return null;
      }

      return {
        jsonrpc: "2.0",
        id,
        result
      };
    } catch (err) {
      if (isNotification) return null;

      if (err.jsonRpcCode) {
        return this.formatError(id, err.jsonRpcCode, err.message, err.data);
      }

      return this.formatError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  /**
   * Routes JSON-RPC method to appropriate handler.
   * @param {string} method
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async routeMethod(method, params) {
    switch (method) {
      case "initialize":
        return this.handleInitialize(params);

      case "notifications/initialized":
        this.initialized = true;
        return {};

      case "ping":
        return {};

      case "tools/list":
        return {
          tools: listTools()
        };

      case "tools/call":
        return this.handleToolCall(params);

      case "resources/list":
        return {
          resources: listResources()
        };

      case "resources/read":
        return this.handleResourceRead(params);

      default: {
        const error = new Error(`Method not found: ${method}`);
        error.jsonRpcCode = -32601;
        throw error;
      }
    }
  }

  handleInitialize(params) {
    this.clientInfo = params.clientInfo || null;
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION
      }
    };
  }

  async handleToolCall(params) {
    const { name, arguments: rawArgs } = params || {};
    const args = (rawArgs && typeof rawArgs === "object") ? rawArgs : {};

    if (!name) {
      const err = new Error("Missing tool name in tools/call");
      err.jsonRpcCode = -32602;
      throw err;
    }

    const tool = getTool(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool not found: ${name}` }],
        isError: true
      };
    }

    // Validate required arguments if schema defines them
    if (tool.inputSchema && Array.isArray(tool.inputSchema.required)) {
      for (const req of tool.inputSchema.required) {
        if (args[req] === undefined || args[req] === null) {
          return {
            content: [{ type: "text", text: `Missing required argument '${req}' for tool '${name}'` }],
            isError: true
          };
        }
      }
    }

    try {
      const result = await tool.handler(args, this.context, this.permissions);
      const res = {
        content: result.content || [{ type: "text", text: JSON.stringify(result.data || "success") }],
        isError: result.isError !== undefined ? !!result.isError : false
      };
      if (result.data !== undefined) {
        res.data = result.data;
      }
      return res;
    } catch (err) {
      return {
        content: [{ type: "text", text: err.message }],
        isError: true
      };
    }
  }

  async handleResourceRead(params) {
    const { uri } = params;
    if (!uri) {
      const err = new Error("Missing uri in resources/read");
      err.jsonRpcCode = -32602;
      throw err;
    }

    const resource = getResource(uri);
    if (!resource) {
      const err = new Error(`Resource not found: ${uri}`);
      err.jsonRpcCode = -32002;
      throw err;
    }

    const content = await resource.read(this.context);
    return {
      contents: [content]
    };
  }

  formatError(id, code, message, data = null) {
    const errObj = {
      jsonrpc: "2.0",
      id: id === undefined ? null : id,
      error: {
        code,
        message
      }
    };
    if (data !== null) {
      errObj.error.data = data;
    }
    return errObj;
  }
}

module.exports = {
  McpProtocolHandler,
  PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION
};
