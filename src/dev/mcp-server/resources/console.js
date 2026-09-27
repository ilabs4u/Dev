/**
 * Dev Browser - MCP Console Errors Resource
 * mcp://console/errors
 */

const consoleResource = {
  uri: "mcp://console/errors",
  name: "Console Errors",
  description: "Last 100 console errors and warnings",
  mimeType: "application/json",
  read: async (context) => {
    const errors = context.getConsoleErrors();
    return {
      uri: "mcp://console/errors",
      mimeType: "application/json",
      text: JSON.stringify(errors, null, 2)
    };
  }
};

module.exports = {
  consoleResource
};
