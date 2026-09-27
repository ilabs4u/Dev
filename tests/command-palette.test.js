const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { CommandPalette, fuzzyMatch, fuzzyFilter } = require("../src/dev/command-palette");

describe("Task 1.3: Command Palette & Fuzzy Search", () => {
  let palette;

  beforeEach(() => {
    palette = new CommandPalette({
      tabProvider: () => [
        { id: "1", title: "GitHub - ilabs4u/Dev", url: "https://github.com/ilabs4u/Dev" },
        { id: "2", title: "MDN Web Docs", url: "https://developer.mozilla.org" }
      ]
    });
  });

  it("fuzzy matches query and identifies match indices", () => {
    const res1 = fuzzyMatch("nt", "New Tab");
    assert.equal(res1.matches, true);
    assert.ok(res1.score > 0);
    assert.deepEqual(res1.indices, [0, 4]); // 'N' and 'T'

    const res2 = fuzzyMatch("tab", "New Tab");
    assert.equal(res2.matches, true);
    assert.ok(res2.indices.length === 3);

    const res3 = fuzzyMatch("xyz", "New Tab");
    assert.equal(res3.matches, false);
  });

  it("opens palette in under 50ms", () => {
    const durationMs = palette.open();
    assert.equal(palette.isOpen, true);
    assert.ok(durationMs < 50, `Open duration must be <50ms, was ${durationMs}ms`);
  });

  it("fuzzy search 'new tab' selects 'New Tab' and Enter executes it", () => {
    palette.open();
    palette.setQuery("new tab");

    assert.ok(palette.filteredResults.length > 0);
    const topItem = palette.filteredResults[0].item;
    assert.equal(topItem.id, "tab.new");
    assert.equal(topItem.title, "New Tab");

    // Press Enter to execute
    const result = palette.executeSelected();
    assert.equal(result, "new_tab");
    assert.equal(palette.isOpen, false, "Palette must close after execution");
  });

  it("supports keyboard navigation (ArrowDown, ArrowUp, Wrap-around)", () => {
    palette.open();
    palette.setQuery(""); // all items
    const count = palette.filteredResults.length;
    assert.ok(count > 5);

    assert.equal(palette.selectedIndex, 0);

    // Navigate down
    palette.handleKeyDown({ key: "ArrowDown", preventDefault: () => {} });
    assert.equal(palette.selectedIndex, 1);

    // Navigate up
    palette.handleKeyDown({ key: "ArrowUp", preventDefault: () => {} });
    assert.equal(palette.selectedIndex, 0);

    // Wrap around up
    palette.handleKeyDown({ key: "ArrowUp", preventDefault: () => {} });
    assert.equal(palette.selectedIndex, count - 1);

    // Wrap around down
    palette.handleKeyDown({ key: "ArrowDown", preventDefault: () => {} });
    assert.equal(palette.selectedIndex, 0);
  });

  it("dismisses palette with Escape", () => {
    palette.open();
    assert.equal(palette.isOpen, true);

    const handled = palette.handleKeyDown({ key: "Escape", preventDefault: () => {} });
    assert.equal(handled, true);
    assert.equal(palette.isOpen, false);
  });

  it("searches open tabs", () => {
    palette.open();
    palette.setQuery("github");

    assert.ok(palette.filteredResults.length > 0);
    const tabItem = palette.filteredResults[0].item;
    assert.equal(tabItem.category, "Open Tab");
    assert.ok(tabItem.title.includes("ilabs4u/Dev"));
  });

  it("allows registering and executing custom Lua commands", () => {
    let customExecuted = false;
    palette.registerCommand({
      id: "lua.custom_export",
      title: "Export Session Data",
      category: "Lua",
      handler: () => {
        customExecuted = true;
        return "exported";
      }
    });

    palette.open();
    palette.setQuery("export session");

    assert.ok(palette.filteredResults.length > 0);
    const topItem = palette.filteredResults[0].item;
    assert.equal(topItem.id, "lua.custom_export");

    const res = palette.executeSelected();
    assert.equal(res, "exported");
    assert.equal(customExecuted, true);
  });
});
