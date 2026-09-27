/**
 * Dev Browser - MCP DevTools Tools
 * get_css, get_performance, get_accessibility_tree
 */

const devtoolsTools = [
  {
    name: "get_css",
    description: "Get computed CSS styles for an element matching a selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for target element" },
        property: { type: "string", description: "Optional specific CSS property to query (e.g. 'display', 'color')" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      },
      required: ["selector"]
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_css", args);
      const res = await context.getCss(args);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        data: res
      };
    }
  },
  {
    name: "get_performance",
    description: "Get page load performance timing and resource metrics",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_performance", args);
      const res = await context.getPerformance(args.tabId);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        data: res
      };
    }
  },
  {
    name: "get_accessibility_tree",
    description: "Get the semantic accessibility tree with roles and accessible names",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_accessibility_tree", args);
      const res = await context.getAccessibilityTree(args.tabId);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        data: res
      };
    }
  }
];

module.exports = {
  devtoolsTools
};
