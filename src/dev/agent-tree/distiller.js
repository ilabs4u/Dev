/**
 * Dev Browser - Agent Tree DOM Distiller
 * Real-time DOM element labeling engine. Walks DOM / HTML, identifies interactive
 * elements, assigns compact unique labels (A, B... Z, AA, AB...), extracts semantics,
 * handles shadow DOM and filters invisible / hidden elements.
 *
 * Must execute in <100ms.
 */

/**
 * Bijective base-26 label generator (A..Z, AA..AZ, BA..ZZ, AAA..).
 * @param {number} index - 0-based index
 * @returns {string} Unique compact label
 */
function generateLabel(index) {
  if (index < 0 || typeof index !== "number" || isNaN(index)) return "";
  let label = "";
  let n = Math.floor(index);
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/**
 * Inverse of generateLabel: converts label string back to 0-based index.
 * @param {string} label - e.g. "A", "AA"
 * @returns {number} 0-based index, or -1 if invalid
 */
function parseLabel(label) {
  if (!label || typeof label !== "string") return -1;
  const upper = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) return -1;
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i) - 65;
    index = index * 26 + (code + 1);
  }
  return index - 1;
}

/**
 * Interactive ARIA roles recognized by accessibility and agent standards.
 */
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "combobox",
  "searchbox",
  "textbox",
  "slider",
  "spinbutton",
  "treeitem",
  "option"
]);

/**
 * Tags that are non-interactive structural or metadata containers.
 */
const SKIP_TAGS = new Set([
  "script",
  "style",
  "meta",
  "title",
  "head",
  "noscript",
  "template",
  "svg",
  "path",
  "circle",
  "rect",
  "polygon",
  "g"
]);

class DomDistiller {
  constructor(options = {}) {
    this.maxTextLength = options.maxTextLength || 100;
  }

  /**
   * Determine semantic role of an element.
   */
  getRole(tag, attrs = {}) {
    if (attrs.role) {
      return String(attrs.role).toLowerCase();
    }
    switch (tag) {
      case "a":
        return attrs.href ? "link" : (attrs.onclick ? "button" : null);
      case "button":
      case "summary":
        return "button";
      case "textarea":
        return "textbox";
      case "select":
        return "combobox";
      case "input": {
        const type = (attrs.type || "text").toLowerCase();
        if (type === "button" || type === "submit" || type === "reset") return "button";
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        if (type === "search") return "searchbox";
        if (type === "range") return "slider";
        if (type === "number") return "spinbutton";
        return "textbox";
      }
      default:
        if (attrs.onclick) return "button";
        if (attrs.contenteditable && attrs.contenteditable !== "false") return "textbox";
        return null;
    }
  }

  /**
   * Check if a DOM element or tag with attributes is interactive.
   */
  isInteractive(elementOrTag, attrs = {}, computedStyle = null) {
    if (!elementOrTag) return false;

    // 1. DOM Element node branch
    if (typeof elementOrTag === "object" && elementOrTag.nodeType === 1) {
      const el = elementOrTag;
      const tag = (el.tagName || "").toLowerCase();
      if (SKIP_TAGS.has(tag)) return false;

      // Disabled elements are not interactive
      if (el.disabled || (el.hasAttribute && el.hasAttribute("disabled"))) return false;

      // Hidden inputs
      if (tag === "input" && (el.type || (el.getAttribute && el.getAttribute("type")) || "").toLowerCase() === "hidden") {
        return false;
      }

      // Standard interactive tags
      if (tag === "button" || tag === "select" || tag === "textarea" || tag === "summary") return true;
      if (tag === "input") return true;
      if (tag === "a" && ((el.hasAttribute && el.hasAttribute("href")) || el.href)) return true;

      // ARIA role
      const role = (el.getAttribute && el.getAttribute("role")) || (el.role ? String(el.role) : null);
      if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true;

      // Event handlers / attributes
      if ((el.hasAttribute && el.hasAttribute("onclick")) || typeof el.onclick === "function") return true;

      // ContentEditable
      if (el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") !== null && el.getAttribute("contenteditable") !== "false")) {
        return true;
      }

      // TabIndex >= 0
      const tabIndex = el.getAttribute ? el.getAttribute("tabindex") : null;
      if (tabIndex !== null && tabIndex !== undefined && tabIndex !== "-1" && tabIndex !== "") {
        const num = parseInt(tabIndex, 10);
        if (!isNaN(num) && num >= 0) return true;
      }

      // Pointer cursor
      if (computedStyle && computedStyle.cursor === "pointer" && !["body", "html"].includes(tag)) return true;
      if (el.style && el.style.cursor === "pointer" && !["body", "html"].includes(tag)) return true;

      return false;
    }

    // 2. Tag + Attrs string branch
    const tag = String(elementOrTag).toLowerCase();
    if (SKIP_TAGS.has(tag)) return false;
    if (attrs.disabled !== undefined && attrs.disabled !== false && attrs.disabled !== null) return false;

    if (tag === "input" && (attrs.type || "").toLowerCase() === "hidden") return false;
    if (tag === "button" || tag === "select" || tag === "textarea" || tag === "summary") return true;
    if (tag === "input") return true;
    if (tag === "a" && (attrs.href !== undefined && attrs.href !== null)) return true;

    if (attrs.role && INTERACTIVE_ROLES.has(String(attrs.role).toLowerCase())) return true;
    if (attrs.onclick) return true;
    if (attrs.contenteditable && attrs.contenteditable !== "false") return true;

    if (attrs.tabindex !== undefined && attrs.tabindex !== null && attrs.tabindex !== "-1" && attrs.tabindex !== "") {
      const num = parseInt(attrs.tabindex, 10);
      if (!isNaN(num) && num >= 0) return true;
    }

    return false;
  }

