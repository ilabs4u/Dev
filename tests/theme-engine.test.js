/**
 * Tests for Theme Engine & Boost Manager (Task 3.4)
 * Validates built-in themes, CSS token injection, scheduled day/night switching,
 * per-domain Boost engine, and Lua bridge integration.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  THEMES,
  themeToCssVariables,
  ThemeManager,
  BoostManager,
  defaultThemeManager,
  defaultBoostManager
} = require("../src/dev/theme-engine");

const { DevLua } = require("../src/dev/lua-engine");

describe("Phase 3: Theme Engine Suite", () => {
  describe("Built-in Themes & CSS Token Generation", () => {
    it("defines all 7 required developer themes with color tokens", () => {
      const expectedThemes = [
        "gruvbox-dark",
        "catppuccin-mocha",
        "tokyo-night",
        "dracula",
        "nord",
        "one-dark",
        "light"
      ];

      for (const id of expectedThemes) {
        assert.ok(THEMES[id], `Theme ${id} must exist`);
        const t = THEMES[id];
        assert.equal(t.id, id);
        assert.ok(t.colors.bgPrimary, `${id} must have bgPrimary`);
        assert.ok(t.colors.textPrimary, `${id} must have textPrimary`);
        assert.ok(t.colors.accentPrimary, `${id} must have accentPrimary`);
        assert.ok(t.colors.borderColor, `${id} must have borderColor`);
      }
    });

    it("generates valid CSS variable block with design tokens", () => {
      const gruvbox = THEMES["gruvbox-dark"];
      const css = themeToCssVariables(gruvbox);
      assert.ok(css.includes(":root {"));
      assert.ok(css.includes("--bg-primary: #282828;"));
      assert.ok(css.includes("--accent-primary: #fe8019;"));
      assert.ok(css.includes("--border-color: #504945;"));
    });
  });

  describe("ThemeManager", () => {
    let tm;

    beforeEach(() => {
      tm = new ThemeManager({ initialTheme: "gruvbox-dark" });
    });

    it("initializes with requested theme and allows theme switching", () => {
      assert.equal(tm.getTheme().id, "gruvbox-dark");

      let eventPayload = null;
      tm.on("themeChange", (payload) => {
        eventPayload = payload;
      });

      const updated = tm.setTheme("tokyo-night");
      assert.equal(updated.id, "tokyo-night");
      assert.equal(tm.getTheme().id, "tokyo-night");

      assert.ok(eventPayload);
      assert.equal(eventPayload.previous, "gruvbox-dark");
      assert.equal(eventPayload.current, "tokyo-night");
    });

    it("throws clear error on invalid theme ID", () => {
      assert.throws(() => tm.setTheme("non-existent-theme"), /Theme "non-existent-theme" not found/);
    });

    it("lists all available themes with id, name, and type", () => {
      const list = tm.listThemes();
      assert.equal(list.length, 7);
      const lightTheme = list.find(t => t.id === "light");
      assert.ok(lightTheme);
      assert.equal(lightTheme.type, "light");
    });

    it("injects CSS variables into target DOM head", () => {
      const mockHead = {
        children: [],
        appendChild: function(el) { this.children.push(el); }
      };
      const mockDoc = {
        head: mockHead,
        documentElement: {
          attrs: {},
          setAttribute: function(k, v) { this.attrs[k] = v; }
        },
        getElementById: function() { return null; },
        createElement: function(tag) { return { tag, id: "", textContent: "" }; }
      };

      tm.applyThemeToDom(mockDoc);
      assert.equal(mockDoc.documentElement.attrs["data-theme"], "gruvbox-dark");
      assert.equal(mockHead.children.length, 1);
      assert.ok(mockHead.children[0].textContent.includes("--bg-primary: #282828"));
    });
  });

  describe("Scheduled Auto-Switching", () => {
    it("switches theme automatically based on daytime and nighttime hours", () => {
      const tm = new ThemeManager({ initialTheme: "dracula" });
      tm.configureSchedule({
        enabled: true,
        dayTheme: "light",
        nightTheme: "catppuccin-mocha",
        dayStartHour: 8,
        nightStartHour: 20
      }, false);

      // Hour 12 (Noon -> Day theme)
      const dayResult = tm.checkSchedule(12);
      assert.equal(dayResult.switched, true);
      assert.equal(dayResult.isDay, true);
      assert.equal(tm.getTheme().id, "light");

      // Check again at 14 (still day -> no change)
      const dayRepeat = tm.checkSchedule(14);
      assert.equal(dayRepeat.switched, false);
      assert.equal(tm.getTheme().id, "light");

      // Hour 22 (10 PM -> Night theme)
      const nightResult = tm.checkSchedule(22);
      assert.equal(nightResult.switched, true);
      assert.equal(nightResult.isDay, false);
      assert.equal(tm.getTheme().id, "catppuccin-mocha");
    });
  });

  describe("BoostManager (Per-Domain CSS/JS Injection)", () => {
    let bm;

    beforeEach(() => {
      bm = new BoostManager();
    });

    it("creates, retrieves, and lists boosts", () => {
      const b1 = bm.create("github.com", {
        css: "body { font-size: 16px; }",
        js: "console.log('GitHub Boost');"
      });
      assert.equal(b1.domain, "github.com");
      assert.equal(b1.enabled, true);

      const b2 = bm.create("*.local", { css: "body { background: #333; }" });
      assert.equal(bm.list().length, 2);

      assert.equal(bm.get("github.com").css, "body { font-size: 16px; }");
    });

    it("matches domain patterns correctly (exact, wildcards, subdomains)", () => {
      assert.equal(bm.matches("github.com", "github.com"), true);
      assert.equal(bm.matches("github.com", "api.github.com"), false);

      assert.equal(bm.matches("*.github.com", "api.github.com"), true);
      assert.equal(bm.matches("*.github.com", "gist.github.com"), true);
      assert.equal(bm.matches("*.github.com", "github.com"), true);
      assert.equal(bm.matches("*.github.com", "gitlab.com"), false);

      assert.equal(bm.matches("*", "anything.local"), true);
    });

    it("toggles and removes boosts", () => {
      bm.create("example.com", { css: "h1 { color: red; }" });
      const toggled = bm.toggle("example.com");
      assert.equal(toggled.enabled, false);

      assert.equal(bm.getMatchingBoosts("https://example.com").length, 0);

      bm.toggle("example.com", true);
      assert.equal(bm.getMatchingBoosts("https://example.com").length, 1);

      assert.equal(bm.remove("example.com"), true);
      assert.equal(bm.list().length, 0);
    });

    it("injects custom style into mock DOM document", () => {
      bm.create("mysite.org", { css: "p { color: green; }" });

      const mockElements = [];
      const mockHead = {
        children: [],
        appendChild: function(el) {
          this.children.push(el);
          mockElements.push(el);
        }
      };
      const mockDoc = {
        head: mockHead,
        body: mockHead,
        querySelector: function() { return null; },
        createElement: function(tag) {
          return {
            tag,
            attrs: {},
            setAttribute: function(k, v) { this.attrs[k] = v; },
            textContent: ""
          };
        }
      };

      const result = bm.inject(mockDoc, "https://mysite.org/dashboard");
      assert.equal(result.injected, true);
      assert.equal(result.matchedBoosts, 1);
      assert.equal(result.cssCount, 1);
      assert.equal(mockElements[0].textContent, "p { color: green; }");
      assert.equal(mockElements[0].attrs["data-boost"], "mysite.org");
    });
  });

  describe("Lua Bridge Integration", () => {
    it("handles dev.ui.set_theme and theme.list via DevLua bridge", () => {
      DevLua.ui.set_theme("dracula");
      assert.equal(defaultThemeManager.getTheme().id, "dracula");

      const themes = DevLua.theme.list();
      assert.equal(themes.length, 7);

      // Evaluate Lua script string
      DevLua.evaluateLuaScript('dev.ui.set_theme("nord")');
      assert.equal(defaultThemeManager.getTheme().id, "nord");
    });

    it("handles boost.create via DevLua bridge and script evaluation", () => {
      DevLua.boost.create("custom.dev", { css: "a { text-decoration: underline; }" });
      const boost = defaultBoostManager.get("custom.dev");
      assert.ok(boost);
      assert.equal(boost.css, "a { text-decoration: underline; }");

      DevLua.evaluateLuaScript('boost.create("script.dev", { css = "body { margin: 0; }" })');
      const scriptBoost = defaultBoostManager.get("script.dev");
      assert.ok(scriptBoost);
      assert.equal(scriptBoost.css, "body { margin: 0; }");
    });
  });

  describe("Edge Cases & Robustness", () => {
    it("rejects empty, null, or invalid theme names in ThemeManager", () => {
      const tm = new ThemeManager();
      assert.throws(() => tm.setTheme(""), /Invalid theme ID/);
      assert.throws(() => tm.setTheme(null), /Invalid theme ID/);
    });

    it("BoostManager extracts hostname from URLs with paths, ports, and query params", () => {
      const bm = new BoostManager();
      bm.create("*.devbrowser.local", { css: "body { padding: 0; }" });

      const matches1 = bm.getMatchingBoosts("http://sub.devbrowser.local:8080/dashboard?tab=1");
      assert.equal(matches1.length, 1);

      const matches2 = bm.getMatchingBoosts("devbrowser.local");
      assert.equal(matches2.length, 1);
    });

    it("BoostManager excludes disabled boosts from injection", () => {
      const bm = new BoostManager();
      bm.create("skip.org", { css: "div { display: none; }", enabled: false });

      const matches = bm.getMatchingBoosts("https://skip.org");
      assert.equal(matches.length, 0);
    });

    it("themeToCssVariables throws error on invalid theme structure", () => {
      assert.throws(() => themeToCssVariables(null), /Invalid theme object/);
      assert.throws(() => themeToCssVariables({}), /Invalid theme object/);
    });
  });
});
