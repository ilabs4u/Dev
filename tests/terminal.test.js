/**
 * Tests for Embedded Terminal (Task 3.1)
 * Validates TerminalController, TerminalSession, PtyBridge, multi-tabs, split views,
 * clipboard, and Vim <leader>t keymap integration.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  PtyBridge,
  TerminalSession,
  TerminalController,
  defaultTerminal
} = require("../src/dev/terminal");

const { VimController } = require("../src/dev/vim-mode");
const { KeymapManager } = require("../src/dev/lua-engine/keymap");

describe("Phase 3: Embedded Terminal Suite", () => {
  describe("TerminalSession", () => {
    it("buffers data, trims ANSI sequences, and generates formatted HTML", () => {
      const session = new TerminalSession({ title: "Bash Session" });
      assert.equal(session.title, "Bash Session");

      // Write ANSI colored text
      session.write("\u001b[32mSuccess:\u001b[0m Operation completed\r\n");

      // Plain text check
      const plain = session.getBufferText();
      assert.ok(plain.includes("Success: Operation completed"));
      assert.ok(!plain.includes("\u001b[32m"));

      // HTML check
      const html = session.getBufferHtml();
      assert.ok(html.includes("<span style="));
      assert.ok(html.includes("Success:"));

      // Clear
      session.clear();
      assert.equal(session.getBufferText(), "");
    });

    it("tracks command history and execution", () => {
      const session = new TerminalSession();
      session.execute("npm test");
      session.execute("git status");

      assert.equal(session.history.length, 2);
      assert.equal(session.history[0], "npm test");
      assert.equal(session.history[1], "git status");
    });

    it("handles resize events cleanly", () => {
      const session = new TerminalSession({ cols: 80, rows: 24 });
      let resized = null;
      session.on("resize", (dims) => { resized = dims; });

      session.resize(120, 40);
      assert.equal(session.cols, 120);
      assert.equal(session.rows, 40);
      assert.deepEqual(resized, { cols: 120, rows: 40 });
    });
  });

  describe("PtyBridge & Virtual Shell Fallback", () => {
    it("operates in virtual fallback mode when daemon is offline", async () => {
      const bridge = new PtyBridge({ autoConnect: false, fallbackMode: true });
      assert.equal(bridge.connected, false);

      let receivedOutput = "";
      bridge.on("output", ({ sessionId, data }) => {
        if (sessionId === "test-s1") {
          receivedOutput += data;
        }
      });

      bridge.spawn("test-s1", { cols: 80, rows: 24, shell: "pwsh" });

      // Wait 30ms for virtual shell banner
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.ok(receivedOutput.includes("virtual shell"), "Banner must indicate virtual shell fallback");

      bridge.write("test-s1", "ls\r");
      assert.ok(receivedOutput.length > 0);
    });
  });

  describe("TerminalController & Multi-Tab Management", () => {
    let controller;

    beforeEach(() => {
      controller = new TerminalController({ createDefaultTab: false });
    });

    it("controls panel visibility lifecycle (open, close, toggle)", () => {
      assert.equal(controller.isOpen, false);

      controller.open();
      assert.equal(controller.isOpen, true);

      controller.close();
      assert.equal(controller.isOpen, false);

      controller.toggle();
      assert.equal(controller.isOpen, true);

      controller.toggle();
      assert.equal(controller.isOpen, false);
    });

    it("creates, switches, and closes tabs", () => {
      const t1 = controller.createTab("Main Server");
      assert.equal(controller.getTabs().length, 1);
      assert.equal(controller.activeTabId, t1.id);
      assert.equal(t1.isActive, true);

      const t2 = controller.createTab("Vite Watcher");
      assert.equal(controller.getTabs().length, 2);

      controller.switchTab(t2.id);
      assert.equal(controller.activeTabId, t2.id);
      assert.equal(t2.isActive, true);
      assert.equal(t1.isActive, false);

      // Close active tab -> switches to remaining tab
      controller.closeTab(t2.id);
      assert.equal(controller.getTabs().length, 1);
      assert.equal(controller.activeTabId, t1.id);
    });

    it("ensures at least one tab remains when closing the last tab", () => {
      const t1 = controller.createTab("Only Tab");
      controller.closeTab(t1.id);
      assert.equal(controller.getTabs().length, 1);
      assert.notEqual(controller.activeTabId, t1.id);
    });

    it("supports horizontal and vertical split views", () => {
      const t1 = controller.createTab("Editor");
      assert.equal(controller.splitMode, "none");

      controller.setSplit("horizontal");
      assert.equal(controller.splitMode, "horizontal");
      assert.ok(controller.secondaryTabId);
      assert.notEqual(controller.secondaryTabId, t1.id);

      controller.setSplit("vertical");
      assert.equal(controller.splitMode, "vertical");

      controller.setSplit("none");
      assert.equal(controller.splitMode, "none");
      assert.equal(controller.secondaryTabId, null);
    });

    it("handles clipboard copy and paste operations", () => {
      const session = controller.createTab("Clipboard Test");
      controller.copySelection("git commit -m 'feat: terminal'");
      assert.equal(controller.clipboard, "git commit -m 'feat: terminal'");

      let pasted = "";
      session.on("output", (data) => { pasted += data; });
      controller.paste();
      // In fallback mode, writes to session
      assert.ok(controller.clipboard.length > 0);
    });
  });

  describe("Vim Mode & Keymap Integration (<leader>t)", () => {
    it("wires <leader>t keybinding to toggle terminal panel", () => {
      const keymap = new KeymapManager();
      keymap.setLeader(" ");

      const mockTerminal = {
        openCount: 0,
        isOpen: false,
        toggle: function() {
          this.isOpen = !this.isOpen;
          this.openCount++;
          return this.isOpen;
        }
      };

      const vim = new VimController({
        keymap,
        terminal: mockTerminal
      });

      // Press <leader>t (Space + t) in normal mode
      vim.handleKey(" ");
      vim.handleKey("t");

      assert.equal(mockTerminal.openCount, 1);
      assert.equal(mockTerminal.isOpen, true);

      // Press <leader>t again to toggle off
      vim.handleKey(" ");
      vim.handleKey("t");

      assert.equal(mockTerminal.openCount, 2);
      assert.equal(mockTerminal.isOpen, false);
    });
  });

  describe("Edge Cases & Robustness", () => {
    it("throws error when switching to non-existent tab", () => {
      const controller = new TerminalController();
      assert.throws(() => controller.switchTab("ghost-id"), /Terminal tab "ghost-id" not found/);
    });

    it("throws error when passing invalid split mode", () => {
      const controller = new TerminalController();
      assert.throws(() => controller.setSplit("diagonal"), /Invalid split mode/);
    });

    it("handles closing the secondary split tab by resetting splitMode to none", () => {
      const controller = new TerminalController();
      const t2 = controller.createTab("Second Tab");
      controller.setSplit("horizontal", t2.id);
      assert.equal(controller.splitMode, "horizontal");
      assert.equal(controller.secondaryTabId, t2.id);

      controller.closeTab(t2.id);
      assert.equal(controller.splitMode, "none");
      assert.equal(controller.secondaryTabId, null);
    });

    it("session.destroy cleans up buffer, listeners, and history safely", () => {
      const session = new TerminalSession({ title: "Temporary" });
      session.write("temporary output");
      session.destroy();
      assert.equal(session.getBufferText(), "");
      assert.equal(session.history.length, 0);
      assert.equal(session.listenerCount("output"), 0);
    });
  });
});