  /**
   * Check if a DOM element or attribute set is visible and not hidden.
   */
  isVisible(elementOrAttrs, computedStyle = null) {
    if (!elementOrAttrs) return false;

    // 1. DOM Element node
    if (typeof elementOrAttrs === "object" && elementOrAttrs.nodeType === 1) {
      const el = elementOrAttrs;

      if (el.hidden || (el.hasAttribute && el.hasAttribute("hidden"))) return false;
      if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;

      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" && (el.type || (el.getAttribute && el.getAttribute("type")) || "").toLowerCase() === "hidden") {
        return false;
      }

      // Inline style checks
      if (el.style) {
        if (el.style.display === "none") return false;
        if (el.style.visibility === "hidden" || el.style.visibility === "collapse") return false;
        if (el.style.opacity === "0") return false;
      }

      // Computed style
      if (computedStyle) {
        if (computedStyle.display === "none") return false;
        if (computedStyle.visibility === "hidden" || computedStyle.visibility === "collapse") return false;
        if (parseFloat(computedStyle.opacity) === 0) return false;
      } else if (typeof window !== "undefined" && window.getComputedStyle) {
        try {
          const cs = window.getComputedStyle(el);
          if (cs.display === "none") return false;
          if (cs.visibility === "hidden" || cs.visibility === "collapse") return false;
          if (parseFloat(cs.opacity) === 0) return false;
        } catch {
          // Continue
        }
      }

      // Bounding rect
      if (typeof el.getBoundingClientRect === "function") {
        try {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 && rect.height <= 0) return false;
        } catch {
          // Continue
        }
      }

