/**
 * Dev Browser - MCP WebSocket Transport
 * Lightweight, zero-dependency RFC 6455 WebSocket server on port 9222.
 */

const http = require("http");
const crypto = require("crypto");
const { McpProtocolHandler } = require("../protocol");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class WebSocketTransport {
  /**
   * @param {Object} [options]
   * @param {McpProtocolHandler} [options.handler]
   * @param {number} [options.port] - Default 9222
   * @param {string} [options.host] - Default "127.0.0.1"
   */
  constructor(options = {}) {
    this.handler = options.handler || new McpProtocolHandler();
    this.port = options.port || 9222;
    this.host = options.host || "127.0.0.1";
    this.server = null;
    this.clients = new Set();
    this.running = false;
  }

  /**
   * Start the WebSocket server.
   * @returns {Promise<number>} Bound port
   */
  start() {
    if (this.running) return Promise.resolve(this.port);

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Simple health/info endpoint on HTTP
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          service: "Dev Browser MCP Server",
          protocol: "mcp/1.0",
          status: "running",
          activeClients: this.clients.size
        }));
      });

      this.server.on("upgrade", (req, socket, head) => {
        this.handleUpgrade(req, socket, head);
      });

      this.server.on("error", (err) => {
        if (!this.running) {
          reject(err);
        }
      });

      this.server.listen(this.port, this.host, () => {
        this.running = true;
        this.port = this.server.address().port;
        resolve(this.port);
      });
    });
  }

  handleUpgrade(req, socket, head) {
    const upgradeHeader = req.headers["upgrade"];
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const clientKey = req.headers["sec-websocket-key"];
    if (!clientKey) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash("sha1")
      .update(clientKey + WS_GUID)
      .digest("base64");

    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "\r\n"
    ];

    socket.write(responseHeaders.join("\r\n"));

    const client = {
      socket,
      buffer: Buffer.alloc(0),
      alive: true
    };

    this.clients.add(client);

    socket.on("data", (chunk) => {
      this.handleSocketData(client, chunk);
    });

    const cleanup = () => {
      this.clients.delete(client);
    };

    socket.on("close", cleanup);
    socket.on("end", cleanup);
    socket.on("error", cleanup);
  }

  handleSocketData(client, chunk) {
    client.buffer = Buffer.concat([client.buffer, chunk]);

    while (client.buffer.length >= 2) {
      const byte0 = client.buffer[0];
      const byte1 = client.buffer[1];

      const opcode = byte0 & 0x0f;
      const isMasked = (byte1 & 0x80) !== 0;
      let payloadLen = byte1 & 0x7f;

      let headerLen = 2;

      if (payloadLen === 126) {
        if (client.buffer.length < 4) return;
        payloadLen = client.buffer.readUInt16BE(2);
        headerLen = 4;
      } else if (payloadLen === 127) {
        if (client.buffer.length < 10) return;
        // High 32 bits + low 32 bits
        const high = client.buffer.readUInt32BE(2);
        const low = client.buffer.readUInt32BE(6);
        payloadLen = high * 4294967296 + low;
        headerLen = 10;
      }

      const maskLen = isMasked ? 4 : 0;
      const totalFrameLen = headerLen + maskLen + payloadLen;

      if (client.buffer.length < totalFrameLen) {
        // Wait for more data
        return;
      }

      let payload = client.buffer.slice(headerLen + maskLen, totalFrameLen);

      if (isMasked) {
        const maskKey = client.buffer.slice(headerLen, headerLen + 4);
        const unmasked = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          unmasked[i] = payload[i] ^ maskKey[i % 4];
        }
        payload = unmasked;
      }

      // Consume this frame from buffer
      client.buffer = client.buffer.slice(totalFrameLen);

      // Handle frame opcode
      if (opcode === 0x08) {
        // Close frame
        this.sendFrame(client.socket, Buffer.alloc(0), 0x08);
        client.socket.end();
        this.clients.delete(client);
        return;
      } else if (opcode === 0x09) {
        // Ping frame -> respond Pong
        this.sendFrame(client.socket, payload, 0x0a);
      } else if (opcode === 0x01 || opcode === 0x02) {
        // Text frame or binary frame containing JSON-RPC
        const messageText = payload.toString("utf8");
        this.processClientMessage(client, messageText);
      }
    }
  }

  async processClientMessage(client, messageText) {
    try {
      const response = await this.handler.handleMessage(messageText);
      if (response) {
        const responseJson = JSON.stringify(response);
        this.sendFrame(client.socket, Buffer.from(responseJson, "utf8"), 0x01);
      }
    } catch (err) {
      const errorResponse = JSON.stringify(this.handler.formatError(null, -32603, err.message));
      this.sendFrame(client.socket, Buffer.from(errorResponse, "utf8"), 0x01);
    }
  }

  sendFrame(socket, payloadBuf, opcode = 0x01) {
    if (!socket || socket.destroyed || !socket.writable) return;

    const len = payloadBuf.length;
    let header;

    if (len <= 125) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | (opcode & 0x0f); // FIN + opcode
      header[1] = len;
    } else if (len <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | (opcode & 0x0f);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | (opcode & 0x0f);
      header[1] = 127;
      const high = Math.floor(len / 4294967296);
      const low = len % 4294967296;
      header.writeUInt32BE(high, 2);
      header.writeUInt32BE(low, 6);
    }

    try {
      socket.write(Buffer.concat([header, payloadBuf]));
    } catch {
      // Socket error
    }
  }

  broadcast(message) {
    const payload = Buffer.from(typeof message === "string" ? message : JSON.stringify(message), "utf8");
    for (const client of this.clients) {
      this.sendFrame(client.socket, payload, 0x01);
    }
  }

  stop() {
    if (!this.running) return Promise.resolve();
    this.running = false;

    for (const client of this.clients) {
      try {
        client.socket.destroy();
      } catch {
        // Ignore
      }
    }
    this.clients.clear();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort() {
    return this.port;
  }
}

module.exports = {
  WebSocketTransport
};
