/**
 * Dev Browser - Theme Engine Module
 * Exports ThemeManager, BoostManager, built-in themes, and default instances.
 */

const { THEMES, themeToCssVariables } = require("./themes");
const { ThemeManager } = require("./theme-manager");
const { BoostManager } = require("./boost");

const defaultThemeManager = new ThemeManager();
const defaultBoostManager = new BoostManager();

module.exports = {
  THEMES,
  themeToCssVariables,
  ThemeManager,
  BoostManager,
  defaultThemeManager,
  defaultBoostManager
};
