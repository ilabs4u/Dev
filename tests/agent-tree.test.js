const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  DomDistiller,
  distill,
  generateLabel,
  parseLabel,
  AgentTreeOverlay,
  defaultOverlay,
  setupAgentTree
} = require("../src/dev/agent-tree");
const { BrowserContext, McpProtocolHandler, PermissionManager } = require("../src/dev/mcp-server");
const { KeymapManager, MODES } = require("../src/dev/lua-engine/keymap");
const { VimController } = require("../src/dev/vim-mode/vim-controller");

// Helper: Lightweight Mock DOM node for testing real DOM tree operations in Node
class MockNode {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.childNodes = [];
    this.attributes = Object.create(null);
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.innerText = "";
    this.value = "";
    this.id = "";
    this.name = "";
    this.type = "";
    this.href = "";
    this.shadowRoot = null;
    this.parentElement = null;
    this.parentNode = null;
    this.listeners = new Map();
    this.rect = { x: 10, y: 20, width: 100, height: 32, top: 20, left: 10, right: 110, bottom: 52 };

    const self = this;
    this.classList = {
      _classes: new Set(),
      add(c) { self.classList._classes.add(c); },
      remove(c) { self.classList._classes.delete(c); },
      contains(c) { return self.classList._classes.has(c); },
      get length() { return self.classList._classes.size; },
      get 0() { return Array.from(self.classList._classes)[0]; }
    };
  }

  get className() {
    return Array.from(this.classList._classes).join(" ");
  }

  set className(val) {
    this.classList._classes.clear();
    String(val || "").trim().split(/\s+/).forEach(c => c && this.classList.add(c));
  }

  getAttribute(name) {
    const key = name.toLowerCase();
    if (key === "id") return this.id || null;
    if (key === "name") return this.name || null;
    if (key === "type") return this.type || null;
    if (key === "href") return this.href || null;
    if (key === "hidden") return this.hidden ? "" : null;
    if (key === "disabled") return this.disabled ? "" : null;
    return this.attributes[key] !== undefined ? this.attributes[key] : null;
  }

  setAttribute(name, val) {
    const key = name.toLowerCase();
    const strVal = String(val);
    this.attributes[key] = strVal;
    if (key === "id") this.id = strVal;
    if (key === "name") this.name = strVal;
    if (key === "type") this.type = strVal;
    if (key === "href") this.href = strVal;
    if (key === "hidden") this.hidden = true;
    if (key === "disabled") this.disabled = true;
    if (key === "class") {
      this.classList._classes.clear();
      strVal.trim().split(/\s+/).forEach(c => c && this.classList.add(c));
    }
  }

  hasAttribute(name) {
    const key = name.toLowerCase();
    if (key === "id") return Boolean(this.id);
    if (key === "name") return Boolean(this.name);
    if (key === "type") return Boolean(this.type);
    if (key === "href") return Boolean(this.href);
    if (key === "hidden") return this.hidden;
    if (key === "disabled") return this.disabled;
    return this.attributes[key] !== undefined;
  }

  removeAttribute(name) {
    const key = name.toLowerCase();
    delete this.attributes[key];
    if (key === "id") this.id = "";
    if (key === "hidden") this.hidden = false;
    if (key === "disabled") this.disabled = false;
  }

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      this.childNodes.splice(idx, 1);
      child.parentElement = null;
      child.parentNode = null;
    }
    return child;
  }

  attachShadow(options = { mode: "open" }) {
    const shadow = new MockNode("#shadow-root");
    shadow.nodeType = 11; // DocumentFragment
    shadow.mode = options.mode;
    shadow.host = this;
    this.shadowRoot = shadow;
    return shadow;
  }

  getBoundingClientRect() {
    return { ...this.rect };
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners.has(type)) {
      const list = this.listeners.get(type).filter(cb => cb !== fn);
      this.listeners.set(type, list);
    }
  }

  click() {
    this.clicked = true;
    const handlers = this.listeners.get("click") || [];
    handlers.forEach(h => h({ stopPropagation: () => {}, target: this }));
    if (typeof this.onclick === "function") {
      this.onclick({ stopPropagation: () => {}, target: this });
    }
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach(h => h(event));
    return true;
  }

  getElementById(id) {
    const search = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(this);
  }

  querySelector(sel) {
    // Basic tag / id / attr matcher
    const match = (node) => {
      if (sel.startsWith("#") && node.id === sel.slice(1)) return node;
      if (node.tagName.toLowerCase() === sel.toLowerCase()) return node;
      if (sel === "img[alt]" && node.tagName === "IMG" && node.alt) return node;
      for (const child of node.children) {
        const f = match(child);
        if (f) return f;
      }
      return null;
    };
    return match(this);
  }
}

