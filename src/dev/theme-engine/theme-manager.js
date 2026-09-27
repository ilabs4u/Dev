/**
 * Dev Browser - Theme Manager
 * Controls active theme, CSS variable injection, time-based auto switching, and change events.
 */

const { EventEmitter } = require("events");
const { THEMES, themeToCssVariables } = require("./themes");

class ThemeManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.currentThemeId = options.initialTheme || "catppuccin-mocha";
    if (!THEMES[this.currentThemeId]) {
      this.currentThemeId = "gruvbox-dark";
    }

    this.scheduleConfig = {
      enabled: false,
      dayTheme: "light",
      nightTheme: "catppuccin-mocha",
      dayStartHour: 7,    // 07:00 AM
      nightStartHour: 19  // 07:00 PM
    };

    this.schedulerTimer = null;
    this.styleElementId = "dev-browser-theme-tokens";

    if (options.schedule) {
      this.configureSchedule(options.schedule);
    }

    // Auto-apply if document is present
    if (typeof document !== "undefined") {
      this.applyThemeToDom();
    }
  }

  getTheme() {
    return {
      id: this.currentThemeId,
      theme: THEMES[this.currentThemeId]
    };
  }

  setTheme(themeId) {
    if (!themeId || typeof themeId !== "string") {
      throw new Error(`Invalid theme ID: ${themeId}`);
    }
    const cleanId = themeId.toLowerCase().trim();
    if (!THEMES[cleanId]) {
      throw new Error(`Theme "${themeId}" not found. Available: ${Object.keys(THEMES).join(", ")}`);
    }

    const prevTheme = this.currentThemeId;
    this.currentThemeId = cleanId;

    if (typeof document !== "undefined") {
      this.applyThemeToDom();
    }

    this.emit("themeChange", {
      previous: prevTheme,
      current: this.currentThemeId,
      theme: THEMES[this.currentThemeId]
    });

    return THEMES[this.currentThemeId];
  }

  listThemes() {
    return Object.values(THEMES).map(t => ({
      id: t.id,
      name: t.name,
      type: t.type
    }));
  }

  getCssVariables(themeId = null) {
    const targetId = themeId || this.currentThemeId;
    const theme = THEMES[targetId];
    if (!theme) {
      throw new Error(`Theme "${targetId}" not found`);
    }
    return themeToCssVariables(theme);
  }

  applyThemeToDom(targetDoc = null) {
    const doc = targetDoc || (typeof document !== "undefined" ? document : null);
    if (!doc || !doc.head) return;

    let styleEl = doc.getElementById(this.styleElementId);
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = this.styleElementId;
      doc.head.appendChild(styleEl);
    }

    styleEl.textContent = this.getCssVariables();
    doc.documentElement.setAttribute("data-theme", this.currentThemeId);
  }

  configureSchedule(config = {}, autoCheck = true) {
    this.scheduleConfig = {
      ...this.scheduleConfig,
      ...config
    };

    if (this.scheduleConfig.enabled) {
      if (autoCheck) {
        this.checkSchedule();
      }
      this.startScheduler();
    } else {
      this.stopScheduler();
    }

    return { ...this.scheduleConfig };
  }

  getSchedule() {
    return { ...this.scheduleConfig };
  }

  checkSchedule(currentHour = null) {
    if (!this.scheduleConfig.enabled) return null;

    const hour = currentHour !== null ? currentHour : new Date().getHours();
    const isDay = hour >= this.scheduleConfig.dayStartHour && hour < this.scheduleConfig.nightStartHour;
    const targetTheme = isDay ? this.scheduleConfig.dayTheme : this.scheduleConfig.nightTheme;

    if (this.currentThemeId !== targetTheme) {
      this.setTheme(targetTheme);
      return { switched: true, targetTheme, isDay };
    }

    return { switched: false, targetTheme, isDay };
  }

  startScheduler(intervalMs = 60000) {
    this.stopScheduler();
    this.schedulerTimer = setInterval(() => {
      this.checkSchedule();
    }, intervalMs);
    if (this.schedulerTimer.unref) {
      this.schedulerTimer.unref();
    }
  }

  stopScheduler() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }
}

module.exports = {
  ThemeManager
};
