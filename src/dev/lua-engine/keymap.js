/**
 * Dev Browser - Keymap Engine
 * Handles modal keybindings, input filtering, and multi-key sequence dispatching.
 */

const MODES = {
  NORMAL: "n",
  INSERT: "i",
  VISUAL: "v",
  COMMAND: "c"
};

class KeymapManager {
  constructor(options = {}) {
    this.currentMode = MODES.NORMAL;
    this.leaderKey = options.leaderKey || "\\";
    this.mappings = new Map(); // mode -> Map(normalizedKey -> action)
    this.sequenceBuffer = "";
    this.bufferTimeout = null;
    this.bufferDelay = options.bufferDelay || 500;
    this.modeChangeListeners = [];
    this.actionHandlers = new Map();

    // Initialize map for each mode
    for (const mode of Object.values(MODES)) {
      this.mappings.set(mode, new Map());
    }

    // Default keybindings
    this.registerDefaults();
  }

  registerDefaults() {
    this.set("n", "j", "scroll_down");
    this.set("n", "k", "scroll_up");
    this.set("n", "gg", "scroll_top");
    this.set("n", "G", "scroll_bottom");
    this.set("n", "d", "scroll_half_down");
    this.set("n", "u", "scroll_half_up");
    this.set("n", "H", "go_back");
    this.set("n", "L", "go_forward");
    this.set("n", "f", "link_hints");
    this.set("n", "x", "close_tab");
    this.set("n", "t", "new_tab");
    this.set("n", "J", "prev_tab");
    this.set("n", "K", "next_tab");
    this.set("n", "<C-p>", "command_palette");
    this.set("n", "<C-k>", "command_palette");
    this.set("n", "<leader>t", "toggle_terminal");
    this.set("n", "<leader>ip", "rotate_proxy");
    this.set("n", "<leader>ai", "toggle_ai_sidebar");
    this.set("n", "<leader>at", "toggle_agent_tree");
  }

  setLeader(key) {
    this.leaderKey = key;
    for (const [, map] of this.mappings.entries()) {
      for (const [k, v] of Array.from(map.entries())) {
        if (v.originalKey && /<leader>/i.test(v.originalKey)) {
          map.delete(k);
          const newNormalized = this.normalizeKey(v.originalKey);
          map.set(newNormalized, v);
        }
      }
    }
  }

  normalizeKey(key) {
    if (!key) return "";
    let norm = key;
    // Replace <leader>
    norm = norm.replace(/<leader>/gi, this.leaderKey);
    // Replace <C-x> or <c-x> with Ctrl+x
    norm = norm.replace(/<[Cc]-([^>]+)>/g, "Ctrl+$1");
    // Replace <A-x> with Alt+x
    norm = norm.replace(/<[Aa]-([^>]+)>/g, "Alt+$1");
    // Replace <CR> or <Enter>
    norm = norm.replace(/<CR>/gi, "Enter");
    // Replace <Esc> with Escape
    norm = norm.replace(/<Esc>/gi, "Escape");
    // Replace <Space>
    norm = norm.replace(/<Space>/gi, " ");
    return norm;
  }

  set(mode, key, action, opts = {}) {
    if (!this.mappings.has(mode)) {
      this.mappings.set(mode, new Map());
    }
    const normalized = this.normalizeKey(key);
    this.mappings.get(mode).set(normalized, {
      action,
      opts,
      originalKey: key
    });
  }

  del(mode, key) {
    if (this.mappings.has(mode)) {
      const normalized = this.normalizeKey(key);
      return this.mappings.get(mode).delete(normalized);
    }
    return false;
  }

  clear() {
    for (const mode of Object.values(MODES)) {
      this.mappings.set(mode, new Map());
    }
    this.clearSequenceBuffer();
  }

  resetDefaults() {
    this.clear();
    this.registerDefaults();
  }

  get(mode, key) {
    if (this.mappings.has(mode)) {
      const normalized = this.normalizeKey(key);
      return this.mappings.get(mode).get(normalized);
    }
    return undefined;
  }

  list(mode) {
    if (this.mappings.has(mode)) {
      return Array.from(this.mappings.get(mode).entries()).map(([k, v]) => ({
        key: k,
        originalKey: v.originalKey,
        action: v.action
      }));
    }
    return [];
  }

  setMode(newMode) {
    if (this.currentMode === newMode) return;
    const oldMode = this.currentMode;
    this.currentMode = newMode;
    this.sequenceBuffer = "";
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    for (const cb of this.modeChangeListeners) {
      try {
        cb(newMode, oldMode);
      } catch (err) {
        console.error("Error in mode change listener:", err);
      }
    }
  }

  getMode() {
    return this.currentMode;
  }

  onModeChange(cb) {
    this.modeChangeListeners.push(cb);
  }

  registerActionHandler(name, fn) {
    this.actionHandlers.set(name, fn);
  }

  /**
   * Returns true if target element accepts user text input.
   * In this case, normal mode single keys (like j, k) must NOT be intercepted!
   */
  isEditableTarget(target) {
    if (!target) return false;

    // Check tag name
    const tag = (target.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "select") {
      return true;
    }
    if (tag === "input") {
      const type = (target.type || "text").toLowerCase();
      // Non-text inputs where vim navigation is acceptable
      const nonTextTypes = ["checkbox", "radio", "button", "submit", "reset", "image", "color", "range"];
      return !nonTextTypes.includes(type);
    }

    // Check contentEditable
    if (target.isContentEditable) {
      return true;
    }
    const ce = target.getAttribute && target.getAttribute("contenteditable");
    if (ce && ce !== "false") {
      return true;
    }

    // Check ARIA roles
    const role = target.getAttribute && target.getAttribute("role");
    if (role === "textbox" || role === "searchbox" || role === "combobox") {
      return true;
    }

    return false;
  }