class MockDocument extends MockNode {
  constructor() {
    super("#document");
    this.nodeType = 9;
    this.head = new MockNode("head");
    this.body = new MockNode("body");
    this.appendChild(this.head);
    this.appendChild(this.body);
  }

  createElement(tag) {
    return new MockNode(tag);
  }

  getElementById(id) {
    return super.getElementById(id);
  }
}

describe("Phase 2B: Agent Tree (Distilled DOM)", () => {
  // ==========================================
  // 1. Label Generation & Bijective Indexing
  // ==========================================
  describe("Label Generation & Parsing", () => {
    it("generates bijective base-26 single character labels A through Z", () => {
      assert.equal(generateLabel(0), "A");
      assert.equal(generateLabel(1), "B");
      assert.equal(generateLabel(25), "Z");
    });

    it("generates multi-character labels correctly for rollover boundaries", () => {
      assert.equal(generateLabel(26), "AA");
      assert.equal(generateLabel(27), "AB");
      assert.equal(generateLabel(51), "AZ");
      assert.equal(generateLabel(52), "BA");
      assert.equal(generateLabel(701), "ZZ");
      assert.equal(generateLabel(702), "AAA");
      assert.equal(generateLabel(703), "AAB");
    });

    it("parses label string back to exact 0-based index", () => {
      assert.equal(parseLabel("A"), 0);
      assert.equal(parseLabel("B"), 1);
      assert.equal(parseLabel("Z"), 25);
      assert.equal(parseLabel("AA"), 26);
      assert.equal(parseLabel("AB"), 27);
      assert.equal(parseLabel("AZ"), 51);
      assert.equal(parseLabel("BA"), 52);
      assert.equal(parseLabel("ZZ"), 701);
      assert.equal(parseLabel("AAA"), 702);
    });

    it("parses labels case-insensitively and handles whitespace", () => {
      assert.equal(parseLabel("a"), 0);
      assert.equal(parseLabel("aa"), 26);
      assert.equal(parseLabel("  b  "), 1);
      assert.equal(parseLabel("\tZZ\n"), 701);
    });

    it("returns -1 for invalid labels and empty string for invalid indices", () => {
      assert.equal(parseLabel(""), -1);
      assert.equal(parseLabel(null), -1);
      assert.equal(parseLabel("123"), -1);
      assert.equal(parseLabel("A1"), -1);
      assert.equal(parseLabel("A B"), -1);

      assert.equal(generateLabel(-1), "");
      assert.equal(generateLabel(null), "");
      assert.equal(generateLabel(NaN), "");
    });

    it("verifies roundtrip identity parseLabel(generateLabel(n)) === n for 1000 items", () => {
      for (let i = 0; i < 1000; i++) {
        const lbl = generateLabel(i);
        const idx = parseLabel(lbl);
        assert.equal(idx, i, `Mismatch at index ${i} with label ${lbl}`);
      }
    });
  });

  // ==========================================
  // 2. Distillation Accuracy (HTML Strings)
  // ==========================================
  describe("DOM Distillation Accuracy (HTML String Mode)", () => {
    it("distills standard interactive elements in document order", () => {
      const html = `
        <div>
          <a href="/login" id="login-link">Log In</a>
          <button id="signup-btn">Sign Up</button>
          <input type="text" id="username" placeholder="Enter username" />
          <textarea id="bio" placeholder="About you"></textarea>
          <select id="country" name="country">
            <option value="US">USA</option>
          </select>
          <summary id="faq-summary">Frequently Asked Questions</summary>
        </div>
      `;

      const elements = distill(html);
      assert.equal(elements.length, 6);

      // Verify sequential labels
      assert.equal(elements[0].label, "A");
      assert.equal(elements[0].tag, "a");
      assert.equal(elements[0].role, "link");
      assert.equal(elements[0].id, "login-link");
      assert.equal(elements[0].selector, "#login-link");
      assert.equal(elements[0].text, "Log In");

      assert.equal(elements[1].label, "B");
      assert.equal(elements[1].tag, "button");
      assert.equal(elements[1].role, "button");
      assert.equal(elements[1].id, "signup-btn");
      assert.equal(elements[1].selector, "#signup-btn");
      assert.equal(elements[1].text, "Sign Up");

      assert.equal(elements[2].label, "C");
      assert.equal(elements[2].tag, "input");
      assert.equal(elements[2].role, "textbox");
      assert.equal(elements[2].id, "username");
      assert.equal(elements[2].text, "Enter username");

      assert.equal(elements[3].label, "D");
      assert.equal(elements[3].tag, "textarea");
      assert.equal(elements[3].role, "textbox");
      assert.equal(elements[3].id, "bio");

      assert.equal(elements[4].label, "E");
      assert.equal(elements[4].tag, "select");
      assert.equal(elements[4].role, "combobox");
      assert.equal(elements[4].id, "country");

      assert.equal(elements[5].label, "F");
      assert.equal(elements[5].tag, "summary");
      assert.equal(elements[5].role, "button");
      assert.equal(elements[5].id, "faq-summary");
    });

    it("identifies ARIA interactive roles on non-button elements", () => {
      const html = `
        <div role="button" id="custom-btn">Custom Button</div>
        <span role="checkbox" id="agree-check" aria-checked="false">I Agree</span>
        <div role="tab" id="tab-profile">Profile</div>
        <div role="combobox" id="search-select">Options</div>
        <div role="searchbox" id="global-search">Search</div>
      `;

      const elements = distill(html);
      assert.equal(elements.length, 5);

      assert.equal(elements[0].role, "button");
      assert.equal(elements[0].id, "custom-btn");
      assert.equal(elements[1].role, "checkbox");
      assert.equal(elements[2].role, "tab");
      assert.equal(elements[3].role, "combobox");
      assert.equal(elements[4].role, "searchbox");
    });

    it("identifies elements with onclick, contenteditable, and tabindex", () => {
      const html = `
        <div onclick="performAction()" id="div-click">Clickable Div</div>
        <div contenteditable="true" id="editor">Rich Text Editor Content</div>
        <div tabindex="0" id="card-focus">Focusable Card</div>
      `;

      const elements = distill(html);
      assert.equal(elements.length, 3);
      assert.equal(elements[0].id, "div-click");
      assert.equal(elements[0].role, "button");
      assert.equal(elements[1].id, "editor");
      assert.equal(elements[1].role, "textbox");
      assert.equal(elements[2].id, "card-focus");
    });

    it("prioritizes aria-label over inner text for accessible labeling", () => {
      const html = `
        <button id="close-btn" aria-label="Close dialog">×</button>
        <input type="text" id="query" aria-label="Site Search Query" placeholder="Search..." />
      `;

      const elements = distill(html);
      assert.equal(elements[0].text, "Close dialog");
      assert.equal(elements[0].ariaLabel, "Close dialog");
      assert.equal(elements[1].text, "Site Search Query");
      assert.equal(elements[1].ariaLabel, "Site Search Query");
    });

    it("ignores non-interactive structural elements and anchors without href", () => {
      const html = `
        <header><h1>Dashboard</h1></header>
        <p>Paragraph text with <b>bold</b> and <i>italic</i> formatting.</p>
        <a id="named-anchor">Named Anchor No Href</a>
        <div class="card"><span class="badge">Static Badge</span></div>
      `;

      const elements = distill(html);
      assert.equal(elements.length, 0);
    });

    it("generates structured selectors (ID, name, class, nth-of-type)", () => {
      const html = `
        <button id="submit">Submit</button>
        <input type="text" name="email_address" />
        <button class="btn-primary">Primary</button>
        <button>Generic 1</button>
        <button>Generic 2</button>
      `;

      const elements = distill(html);
      assert.equal(elements[0].selector, "#submit");
      assert.equal(elements[1].selector, 'input[name="email_address"]');
      assert.equal(elements[2].selector, "button.btn-primary");
      assert.ok(elements[3].selector.includes("button:nth-of-type"));
      assert.ok(elements[4].selector.includes("button:nth-of-type"));
    });

    it("returns empty array for empty, whitespace, or null target", () => {
      assert.deepEqual(distill(""), []);
      assert.deepEqual(distill("   \n\t  "), []);
      assert.deepEqual(distill(null), []);
      assert.deepEqual(distill(undefined), []);
    });
  });

  // ==========================================
  // 3. DOM Node Distillation & Semantics
  // ==========================================
  describe("DOM Node Distillation & Real Object Inspection", () => {
    it("walks mock DOM node hierarchy and extracts interactive elements", () => {
      const doc = new MockDocument();

      const btn = doc.createElement("button");
      btn.id = "doc-btn";
      btn.textContent = "Click Me";
      btn.rect = { x: 50, y: 120, width: 90, height: 35 };

      const input = doc.createElement("input");
      input.type = "password";
      input.id = "pass";
      input.setAttribute("placeholder", "Enter Password");
      input.rect = { x: 50, y: 170, width: 200, height: 40 };

      doc.body.appendChild(btn);
      doc.body.appendChild(input);

      const elements = distill(doc);
      assert.equal(elements.length, 2);

      assert.equal(elements[0].label, "A");
      assert.equal(elements[0].id, "doc-btn");
      assert.equal(elements[0].rect.x, 50);
      assert.equal(elements[0].rect.y, 120);
      assert.equal(elements[0].rect.width, 90);
      assert.equal(elements[0].rect.w, 90);
      assert.equal(elements[0].element, btn);

      assert.equal(elements[1].label, "B");
      assert.equal(elements[1].id, "pass");
      assert.equal(elements[1].text, "Enter Password");
      assert.equal(elements[1].element, input);
    });

    it("attaches actual DOM element reference and allows calling click()", () => {
      const doc = new MockDocument();
      const btn = doc.createElement("button");
      btn.id = "clickable-btn";
      btn.textContent = "Pay Now";
      let clicked = false;
      btn.addEventListener("click", () => {
        clicked = true;
      });
      doc.body.appendChild(btn);

      const elements = distill(doc);
      assert.equal(elements.length, 1);
      assert.equal(clicked, false);

      elements[0].element.click();
      assert.equal(clicked, true);
    });
  });

  // ==========================================
  // 4. Shadow DOM Inspection
  // ==========================================
  describe("Shadow DOM Inspection", () => {
    it("inspects open shadowRoot in DOM mode and flags inShadow: true", () => {
      const doc = new MockDocument();

      const host = doc.createElement("user-card");
      host.id = "user-profile-card";
      doc.body.appendChild(host);

      const shadow = host.attachShadow({ mode: "open" });
      const shadowBtn = doc.createElement("button");
      shadowBtn.id = "edit-profile-btn";
      shadowBtn.textContent = "Edit Profile";
      shadow.appendChild(shadowBtn);

      const elements = distill(doc);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].label, "A");
      assert.equal(elements[0].id, "edit-profile-btn");
      assert.equal(elements[0].inShadow, true);
      assert.equal(elements[0].shadowHost, "#user-profile-card");
      assert.ok(elements[0].selector.includes(">>> #edit-profile-btn"));
    });

    it("recursively inspects nested shadow roots", () => {
      const doc = new MockDocument();

      const outerHost = doc.createElement("outer-component");
      outerHost.id = "outer";
      doc.body.appendChild(outerHost);

      const outerShadow = outerHost.attachShadow({ mode: "open" });
      const innerHost = doc.createElement("inner-component");
      innerHost.id = "inner";
      outerShadow.appendChild(innerHost);

      const innerShadow = innerHost.attachShadow({ mode: "open" });
      const deepBtn = doc.createElement("button");
      deepBtn.id = "deep-action";
      deepBtn.textContent = "Deep Shadow Action";
      innerShadow.appendChild(deepBtn);

      const elements = distill(doc);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "deep-action");
      assert.equal(elements[0].inShadow, true);
    });

    it("handles HTML string template shadowrootmode='open'", () => {
      const html = `
        <custom-widget id="weather-widget">
          <template shadowrootmode="open">
            <button id="refresh-weather">Refresh</button>
            <input type="text" id="city-input" placeholder="Search City" />
          </template>
        </custom-widget>
        <button id="regular-btn">Normal Page Button</button>
      `;

      const elements = distill(html);
      assert.equal(elements.length, 3);

      assert.equal(elements[0].id, "refresh-weather");
      assert.equal(elements[0].inShadow, true);

      assert.equal(elements[1].id, "city-input");
      assert.equal(elements[1].inShadow, true);

      assert.equal(elements[2].id, "regular-btn");
      assert.equal(elements[2].inShadow, false);
    });
  });

  // ==========================================
  // 5. Visibility & Hidden Element Filtering
  // ==========================================
  describe("Visibility & Hidden Element Filtering", () => {
    it("filters elements with hidden attribute", () => {
      const html = `
        <button id="btn1" hidden>Hidden Button</button>
        <button id="btn2">Visible Button</button>
      `;
      const elements = distill(html);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "btn2");
    });

    it("filters elements with aria-hidden='true'", () => {
      const html = `
        <button id="btn-aria-hidden" aria-hidden="true">Aria Hidden</button>
        <button id="btn-visible">Visible</button>
      `;
      const elements = distill(html);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "btn-visible");
    });

    it("filters descendants of containers with aria-hidden='true'", () => {
      const html = `
        <div aria-hidden="true">
          <button id="nested-btn">Nested Inside Aria Hidden</button>
          <a href="/test" id="nested-link">Nested Link</a>
        </div>
        <button id="outside-btn">Outside</button>
      `;
      const elements = distill(html);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "outside-btn");
    });

    it("filters elements with display:none and visibility:hidden styles", () => {
      const html = `
        <button id="disp-none" style="display: none">No Display</button>
        <button id="vis-hidden" style="visibility: hidden">Hidden Vis</button>
        <button id="op-zero" style="opacity: 0">Zero Opacity</button>
        <button id="active-btn" style="display: inline-block; opacity: 1">Active</button>
      `;
      const elements = distill(html);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "active-btn");
    });

    it("filters input type='hidden'", () => {
      const html = `
        <input type="hidden" name="csrf_token" value="abc123xyz" />
        <input type="text" id="visible-input" name="search" />
      `;
      const elements = distill(html);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "visible-input");
    });

    it("filters disabled interactive elements", () => {
      const html = `
        <button id="btn-disabled" disabled>Disabled Button</button>
        <input type="text" id="input-disabled" disabled value="readonly" />
        <select id="select-disabled" disabled><option>Choice</option></select>
        <button id="btn-enabled">Enabled Button</button>
      `;
      const elements = distill(html);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "btn-enabled");
    });

    it("filters elements with zero bounding rect dimensions in DOM mode", () => {
      const doc = new MockDocument();

      const zeroBtn = doc.createElement("button");
      zeroBtn.id = "zero-size-btn";
      zeroBtn.rect = { x: 0, y: 0, width: 0, height: 0 };

      const normalBtn = doc.createElement("button");
      normalBtn.id = "normal-btn";
      normalBtn.rect = { x: 10, y: 10, width: 100, height: 30 };

      doc.body.appendChild(zeroBtn);
      doc.body.appendChild(normalBtn);

      const elements = distill(doc);
      assert.equal(elements.length, 1);
      assert.equal(elements[0].id, "normal-btn");
    });
  });

  // ==========================================
  // 6. Visual Overlay Lifecycle & Interaction
  // ==========================================
  describe("Visual Overlay Lifecycle & Badge Rendering", () => {
    let overlay;
    let doc;

    beforeEach(() => {
      doc = new MockDocument();
      overlay = new AgentTreeOverlay();
    });

    afterEach(() => {
      if (overlay) overlay.destroy();
    });

    it("mounts overlay container and injects stylesheet into document", () => {
      const container = overlay.mount(doc);
      assert.ok(container);
      assert.equal(container.id, "dev-agent-tree-overlay");
      assert.equal(overlay.mounted, true);

      // Stylesheet check
      const styleEl = doc.head.getElementById("dev-agent-tree-styles");
      assert.ok(styleEl, "Overlay CSS should be injected into head");
    });

    it("renders badges for elements on show() and updates visibility", () => {
      overlay.mount(doc);

      const btn = doc.createElement("button");
      btn.id = "action-btn";
      btn.textContent = "Submit Form";
      btn.rect = { x: 40, y: 80, width: 120, height: 35 };
      doc.body.appendChild(btn);

      const count = overlay.show([
        {
          label: "A",
          tag: "button",
          role: "button",
          selector: "#action-btn",
          rect: { x: 40, y: 80, width: 120, height: 35 },
          text: "Submit Form",
          element: btn
        }
      ]);

      assert.equal(count, 1);
      assert.equal(overlay.visible, true);
      assert.equal(overlay.badges.length, 1);

      const badge = overlay.badges[0];
      assert.equal(badge.textContent, "A");
      assert.equal(badge.getAttribute("data-label"), "A");
      assert.equal(badge.style.left, "40px");
      assert.equal(badge.style.top, "80px");
      assert.equal(overlay.container.style.display, "block");
    });

    it("adds .in-shadow class to badges for elements inside shadow DOM", () => {
      overlay.mount(doc);

      overlay.show([
        {
          label: "A",
          tag: "button",
          role: "button",
          selector: "#shadow-btn",
          rect: { x: 10, y: 20 },
          inShadow: true
        }
      ]);

      assert.equal(overlay.badges.length, 1);
      assert.ok(overlay.badges[0].classList.contains("in-shadow"));
    });

    it("toggles overlay visibility between show and hide", () => {
      overlay.mount(doc);
      assert.equal(overlay.visible, false);

      const toggledOn = overlay.toggle([
        { label: "A", rect: { x: 10, y: 10 } }
      ]);
      assert.equal(toggledOn, true);
      assert.equal(overlay.visible, true);

      const toggledOff = overlay.toggle();
      assert.equal(toggledOff, false);
      assert.equal(overlay.visible, false);
      assert.equal(overlay.container.style.display, "none");
    });

    it("cleans up DOM container and style on destroy()", () => {
      overlay.mount(doc);
      assert.ok(doc.getElementById("dev-agent-tree-overlay"));
      assert.ok(doc.head.getElementById("dev-agent-tree-styles"));

      overlay.destroy();
      assert.equal(overlay.mounted, false);
      assert.equal(overlay.visible, false);
      assert.equal(overlay.container, null);
      assert.equal(doc.getElementById("dev-agent-tree-overlay"), null);
      assert.equal(doc.head.getElementById("dev-agent-tree-styles"), null);
    });

    it("triggers target element click when badge is clicked", () => {
      overlay.mount(doc);

      const target = doc.createElement("button");
      let clicked = false;
      target.addEventListener("click", () => {
        clicked = true;
      });

      overlay.show([
        {
          label: "A",
          tag: "button",
          selector: "#my-target",
          rect: { x: 10, y: 10 },
          element: target
        }
      ]);

      assert.equal(clicked, false);
      overlay.badges[0].click();
      assert.equal(clicked, true);
    });

    it("triggers custom onSelect callback when provided", () => {
      let selectedItem = null;
      const customOverlay = new AgentTreeOverlay({
        onSelect: (item) => {
          selectedItem = item;
        }
      });
      customOverlay.mount(doc);

      const testItem = { label: "B", tag: "a", selector: "#link", rect: { x: 20, y: 20 } };
      customOverlay.show([testItem]);

      customOverlay.badges[0].click();
      assert.equal(selectedItem, testItem);
      customOverlay.destroy();
    });

    it("setupAgentTree initializes overlay on window document", () => {
      const mockWin = { document: doc };
      const tree = setupAgentTree(mockWin);
      assert.ok(tree instanceof AgentTreeOverlay);
      assert.equal(tree.mounted, true);
      tree.destroy();
    });
  });

  // ==========================================
  // 7. Vim Mode & Keymap Integration (<leader>at)
  // ==========================================
  describe("Vim Mode & Keymap Integration (<leader>at)", () => {
    let km;
    let controller;
    let overlayMock;

    beforeEach(() => {
      km = new KeymapManager();
      overlayMock = {
        visible: false,
        toggle() {
          this.visible = !this.visible;
          return this.visible;
        }
      };
      controller = new VimController({
        keymap: km,
        agentTreeOverlay: overlayMock
      });
    });

    it("configures <leader>at in keymap defaults for toggle_agent_tree", () => {
      const mapping = km.get("n", "<leader>at");
      assert.ok(mapping, "<leader>at must be registered in normal mode");
      assert.equal(mapping.action, "toggle_agent_tree");
    });

    it("executes toggle_agent_tree when <leader>at sequence is pressed", () => {
      assert.equal(overlayMock.visible, false);

      // Press leader '\'
      const ev1 = { key: "\\", preventDefault: () => {} };
      const res1 = km.handleKeyEvent(ev1);
      assert.equal(res1.handled, true);
      assert.equal(res1.action, "buffering_sequence");

      // Press 'a'
      const ev2 = { key: "a", preventDefault: () => {} };
      const res2 = km.handleKeyEvent(ev2);
      assert.equal(res2.handled, true);
      assert.equal(res2.action, "buffering_sequence");

      // Press 't'
      const ev3 = { key: "t", preventDefault: () => {} };
      const res3 = km.handleKeyEvent(ev3);
      assert.equal(res3.handled, true);
      assert.equal(res3.action, "toggle_agent_tree");

      // Verify overlay was toggled
      assert.equal(overlayMock.visible, true);

      // Press sequence again to toggle off
      km.handleKeyEvent({ key: "\\", preventDefault: () => {} });
      km.handleKeyEvent({ key: "a", preventDefault: () => {} });
      km.handleKeyEvent({ key: "t", preventDefault: () => {} });
      assert.equal(overlayMock.visible, false);
    });

    it("delegates to browserDelegate.toggleAgentTree when no explicit overlay passed", () => {
      let delegateToggled = false;
      const km2 = new KeymapManager();
      const ctrl2 = new VimController({
        keymap: km2,
        browserDelegate: {
          toggleAgentTree: () => {
            delegateToggled = true;
            return true;
          }
        }
      });

      km2.handleKeyEvent({ key: "\\", preventDefault: () => {} });
      km2.handleKeyEvent({ key: "a", preventDefault: () => {} });
      km2.handleKeyEvent({ key: "t", preventDefault: () => {} });

      assert.equal(delegateToggled, true);
    });
  });

  // ==========================================
  // 8. MCP Server Integration End-to-End
  // ==========================================
  describe("MCP Server Integration with Agent Tree", () => {
    let context;
    let permissions;
    let handler;

    beforeEach(() => {
      context = new BrowserContext({
        initialUrl: "https://agent-tree-test.com"
      });

      context.setTabContent(`
        <html>
          <body>
            <nav>
              <a href="/home" id="nav-home">Home</a>
              <a href="/pricing" id="nav-pricing">Pricing</a>
            </nav>
            <main>
              <button id="primary-cta">Get Started Free</button>
              <input type="text" id="account-name" name="account" placeholder="Company Name" />
              <textarea id="notes" name="notes">Default notes</textarea>
            </main>
          </body>
        </html>
      `, 1, "Agent Tree Page");

      permissions = new PermissionManager({
        permissions: {
          allow_click: true,
          allow_form_fill: true
        }
      });

      handler = new McpProtocolHandler({ context, permissions });
    });

    it("get_interactive_elements returns distilled elements with sequential labels", async () => {
      const res = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 101,
        method: "tools/call",
        params: { name: "get_interactive_elements", arguments: {} }
      });

      assert.equal(res.result.isError, false);
      const elements = res.result.data;
      assert.equal(elements.length, 5);

      assert.equal(elements[0].label, "A");
      assert.equal(elements[0].id, "nav-home");

      assert.equal(elements[1].label, "B");
      assert.equal(elements[1].id, "nav-pricing");

      assert.equal(elements[2].label, "C");
      assert.equal(elements[2].id, "primary-cta");

      assert.equal(elements[3].label, "D");
      assert.equal(elements[3].id, "account-name");

      assert.equal(elements[4].label, "E");
      assert.equal(elements[4].id, "notes");
    });

    it("click tool executes click by Agent Tree label (e.g. label: 'C')", async () => {
      const clickRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 102,
        method: "tools/call",
        params: { name: "click", arguments: { label: "C" } }
      });

      assert.equal(clickRes.result.isError, false);
      assert.ok(clickRes.result.content[0].text.includes("Get Started Free"));
      assert.equal(clickRes.result.data.target.id, "primary-cta");
    });

    it("click tool is case-insensitive for Agent Tree labels (e.g. label: 'c')", async () => {
      const clickRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 103,
        method: "tools/call",
        params: { name: "click", arguments: { label: "c" } }
      });

      assert.equal(clickRes.result.isError, false);
      assert.equal(clickRes.result.data.target.id, "primary-cta");
    });

    it("fill tool updates input value by Agent Tree label (e.g. label: 'D')", async () => {
      const fillRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 104,
        method: "tools/call",
        params: {
          name: "fill",
          arguments: { label: "D", text: "Acme Corporation" }
        }
      });

      assert.equal(fillRes.result.isError, false);
      assert.ok(fillRes.result.content[0].text.includes("Acme Corporation"));

      const elements = await context.getInteractiveElements();
      const inputEl = elements.find(e => e.label === "D");
      assert.equal(inputEl.value, "Acme Corporation");
    });

    it("click and fill return isError: true with clear error when label does not exist", async () => {
      const clickRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 105,
        method: "tools/call",
        params: { name: "click", arguments: { label: "XYZ" } }
      });
      assert.equal(clickRes.result.isError, true);
      assert.ok(clickRes.result.content[0].text.includes("Element not found with Agent Tree label: XYZ"));

      const fillRes = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 106,
        method: "tools/call",
        params: { name: "fill", arguments: { label: "XYZ", text: "test" } }
      });
      assert.equal(fillRes.result.isError, true);
      assert.ok(fillRes.result.content[0].text.includes("Element not found with Agent Tree label: XYZ"));
    });
  });

  // ==========================================
  // 9. Performance Benchmark (<100ms)
  // ==========================================
  describe("Performance Benchmark (<100ms)", () => {
    it("distills a 500+ element page in well under 100ms", () => {
      // Build a realistic large DOM page with 600 interactive elements
      const chunks = [];
      chunks.push("<div id='container'>");
      for (let i = 0; i < 200; i++) {
        chunks.push(`
          <div class="row" id="row-${i}">
            <button id="btn-${i}" class="btn-action">Button ${i}</button>
            <a href="/item/${i}" id="link-${i}">Link ${i}</a>
            <input type="text" id="input-${i}" name="input_${i}" placeholder="Field ${i}" />
          </div>
        `);
      }
      chunks.push("</div>");
      const largeHtml = chunks.join("\n");

      const startTime = performance.now();
      const elements = distill(largeHtml);
      const durationMs = performance.now() - startTime;

      assert.equal(elements.length, 600, "Should extract exactly 600 interactive elements");
      assert.ok(
        durationMs < 100,
        `Distillation must execute in <100ms (actual: ${durationMs.toFixed(2)}ms)`
      );

      // Verify label progression through multi-character labels
      assert.equal(elements[0].label, "A");
      assert.equal(elements[25].label, "Z");
      assert.equal(elements[26].label, "AA");
      assert.equal(elements[51].label, "AZ");
      assert.equal(elements[52].label, "BA");
      assert.equal(elements[599].label, generateLabel(599));
    });

    it("distills 500+ mock DOM nodes in well under 100ms", () => {
      const doc = new MockDocument();
      for (let i = 0; i < 500; i++) {
        const btn = doc.createElement("button");
        btn.id = `perf-btn-${i}`;
        btn.textContent = `Action ${i}`;
        btn.rect = { x: 10, y: i * 30, width: 100, height: 25 };
        doc.body.appendChild(btn);
      }

      const startTime = performance.now();
      const elements = distill(doc);
      const durationMs = performance.now() - startTime;

      assert.equal(elements.length, 500);
      assert.ok(
        durationMs < 100,
        `DOM node distillation must execute in <100ms (actual: ${durationMs.toFixed(2)}ms)`
      );
    });
  });
});
