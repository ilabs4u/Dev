const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { KeymapManager, MODES } = require("../src/dev/lua-engine/keymap");
const { PageScroller } = require("../src/dev/vim-mode/scroller");
const { LinkHints } = require("../src/dev/vim-mode/hints");
const { VimController } = require("../src/dev/vim-mode/vim-controller");

describe("Task 1.2: keymap.set() and Vim Mode Modal Interception", () => {
  let km;

  beforeEach(() => {
    km = new KeymapManager();
  });

  it("handles basic keymap.set and triggers action on normal page target", () => {
    let scrolled = false;
    km.registerActionHandler("scroll_down", () => {
      scrolled = true;
    });

    const event = {
      key: "j",
      target: { tagName: "BODY" },
      preventDefault: () => {}
    };

    const res = km.handleKeyEvent(event);
    assert.equal(res.handled, true);
    assert.equal(res.action, "scroll_down");
    assert.equal(scrolled, true, "scroll_down handler should have executed");
  });

  it("does NOT intercept key events when user is typing in text fields", () => {
    const textInputTarget = {
      tagName: "INPUT",
      type: "text",
      value: "hello"
    };

    const event = {
      key: "j",
      target: textInputTarget,
      preventDefault: () => {
        assert.fail("Should not preventDefault on text fields");
      }
    };

    const res = km.handleKeyEvent(event);
    assert.equal(res.handled, false);
    assert.equal(res.reason, "editable_target");
  });

  it("does NOT intercept key events in textarea or contenteditable elements", () => {
    const textareaTarget = {
      tagName: "TEXTAREA",
      value: ""
    };
    const ceTarget = {
      tagName: "DIV",
      isContentEditable: true
    };

    const res1 = km.handleKeyEvent({ key: "k", target: textareaTarget });
    assert.equal(res1.handled, false);
    assert.equal(res1.reason, "editable_target");

    const res2 = km.handleKeyEvent({ key: "d", target: ceTarget });
    assert.equal(res2.handled, false);
    assert.equal(res2.reason, "editable_target");
  });

  it("handles Escape in editable field to blur and switch to normal mode", () => {
    let blurred = false;
    const inputTarget = {
      tagName: "INPUT",
      type: "text",
      blur: () => {
        blurred = true;
      }
    };

    km.setMode(MODES.INSERT);

    const event = {
      key: "Escape",
      target: inputTarget,
      preventDefault: () => {}
    };

    const res = km.handleKeyEvent(event);
    assert.equal(res.handled, true);
    assert.equal(res.action, "exit_insert_mode");
    assert.equal(blurred, true, "Input element must be blurred");
    assert.equal(km.getMode(), MODES.NORMAL, "Must be back in normal mode");
  });

  it("switches modes properly: normal -> insert -> normal", () => {
    assert.equal(km.getMode(), MODES.NORMAL);

    // Press 'i' on page body to enter insert mode
    const iEvent = {
      key: "i",
      target: { tagName: "DIV" },
      preventDefault: () => {}
    };
    const resI = km.handleKeyEvent(iEvent);
    assert.equal(resI.handled, true);
    assert.equal(resI.action, "enter_insert_mode");
    assert.equal(km.getMode(), MODES.INSERT);

    // In insert mode, typing 'j' on page is not intercepted
    const jEvent = {
      key: "j",
      target: { tagName: "DIV" },
      preventDefault: () => {}
    };
    const resJ = km.handleKeyEvent(jEvent);
    assert.equal(resJ.handled, false);
    assert.equal(resJ.reason, "insert_mode");

    // Press Escape to return to normal mode
    const escEvent = {
      key: "Escape",
      target: { tagName: "DIV" },
      preventDefault: () => {}
    };
    const resEsc = km.handleKeyEvent(escEvent);
    assert.equal(resEsc.handled, true);
    assert.equal(resEsc.action, "exit_insert_mode");
    assert.equal(km.getMode(), MODES.NORMAL);
  });

  it("handles multi-character sequences like gg and leader keys", () => {
    let scrolledTop = false;
    km.registerActionHandler("scroll_top", () => {
      scrolledTop = true;
    });

    const target = { tagName: "DIV" };

    // First 'g'
    const res1 = km.handleKeyEvent({ key: "g", target, preventDefault: () => {} });
    assert.equal(res1.handled, true);
    assert.equal(res1.action, "buffering_sequence");
    assert.equal(res1.buffer, "g");

    // Second 'g' -> triggers scroll_top
    const res2 = km.handleKeyEvent({ key: "g", target, preventDefault: () => {} });
    assert.equal(res2.handled, true);
    assert.equal(res2.action, "scroll_top");
    assert.equal(scrolledTop, true);
  });

  it("handles custom keymap.del to unregister keys", () => {
    assert.ok(km.get("n", "j"));
    km.del("n", "j");
    assert.equal(km.get("n", "j"), undefined);

    const res = km.handleKeyEvent({ key: "j", target: { tagName: "BODY" } });
    assert.equal(res.handled, false);
  });

  it("generates hint strings correctly in LinkHints", () => {
    const hints = new LinkHints();
    const codes = hints.generateHintStrings(10);
    assert.equal(codes.length, 10);
    // Ensure all codes are unique
    const unique = new Set(codes);
    assert.equal(unique.size, 10);

    const manyCodes = hints.generateHintStrings(50);
    assert.equal(manyCodes.length, 50);
    assert.equal(new Set(manyCodes).size, 50);
  });
});