  /**
   * Main keyboard event interceptor.
   * Can be hooked to `window.addEventListener("keydown", ...)`.
   */
  handleKeyEvent(event) {
    const isEditable = this.isEditableTarget(event.target);

    // If focused on an editable element
    if (isEditable) {
      // Escape blurs input and enters normal mode
      if (event.key === "Escape") {
        if (event.target && typeof event.target.blur === "function") {
          event.target.blur();
        }
        this.setMode(MODES.NORMAL);
        if (typeof event.preventDefault === "function") event.preventDefault();
        return { handled: true, action: "exit_insert_mode" };
      }
      // Pass all other keys through to input field
      return { handled: false, reason: "editable_target" };
    }

    // If currently in INSERT mode (not in text field)
    if (this.currentMode === MODES.INSERT) {
      if (event.key === "Escape") {
        this.setMode(MODES.NORMAL);
        if (typeof event.preventDefault === "function") event.preventDefault();
        return { handled: true, action: "exit_insert_mode" };
      }
      return { handled: false, reason: "insert_mode" };
    }

    // In NORMAL mode: pressing 'i' enters insert mode (unless part of a multi-key sequence)
    if (this.currentMode === MODES.NORMAL && !this.sequenceBuffer && event.key === "i" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      this.setMode(MODES.INSERT);
      if (typeof event.preventDefault === "function") event.preventDefault();
      return { handled: true, action: "enter_insert_mode" };
    }

    // Build key string
    let keyStr = "";
    if (event.ctrlKey && event.key !== "Control") {
      keyStr += "Ctrl+";
    }
    if (event.altKey && event.key !== "Alt") {
      keyStr += "Alt+";
    }
    if (event.metaKey && event.key !== "Meta") {
      keyStr += "Meta+";
    }

    // Normalize single key
    const rawKey = event.key;
    if (keyStr) {
      keyStr += rawKey.toLowerCase();
    } else {
      keyStr = rawKey;
    }

    const modeMap = this.mappings.get(this.currentMode) || new Map();

    // 1. If we already have a buffered sequence prefix:
    if (this.sequenceBuffer) {
      const candidateSequence = this.sequenceBuffer + keyStr;

      // Check exact sequence match
      const seqMatch = modeMap.get(candidateSequence);
      if (seqMatch) {
        this.clearSequenceBuffer();
        if (typeof event.preventDefault === "function") event.preventDefault();
        this.executeAction(seqMatch.action, seqMatch.opts);
        return { handled: true, action: seqMatch.action };
      }

      // Check if it's still a valid prefix of an even longer registered sequence
      let isPrefix = false;
      for (const registeredKey of modeMap.keys()) {
        if (registeredKey.startsWith(candidateSequence) && registeredKey.length > candidateSequence.length) {
          isPrefix = true;
          break;
        }
      }

      if (isPrefix) {
        this.sequenceBuffer = candidateSequence;
        if (typeof event.preventDefault === "function") event.preventDefault();
        if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
        this.bufferTimeout = setTimeout(() => {
          this.clearSequenceBuffer();
        }, this.bufferDelay);
        return { handled: true, action: "buffering_sequence", buffer: this.sequenceBuffer };
      }

      // Sequence broken by this key: clear the sequence buffer and fall through to process keyStr fresh
      this.clearSequenceBuffer();
    }

    // 2. No active sequence buffer: check if keyStr begins a multi-key sequence
    let isPrefix = false;
    for (const registeredKey of modeMap.keys()) {
      if (registeredKey.startsWith(keyStr) && registeredKey.length > keyStr.length) {
        isPrefix = true;
        break;
      }
    }

    if (isPrefix) {
      this.sequenceBuffer = keyStr;
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (this.bufferTimeout) clearTimeout(this.bufferTimeout);
      this.bufferTimeout = setTimeout(() => {
        // If single key was also a valid mapping, execute it on timeout
        const singleMatch = modeMap.get(this.sequenceBuffer);
        this.clearSequenceBuffer();
        if (singleMatch) {
          this.executeAction(singleMatch.action, singleMatch.opts);
        }
      }, this.bufferDelay);
      return { handled: true, action: "buffering_sequence", buffer: this.sequenceBuffer };
    }

    // 3. Direct single key match
    const directMatch = modeMap.get(keyStr);
    if (directMatch) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      this.executeAction(directMatch.action, directMatch.opts);
      return { handled: true, action: directMatch.action };
    }

    // 4. No match
    return { handled: false, reason: "unmapped_key" };
  }

  clearSequenceBuffer() {
    this.sequenceBuffer = "";
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
  }

  executeAction(action, opts = {}) {
    if (typeof action === "function") {
      action(opts);
      return;
    }
    const handler = this.actionHandlers.get(action);
    if (handler) {
      handler(opts);
    }
  }
}

// Global keymap singleton instance
const keymap = new KeymapManager();

module.exports = {
  MODES,
  KeymapManager,
  keymap
};
