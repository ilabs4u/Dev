/**
 * Dev Browser - MCP DOM Resource
 * mcp://dom/current
 */

const domResource = {
  uri: "mcp://dom/current",
  name: "Current Page DOM",
  description: "Simplified DOM tree of the currently active tab without style/script noise",
  mimeType: "text/html",
  read: async (context) => {
    const text = context.getSimplifiedDom();
    return {
      uri: "mcp://dom/current",
      mimeType: "text/html",
      text
    };
  }
};

module.exports = {
  domResource
};
