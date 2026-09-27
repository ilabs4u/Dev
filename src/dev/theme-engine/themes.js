/**
 * Dev Browser - Built-in Developer Themes & CSS Token Definitions
 */

const THEMES = {
  "gruvbox-dark": {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    type: "dark",
    colors: {
      bgPrimary: "#282828",
      bgSecondary: "#1d2021",
      bgTertiary: "#3c3836",
      textPrimary: "#ebdbb2",
      textSecondary: "#d5c4a1",
      textMuted: "#a89984",
      borderColor: "#504945",
      accentPrimary: "#fe8019",
      accentSecondary: "#fabd2f",
      accentHover: "#d65d0e",
      accentSubtle: "rgba(254, 128, 25, 0.15)",
      successColor: "#b8bb26",
      warningColor: "#fabd2f",
      errorColor: "#fb4934",
      codeBg: "#1d2021"
    }
  },

  "catppuccin-mocha": {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    type: "dark",
    colors: {
      bgPrimary: "#1e1e2e",
      bgSecondary: "#181825",
      bgTertiary: "#313244",
      textPrimary: "#cdd6f4",
      textSecondary: "#a6adc8",
      textMuted: "#6c7086",
      borderColor: "#45475a",
      accentPrimary: "#cba6f7",
      accentSecondary: "#89b4fa",
      accentHover: "#b4befe",
      accentSubtle: "rgba(203, 166, 247, 0.15)",
      successColor: "#a6e3a1",
      warningColor: "#f9e2af",
      errorColor: "#f38ba8",
      codeBg: "#181825"
    }
  },

  "tokyo-night": {
    id: "tokyo-night",
    name: "Tokyo Night",
    type: "dark",
    colors: {
      bgPrimary: "#1a1b26",
      bgSecondary: "#16161e",
      bgTertiary: "#24283b",
      textPrimary: "#c0caf5",
      textSecondary: "#a9b1d6",
      textMuted: "#565f89",
      borderColor: "#292e42",
      accentPrimary: "#7aa2f7",
      accentSecondary: "#bb9af7",
      accentHover: "#89ddff",
      accentSubtle: "rgba(122, 162, 247, 0.15)",
      successColor: "#9ece6a",
      warningColor: "#e0af68",
      errorColor: "#f7768e",
      codeBg: "#16161e"
    }
  },

  "dracula": {
    id: "dracula",
    name: "Dracula",
    type: "dark",
    colors: {
      bgPrimary: "#282a36",
      bgSecondary: "#1e1f29",
      bgTertiary: "#44475a",
      textPrimary: "#f8f8f2",
      textSecondary: "#e2e2dc",
      textMuted: "#6272a4",
      borderColor: "#44475a",
      accentPrimary: "#bd93f9",
      accentSecondary: "#8be9fd",
      accentHover: "#ff79c6",
      accentSubtle: "rgba(189, 147, 249, 0.15)",
      successColor: "#50fa7b",
      warningColor: "#f1fa8c",
      errorColor: "#ff5555",
      codeBg: "#1e1f29"
    }
  },

  "nord": {
    id: "nord",
    name: "Nord",
    type: "dark",
    colors: {
      bgPrimary: "#2e3440",
      bgSecondary: "#242933",
      bgTertiary: "#3b4252",
      textPrimary: "#eceff4",
      textSecondary: "#d8dee9",
      textMuted: "#4c566a",
      borderColor: "#434c5e",
      accentPrimary: "#88c0d0",
      accentSecondary: "#81a1c1",
      accentHover: "#8fbcbb",
      accentSubtle: "rgba(136, 192, 208, 0.15)",
      successColor: "#a3be8c",
      warningColor: "#ebcb8b",
      errorColor: "#bf616a",
      codeBg: "#242933"
    }
  },

  "one-dark": {
    id: "one-dark",
    name: "One Dark",
    type: "dark",
    colors: {
      bgPrimary: "#282c34",
      bgSecondary: "#21252b",
      bgTertiary: "#2c313a",
      textPrimary: "#abb2bf",
      textSecondary: "#9da5b4",
      textMuted: "#5c6370",
      borderColor: "#3e4451",
      accentPrimary: "#61afef",
      accentSecondary: "#c678dd",
      accentHover: "#528bff",
      accentSubtle: "rgba(97, 175, 239, 0.15)",
      successColor: "#98c379",
      warningColor: "#e5c07b",
      errorColor: "#e06c75",
      codeBg: "#21252b"
    }
  },

  "light": {
    id: "light",
    name: "Light Clean",
    type: "light",
    colors: {
      bgPrimary: "#ffffff",
      bgSecondary: "#f6f8fa",
      bgTertiary: "#eaeef2",
      textPrimary: "#24292f",
      textSecondary: "#57606a",
      textMuted: "#8c959f",
      borderColor: "#d0d7de",
      accentPrimary: "#0969da",
      accentSecondary: "#1f883d",
      accentHover: "#0550ae",
      accentSubtle: "rgba(9, 105, 218, 0.1)",
      successColor: "#1a7f37",
      warningColor: "#9a6700",
      errorColor: "#cf222e",
      codeBg: "#f6f8fa"
    }
  }
};

function themeToCssVariables(theme) {
  if (!theme || !theme.colors) {
    throw new Error("Invalid theme object provided");
  }
  const c = theme.colors;
  return `:root {
  --bg-primary: ${c.bgPrimary};
  --bg-secondary: ${c.bgSecondary};
  --bg-tertiary: ${c.bgTertiary};
  --text-primary: ${c.textPrimary};
  --text-secondary: ${c.textSecondary};
  --text-muted: ${c.textMuted};
  --border-color: ${c.borderColor};
  --accent-primary: ${c.accentPrimary};
  --accent-secondary: ${c.accentSecondary};
  --accent-hover: ${c.accentHover};
  --accent-subtle: ${c.accentSubtle};
  --success-color: ${c.successColor};
  --warning-color: ${c.warningColor};
  --error-color: ${c.errorColor};
  --code-bg: ${c.codeBg};
}`;
}

module.exports = {
  THEMES,
  themeToCssVariables
};