      return true;
    }

    // 2. Attributes dictionary branch
    const attrs = elementOrAttrs;
    if (attrs.hidden !== undefined && attrs.hidden !== false && attrs.hidden !== null) return false;
    if (attrs["aria-hidden"] === "true") return false;
    if ((attrs.type || "").toLowerCase() === "hidden") return false;

    if (attrs.style) {
      const s = String(attrs.style).toLowerCase();
      if (/display\s*:\s*none/i.test(s)) return false;
      if (/visibility\s*:\s*(hidden|collapse)/i.test(s)) return false;
      if (/opacity\s*:\s*0(?:\.0+)?(?:\s*;|$)/i.test(s)) return false;
    }

    return true;
  }

  /**
   * Extract cleaned, accessible text from element or attributes.
   */
  extractText(elementOrAttrs, tag, innerText = "") {
    if (typeof elementOrAttrs === "object" && elementOrAttrs.nodeType === 1) {
      const el = elementOrAttrs;
      const ariaLabel = el.getAttribute ? el.getAttribute("aria-label") : null;
      if (ariaLabel && ariaLabel.trim()) return this._cleanText(ariaLabel);

      const t = (el.tagName || "").toLowerCase();
      if (t === "input") {
        const type = (el.type || (el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
        const placeholder = el.placeholder || (el.getAttribute && el.getAttribute("placeholder")) || "";
        const val = el.value !== undefined && el.value !== null ? el.value : ((el.getAttribute && el.getAttribute("value")) || "");
        const title = el.title || (el.getAttribute && el.getAttribute("title")) || "";
        const name = el.name || (el.getAttribute && el.getAttribute("name")) || "";
        if (type === "submit" || type === "button" || type === "reset") {
          return this._cleanText(val || placeholder || title || "Button");
        }
        return this._cleanText(placeholder || val || title || name || "");
      }
      if (t === "textarea") {
        const placeholder = el.placeholder || (el.getAttribute && el.getAttribute("placeholder")) || "";
        const val = el.value !== undefined && el.value !== null ? el.value : ((el.getAttribute && el.getAttribute("value")) || "");
        const name = el.name || (el.getAttribute && el.getAttribute("name")) || "";
        return this._cleanText(val || placeholder || el.textContent || name || "");
      }
      if (t === "select") {
        if (el.selectedOptions && el.selectedOptions.length > 0) {
          return this._cleanText(el.selectedOptions[0].textContent || el.value || "");
        }
        return this._cleanText(el.value || el.title || el.name || "");
      }

      const raw = el.innerText !== undefined ? el.innerText : el.textContent;
      if (raw && raw.trim()) return this._cleanText(raw);

      const title = el.getAttribute ? el.getAttribute("title") : null;
      if (title && title.trim()) return this._cleanText(title);

      const img = el.querySelector ? el.querySelector("img[alt]") : null;
      if (img && img.alt && img.alt.trim()) return this._cleanText(img.alt);

      return "";
    }

    // Attributes branch
    const attrs = elementOrAttrs || {};
    if (attrs["aria-label"] && attrs["aria-label"].trim()) {
      return this._cleanText(attrs["aria-label"]);
    }
    if (tag === "input") {
      const type = (attrs.type || "text").toLowerCase();
      if (type === "submit" || type === "button" || type === "reset") {
        return this._cleanText(attrs.value || attrs.placeholder || attrs.title || "Button");
      }
      return this._cleanText(attrs.placeholder || attrs.value || attrs.title || attrs.name || "");
    }
    if (tag === "textarea") {
      return this._cleanText(attrs.value || innerText || attrs.placeholder || attrs.name || "");
    }
    if (tag === "select") {
      return this._cleanText(innerText || attrs.name || "");
    }

    if (innerText && innerText.trim()) {
      return this._cleanText(innerText);
    }
    if (attrs.title && attrs.title.trim()) {
      return this._cleanText(attrs.title);
    }
    if (attrs.name && attrs.name.trim()) {
      return this._cleanText(attrs.name);
    }

    return "";
  }

  _cleanText(str) {
    if (!str) return "";
    const cleaned = String(str)
      .replace(/<[^>]+>/g, " ")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length > this.maxTextLength) {
      return cleaned.slice(0, this.maxTextLength - 1) + "…";
    }
    return cleaned;
  }

  /**
   * Build unique or specific CSS selector for element.
   */
  generateSelector(element, root = null) {
    if (!element || element.nodeType !== 1) return "";

    if (element.id && typeof element.id === "string") {
      const id = element.id.trim();
      if (id && !/\s/.test(id)) {
        return `#${id}`;
      }
    }

    const tag = (element.tagName || "").toLowerCase();
    const name = element.getAttribute ? element.getAttribute("name") : null;
    if (name && ["input", "textarea", "select", "button"].includes(tag)) {
      return `${tag}[name="${name}"]`;
    }

    if (element.classList && element.classList.length > 0) {
      const firstClass = element.classList[0];
      if (firstClass && !/\s/.test(firstClass)) {
        return `${tag}.${firstClass}`;
      }
    }

    if (element.parentElement) {
      const siblings = Array.from(element.parentElement.children).filter(el => el.tagName === element.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(element) + 1;
        return `${tag}:nth-of-type(${idx})`;
      }
    }

    return tag;
  }

  /**
   * Extract bounding rectangle for element.
   */
  getRect(element, index = 0) {
    if (element && typeof element.getBoundingClientRect === "function") {
      try {
        const r = element.getBoundingClientRect();
        const width = Math.round(r.width || 0);
        const height = Math.round(r.height || 0);
        const x = Math.round(r.x !== undefined ? r.x : (r.left || 0));
        const y = Math.round(r.y !== undefined ? r.y : (r.top || 0));
        return { x, y, width, height, w: width, h: height };
      } catch {
        // Fallback
      }
    }
    // Deterministic synthetic rect
    const w = 100;
    const h = 32;
    const x = 20;
    const y = 40 + index * 36;
    return { x, y, width: w, height: h, w, h };
  }

  /**
   * Main distillation entrypoint.
   * Walks DOM node tree or parses HTML string, labels interactive elements,
   * inspects shadow DOM, filters hidden elements.
   *
   * @param {Document|Element|string} target - DOM tree or HTML string
   * @param {Object} options - Options
   * @returns {Array<Object>} Distilled interactive elements with labels
   */
  distill(target, options = {}) {
    if (!target) return [];

    // Branch A: Real DOM Document or Element
    if (typeof target === "object" && (target.nodeType === 1 || target.nodeType === 9 || target.body)) {
      return this._distillDom(target, options);
    }

    // Branch B: HTML string
    if (typeof target === "string") {
      return this._distillHtmlString(target, options);
    }

    return [];
  }

  /**
   * Distill real DOM tree (fast single-pass DFS with shadow root traversal).
   */
  _distillDom(rootNode, options = {}) {
    const doc = rootNode.nodeType === 9 ? rootNode : (rootNode.ownerDocument || (typeof document !== "undefined" ? document : null));
    const startNode = rootNode.nodeType === 9 ? (rootNode.body || rootNode.documentElement) : rootNode;
    if (!startNode) return [];

    const elements = [];
    let currentIndex = 0;

    const walk = (node, inShadow = false, shadowHost = null) => {
      if (!node || node.nodeType !== 1) return;

      const tag = (node.tagName || "").toLowerCase();
      if (SKIP_TAGS.has(tag)) return;

      // Filter hidden node and skip entire subtree
      if (!this.isVisible(node)) return;

      // Check if current node is interactive
      if (this.isInteractive(node)) {
        const label = generateLabel(currentIndex);
        const rect = this.getRect(node, currentIndex);
        const selector = this.generateSelector(node, startNode);
        const role = this.getRole(tag, {
          role: node.getAttribute ? node.getAttribute("role") : null,
          href: node.getAttribute ? node.getAttribute("href") : node.href,
          type: node.type || (node.getAttribute ? node.getAttribute("type") : null),
          onclick: (node.getAttribute && node.getAttribute("onclick")) || node.onclick,
          contenteditable: node.isContentEditable || (node.getAttribute && node.getAttribute("contenteditable"))
        });
        const text = this.extractText(node, tag);
        const ariaLabel = node.getAttribute ? node.getAttribute("aria-label") : null;
        const id = node.id || null;
        const name = (node.getAttribute && node.getAttribute("name")) || node.name || null;
        const type = tag === "input" ? (node.type || "text") : null;
        const value = (tag === "input" || tag === "textarea" || tag === "select") ? (node.value !== undefined ? String(node.value) : "") : null;
        const href = tag === "a" ? ((node.getAttribute && node.getAttribute("href")) || node.href || null) : null;

        elements.push({
          label,
          tag,
          text,
          role: role || tag,
          selector: inShadow && shadowHost ? `${shadowHost} >>> ${selector}` : selector,
          rect,
          visible: true,
          ariaLabel,
          id,
          name,
          type,
          value,
          href,
          disabled: false,
          inShadow,
          shadowHost: shadowHost || null,
          element: node
        });

        currentIndex++;
      }

      // Inspect Shadow DOM
      if (node.shadowRoot) {
        const hostSelector = this.generateSelector(node, startNode);
        const shadowChildren = node.shadowRoot.children || node.shadowRoot.childNodes;
        for (let i = 0; i < shadowChildren.length; i++) {
          walk(shadowChildren[i], true, hostSelector);
        }
      }

      // Traverse light DOM child nodes
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) {
        walk(children[i], inShadow, shadowHost);
      }
    };

    walk(startNode, false, null);
    return elements;
  }

  /**
   * Distill HTML string sequentially in document order without browser DOM dependency.
   */
  _distillHtmlString(html, options = {}) {
    if (!html || typeof html !== "string") return [];

    const elements = [];
    let currentIndex = 0;

    // Fast-strip scripts and styles
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Track tag counts for nth-of-type selectors
    const tagCounts = Object.create(null);

    // Regex for opening or void tags: <tag attr1="val" ...>
    const tagRegex = /<([a-zA-Z0-9:-]+)((?:\s+[^>]*?)?)\/?>/gi;
    let match;

    while ((match = tagRegex.exec(cleanHtml)) !== null) {
      const fullMatch = match[0];
      const tag = match[1].toLowerCase();
      const rawAttrs = match[2] || "";
      const matchIndex = match.index;

      if (SKIP_TAGS.has(tag)) continue;

      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      const count = tagCounts[tag];

      // Parse attributes
      const attrs = this._parseAttributes(rawAttrs);

      // Check if inside a template shadowroot
      const inShadow = this._isInsideShadowRoot(cleanHtml, matchIndex);

      // Visibility check
      if (!this.isVisible(attrs)) continue;

      // Check if ancestor is aria-hidden in string
      if (this._isDescendantOfHidden(cleanHtml, matchIndex)) continue;

      // Interactive check
      if (!this.isInteractive(tag, attrs)) continue;

      // Extract inner text if closing tag exists
      let innerText = "";
      if (!fullMatch.endsWith("/>") && tag !== "input" && tag !== "img") {
        const closeTag = `</${tag}>`;
        const closeIdx = cleanHtml.indexOf(closeTag, matchIndex + fullMatch.length);
        if (closeIdx !== -1 && closeIdx - matchIndex < 10000) {
          innerText = cleanHtml.slice(matchIndex + fullMatch.length, closeIdx);
        }
      }

      const label = generateLabel(currentIndex);
      const role = this.getRole(tag, attrs) || tag;
      const text = this.extractText(attrs, tag, innerText);
      const ariaLabel = attrs["aria-label"] || null;
      const id = attrs.id || null;
      const name = attrs.name || null;
      const type = tag === "input" ? (attrs.type || "text") : null;
      const value = attrs.value !== undefined ? String(attrs.value) : (tag === "textarea" ? innerText.trim() : null);
      const href = attrs.href || null;

      // Selector
      let selector;
      if (id) {
        selector = `#${id}`;
      } else if (name && ["input", "textarea", "select", "button"].includes(tag)) {
        selector = `${tag}[name="${name}"]`;
      } else if (attrs.class) {
        const firstClass = attrs.class.trim().split(/\s+/)[0];
        selector = firstClass ? `${tag}.${firstClass}` : `${tag}:nth-of-type(${count})`;
      } else {
        selector = `${tag}:nth-of-type(${count})`;
      }

      const rect = this.getRect(null, currentIndex);

      elements.push({
        label,
        tag,
        text,
        role,
        selector,
        rect,
        visible: true,
        ariaLabel,
        id,
        name,
        type,
        value,
        href,
        disabled: false,
        inShadow,
        shadowHost: inShadow ? attrs.shadowHost || "custom-element" : null
      });

      currentIndex++;
    }

    return elements;
  }

  _parseAttributes(rawAttrs) {
    const attrs = Object.create(null);
    if (!rawAttrs) return attrs;

    const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = attrRegex.exec(rawAttrs)) !== null) {
      const name = m[1].toLowerCase();
      const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ""));
      attrs[name] = val;
    }
    return attrs;
  }

  _isInsideShadowRoot(html, index) {
    const prefix = html.slice(0, index);
    const lastTemplateOpen = prefix.lastIndexOf("<template");
    if (lastTemplateOpen === -1) return false;

    const lastTemplateClose = prefix.lastIndexOf("</template>");
    if (lastTemplateClose > lastTemplateOpen) return false;

    const templateTag = prefix.slice(lastTemplateOpen);
    return /shadowroot(?:mode)?=["']open["']/i.test(templateTag);
  }

  _isDescendantOfHidden(html, index) {
    const prefix = html.slice(0, index);
    const lastAriaHiddenOpen = prefix.lastIndexOf("aria-hidden=\"true\"");
    if (lastAriaHiddenOpen === -1) return false;

    // Check if tag containing aria-hidden was closed before this index
    const openTagStart = prefix.lastIndexOf("<", lastAriaHiddenOpen);
    if (openTagStart === -1) return false;
    const tagMatch = prefix.slice(openTagStart).match(/^<([a-zA-Z0-9:-]+)/);
    if (!tagMatch) return false;

    const parentTag = tagMatch[1].toLowerCase();
    const closeTag = `</${parentTag}>`;
    const lastParentClose = prefix.lastIndexOf(closeTag);

    // If parent has not been closed, element is a child of aria-hidden container
    return lastParentClose < openTagStart;
  }
}

/**
 * Convenience distillation function.
 */
function distill(target, options = {}) {
  const distiller = new DomDistiller(options);
  return distiller.distill(target, options);
}

module.exports = {
  DomDistiller,
  distill,
  generateLabel,
  parseLabel
};
