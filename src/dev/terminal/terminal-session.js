/**
 * Dev Browser - Terminal Session
 * Represents an individual terminal tab instance with buffer, command history, and I/O handlers.
 */

const { EventEmitter } = require("events");

// Regex to match ANSI escape sequences (colors, cursor movements, resets)
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

class TerminalSession extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = options.id || `term-${Math.random().toString(36).slice(2, 9)}`;
    this.title = options.title || "Terminal";
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;
    this.buffer = "";
    this.history = [];
    this.historyIndex = -1;
    this.currentInput = "";
    this.ptyBridge = options.ptyBridge || null;
    this.isActive = false;

    if (this.ptyBridge) {
      this.bindBridge();
    }
  }

  bindBridge() {
    this.onOutputHandler = ({ sessionId, data }) => {
      if (sessionId === this.id) {
        this.write(data);
      }
    };
    this.ptyBridge.on("output", this.onOutputHandler);
  }

  write(data) {
    if (!data) return;
    this.buffer += data;
    // Cap buffer size at 50,000 characters to prevent memory overflow
    if (this.buffer.length > 50000) {
      this.buffer = this.buffer.slice(this.buffer.length - 40000);
    }
    this.emit("output", data);
    this.emit("change");
  }

  send(data) {
    if (this.ptyBridge) {
      this.ptyBridge.write(this.id, data);
    } else {
      this.write(data);
    }
  }

  execute(command) {
    if (typeof command !== "string") return;
    if (command.trim()) {
      this.history.push(command);
      this.historyIndex = this.history.length;
    }
    this.send(command + "\r");
  }

  clear() {
    this.buffer = "";
    this.emit("clear");
    this.emit("change");
  }

  resize(cols, rows) {
    this.cols = Number(cols) || 80;
    this.rows = Number(rows) || 24;
    if (this.ptyBridge) {
      this.ptyBridge.resize(this.id, this.cols, this.rows);
    }
    this.emit("resize", { cols: this.cols, rows: this.rows });
  }

  setTitle(title) {
    if (title && typeof title === "string") {
      this.title = title;
      this.emit("titleChange", this.title);
    }
  }

  getBufferText() {
    return this.buffer.replace(ANSI_REGEX, "");
  }

  getBufferHtml() {
    // Converts basic ANSI colors and line breaks to safe HTML spans
    const escaped = this.buffer
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    let formatted = escaped
      .replace(/\u001b\[0?m/g, "</span>")
      .replace(/\u001b\[31m/g, '<span style="color: #f38ba8;">')
      .replace(/\u001b\[32m/g, '<span style="color: #a6e3a1;">')
      .replace(/\u001b\[33m/g, '<span style="color: #f9e2af;">')
      .replace(/\u001b\[34m/g, '<span style="color: #89b4fa;">')
      .replace(/\u001b\[35m/g, '<span style="color: #cba6f7;">')
      .replace(/\u001b\[36m/g, '<span style="color: #94e2d5;">')
      .replace(/\u001b\[1m/g, '<span style="font-weight: bold;">')
      .replace(ANSI_REGEX, ""); // strip any remaining ANSI codes

    return formatted;
  }

  destroy() {
    if (this.ptyBridge) {
      if (this.onOutputHandler) {
        this.ptyBridge.removeListener("output", this.onOutputHandler);
      }
      this.ptyBridge.close(this.id);
    }
    this.buffer = "";
    this.history = [];
    this.removeAllListeners();
  }
}

module.exports = {
  TerminalSession,
  ANSI_REGEX
};
