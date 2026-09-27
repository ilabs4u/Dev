/**
 * Dev Browser - PTY WebSocket Bridge
 * Communicates with the Rust background daemon (ws://127.0.0.1:9333) for OS-level PTY management.
 * Includes graceful virtual shell fallback when daemon is disconnected or offline.
 */

const { EventEmitter } = require("events");

class PtyBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.url = options.url || "ws://127.0.0.1:9333";
    this.connected = false;
    this.socket = null;
    this.fallbackMode = options.fallbackMode !== false;
    this.sessions = new Map();

    if (options.autoConnect) {
      this.connect();
    }
  }

  connect(customUrl = null) {
    if (customUrl) this.url = customUrl;

    if (typeof WebSocket === "undefined") {
      // In Node testing environment without native or mock WS
      this.connected = false;
      return;
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.connected = true;
        this.emit("connect");
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // Non-JSON message from PTY
          this.emit("rawMessage", event.data);
        }
      };

      this.socket.onclose = () => {
        this.connected = false;
        this.emit("disconnect");
      };

      this.socket.onerror = (err) => {
        this.emit("error", err);
      };
    } catch (err) {
      this.connected = false;
      this.emit("error", err);
    }
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.connected = false;
    this.emit("disconnect");
  }

  handleMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "output":
        this.emit("output", {
          sessionId: msg.session_id,
          data: msg.data
        });
        break;
      case "exit":
        this.emit("exit", {
          sessionId: msg.session_id,
          code: msg.code || 0
        });
        break;
      case "error":
        this.emit("sessionError", {
          sessionId: msg.session_id,
          error: msg.error
        });
        break;
      default:
        this.emit("message", msg);
    }
  }

  sendJson(payload) {
    if (this.connected && this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  spawn(sessionId, { cols = 80, rows = 24, shell = "pwsh" } = {}) {
    this.sessions.set(sessionId, { cols, rows, shell });

    const sent = this.sendJson({
      type: "spawn",
      session_id: sessionId,
      cols,
      rows,
      shell
    });

    if (!sent && this.fallbackMode) {
      // Simulate virtual shell banner in fallback mode
      setTimeout(() => {
        this.emit("output", {
          sessionId,
          data: `Dev Browser Terminal (virtual shell - daemon offline)\r\n$ `
        });
      }, 10);
    }

    return true;
  }

  write(sessionId, data) {
    const sent = this.sendJson({
      type: "input",
      session_id: sessionId,
      data
    });

    if (!sent && this.fallbackMode) {
      // Virtual fallback echo
      if (data === "\r" || data === "\n") {
        this.emit("output", {
          sessionId,
          data: "\r\n$ "
        });
      } else {
        this.emit("output", {
          sessionId,
          data
        });
      }
    }

    return true;
  }

  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cols = cols;
      session.rows = rows;
    }

    return this.sendJson({
      type: "resize",
      session_id: sessionId,
      cols,
      rows
    });
  }

  close(sessionId) {
    this.sessions.delete(sessionId);
    return this.sendJson({
      type: "close",
      session_id: sessionId
    });
  }
}

module.exports = {
  PtyBridge
};
