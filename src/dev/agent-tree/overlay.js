/**
 * Dev Browser - Agent Tree Visual Overlay
 * Persistent, toggleable visual in-browser badge overlay that renders Agent Tree
 * labels over interactive elements (supports show, hide, toggle, update).
 */

const { DomDistiller, distill } = require("./distiller");

class AgentTreeOverlay {
  constructor(options = {}) {
    this.distiller = options.distiller || new DomDistiller();
    this.containerId = options.containerId || "dev-agent-tree-overlay";
    this.styleId = options.styleId || "dev-agent-tree-styles";
    this.badgeClass = options.badgeClass || "dev-agent-tree-badge";
    this.onSelect = options.onSelect || null;

    this.container = null;
    this.elements = [];
    this.badges = [];
    this.visible = false;
    this.mounted = false;
    this.targetDocument = null;

    this.boundScrollHandler = this.onScrollOrResize.bind(this);
  }

  /**
   * Mount overlay container and inject CSS into document.
   */
  mount(doc = null) {
    const documentObj = doc || (typeof document !== "undefined" ? document : null);
    if (!documentObj || !documentObj.body) return null;

    this.targetDocument = documentObj;

    // 1. Inject CSS if not already present
    this._injectStyles(documentObj);

    // 2. Reuse or create container
    let container = documentObj.getElementById(this.containerId);
    if (!container) {
      container = documentObj.createElement("div");
      container.id = this.containerId;
      container.className = "dev-hidden";
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483645;
        overflow: visible;
      `;
      documentObj.body.appendChild(container);
    }

    this.container = container;
    this.mounted = true;

    // 3. Attach scroll and resize listeners if in browser
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("scroll", this.boundScrollHandler, { passive: true });
      window.addEventListener("resize", this.boundScrollHandler, { passive: true });
    }

    return container;
  }

  _injectStyles(doc) {
    if (!doc || !doc.head) return;
    if (doc.getElementById(this.styleId)) return;

    let cssContent = "";
    try {
      const fs = require("node:fs");
      const path = require("node:path");
      const cssPath = path.join(__dirname, "overlay.css");
      if (fs.existsSync(cssPath)) {
        cssContent = fs.readFileSync(cssPath, "utf8");
      }
    } catch {
      // In bundled browser context, use inline CSS
    }

    if (!cssContent) {
      cssContent = `
        #dev-agent-tree-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 2147483645;
        }
        #dev-agent-tree-overlay.dev-hidden { display: none !important; }
        .dev-agent-tree-badge {
          position: absolute;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          box-sizing: border-box;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 11px;
          font-weight: 800;
          color: #030712;
          background: #38bdf8;
          border: 1px solid #0284c7;
          border-radius: 4px;
          pointer-events: auto;
          cursor: pointer;
          user-select: none;
          z-index: 2147483646;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        }
        .dev-agent-tree-badge.in-shadow {
          background: #c084fc;
          border-color: #9333ea;
        }
      `;
    }

    const styleEl = doc.createElement("style");
    styleEl.id = this.styleId;
    styleEl.textContent = cssContent;
    doc.head.appendChild(styleEl);
  }

  /**
   * Show visual badges for distilled elements.
   * If elements array is not provided, runs real-time distillation on current document.
   */
  show(elements = null) {
    if (!this.mounted) {
      this.mount();
    }

    if (!this.container) return 0;

    // Distill if elements not provided
    if (!elements) {
      const doc = this.targetDocument || (typeof document !== "undefined" ? document : null);
      this.elements = doc ? this.distiller.distill(doc) : [];
    } else {
      this.elements = elements;
    }

    this._renderBadges(this.elements);

    this.container.classList.remove("dev-hidden");
    this.container.style.display = "block";
    this.visible = true;

    return this.elements.length;
  }

  /**
   * Hide visual overlay.
   */
  hide() {
    if (!this.container) {
      this.visible = false;
      return false;
    }

    this.container.classList.add("dev-hidden");
    this.container.style.display = "none";
    this.visible = false;
    return true;
  }

  /**
   * Toggle visual overlay visibility.
   */
  toggle(elements = null) {
    if (this.visible) {
      this.hide();
      return false;
    } else {
      this.show(elements);
      return true;
    }
  }

  /**
   * Refresh distillation and badge positions.
   */
  update() {
    if (!this.visible) return 0;
    const doc = this.targetDocument || (typeof document !== "undefined" ? document : null);
    if (!doc) return 0;

    this.elements = this.distiller.distill(doc);
    this._renderBadges(this.elements);
    return this.elements.length;
  }

  _renderBadges(elements) {
    if (!this.container) return;

    // Clear previous badges
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.badges = [];

    const doc = this.targetDocument || (typeof document !== "undefined" ? document : null);
    if (!doc) return;

    const scrollX = typeof window !== "undefined" && window.scrollX ? window.scrollX : 0;
    const scrollY = typeof window !== "undefined" && window.scrollY ? window.scrollY : 0;

    for (const item of elements) {
      const badge = doc.createElement("div");
      badge.className = `${this.badgeClass}${item.inShadow ? " in-shadow" : ""}`;
      if (item.inShadow && badge.classList && typeof badge.classList.add === "function") {
        badge.classList.add("in-shadow");
      }
      badge.textContent = item.label;
      badge.setAttribute("data-label", item.label);
      badge.setAttribute("data-selector", item.selector || "");
      badge.setAttribute("title", `[${item.label}] <${item.tag}> ${item.role}: ${item.text || item.selector}`);

      const left = Math.max(0, (item.rect ? item.rect.x : 0) + scrollX);
      const top = Math.max(0, (item.rect ? item.rect.y : 0) + scrollY);

      badge.style.left = `${left}px`;
      badge.style.top = `${top}px`;

      // Click handler
      badge.addEventListener("click", (evt) => {
        evt.stopPropagation();
        if (typeof this.onSelect === "function") {
          this.onSelect(item);
        } else if (item.element) {
          if (typeof item.element.click === "function") {
            item.element.click();
          }
          if (typeof item.element.focus === "function") {
            item.element.focus();
          }
        }
      });

      this.container.appendChild(badge);
      this.badges.push(badge);
    }
  }

  onScrollOrResize() {
    if (!this.visible) return;
    this.update();
  }

  /**
   * Destroy overlay and clean up DOM and listeners.
   */
  destroy() {
    this.hide();

    if (typeof window !== "undefined" && window.removeEventListener) {
      window.removeEventListener("scroll", this.boundScrollHandler);
      window.removeEventListener("resize", this.boundScrollHandler);
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    if (this.targetDocument) {
      const styleEl = this.targetDocument.getElementById(this.styleId);
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    }

    this.container = null;
    this.elements = [];
    this.badges = [];
    this.mounted = false;
    this.visible = false;
    this.targetDocument = null;
  }
}

// Singleton default overlay instance
const defaultOverlay = new AgentTreeOverlay();

module.exports = {
  AgentTreeOverlay,
  defaultOverlay
};
