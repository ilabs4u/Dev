/**
 * Dev Browser - Link Hints Engine
 * Implements Vimium-style 'f' key link hints.
 */

const HINT_CHARACTERS = "sadfjklewcmpgh";

class LinkHints {
  constructor() {
    this.isActive = false;
    this.hints = [];
    this.inputBuffer = "";
    this.container = null;
  }

  generateHintStrings(count) {
    const chars = HINT_CHARACTERS;
    const base = chars.length;
    const result = [];

    if (count <= base) {
      for (let i = 0; i < count; i++) {
        result.push(chars[i]);
      }
      return result;
    }

    // 2-character hint codes
    for (let i = 0; i < base && result.length < count; i++) {
      for (let j = 0; j < base && result.length < count; j++) {
        result.push(chars[i] + chars[j]);
      }
    }
    return result;
  }

  findClickableElements(root = null) {
    if (typeof document === "undefined") return [];
    const doc = root || document;
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([type='hidden']):not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[role='button']",
      "[role='link']",
      "[tabindex]:not([tabindex='-1'])",
      "[onclick]"
    ].join(", ");

    const elements = Array.from(doc.querySelectorAll(selector));
    // Filter visible elements
    return elements.filter(el => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < (window.innerHeight || 1000) &&
        rect.bottom > 0 &&
        rect.left < (window.innerWidth || 1000) &&
        rect.right > 0
      );
    });
  }

  show() {
    if (typeof document === "undefined") return;
    this.hide();

    const elements = this.findClickableElements();
    if (elements.length === 0) return;

    this.isActive = true;
    this.inputBuffer = "";
    const hintCodes = this.generateHintStrings(elements.length);

    this.container = document.createElement("div");
    this.container.id = "dev-link-hints-container";
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
    `;

    this.hints = elements.map((element, i) => {
      const code = hintCodes[i];
      const rect = element.getBoundingClientRect();

      const badge = document.createElement("div");
      badge.className = "dev-link-hint-badge";
      badge.textContent = code.toUpperCase();
      badge.style.cssText = `
        position: absolute;
        top: ${Math.max(0, rect.top)}px;
        left: ${Math.max(0, rect.left)}px;
        background: #f7c948;
        color: #1a1a1a;
        font-family: monospace;
        font-weight: bold;
        font-size: 11px;
        padding: 1px 4px;
        border: 1px solid #78350f;
        border-radius: 3px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        z-index: 2147483647;
      `;

      this.container.appendChild(badge);
      return { code, element, badge };
    });

    document.body.appendChild(this.container);
  }

  hide() {
    this.isActive = false;
    this.inputBuffer = "";
    this.hints = [];
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  handleKey(key) {
    if (!this.isActive) return false;

    if (key === "Escape") {
      this.hide();
      return true;
    }

    this.inputBuffer += key.toLowerCase();

    // Check exact match
    const matched = this.hints.find(h => h.code === this.inputBuffer);
    if (matched) {
      this.activateElement(matched.element);
      this.hide();
      return true;
    }

    // Check if prefix of any hints
    const stillPossible = this.hints.filter(h => h.code.startsWith(this.inputBuffer));
    if (stillPossible.length > 0) {
      // Update badge highlights
      for (const hint of this.hints) {
        if (!hint.code.startsWith(this.inputBuffer)) {
          hint.badge.style.opacity = "0.2";
        }
      }
      return true;
    }

    // Invalid key: exit hints
    this.hide();
    return false;
  }

  activateElement(element) {
    if (!element) return;
    const tag = (element.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable) {
      element.focus();
    } else {
      element.click();
    }
  }
}

module.exports = {
  LinkHints
};
