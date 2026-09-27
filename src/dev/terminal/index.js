/**
 * Dev Browser - Terminal Module
 * Exports TerminalController, TerminalSession, PtyBridge, and default instance.
 */

const { PtyBridge } = require("./pty-bridge");
const { TerminalSession } = require("./terminal-session");
const { TerminalController } = require("./terminal-controller");
const { TerminalUI } = require("./terminal");

const defaultTerminal = new TerminalController();

module.exports = {
  PtyBridge,
  TerminalSession,
  TerminalController,
  TerminalUI,
  defaultTerminal
};
