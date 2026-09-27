/**
 * Dev Browser - MCP Navigation Tools
 * navigate_to, go_back, go_forward, reload, get_current_url
 */

const navigationTools = [
  {
    name: "navigate_to",
    description: "Navigate active or specified tab to a destination URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The destination URL to navigate to" },
        tabId: { type: ["number", "string"], description: "Optional tab ID (defaults to active tab)" }
      },
      required: ["url"]
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("navigate_to", args);
      const res = await context.navigateTo(args.url, args.tabId);
      return {
        content: [{ type: "text", text: `Navigated to ${res.url}` }],
        data: res
      };
    }
  },
  {
    name: "go_back",
    description: "Navigate back in browser history for active or specified tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("go_back", args);
      const res = await context.goBack(args.tabId);
      return {
        content: [{ type: "text", text: res.success ? `Navigated back to ${res.url}` : "Cannot go back (at beginning of history)" }],
        data: res
      };
    }
  },
  {
    name: "go_forward",
    description: "Navigate forward in browser history for active or specified tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("go_forward", args);
      const res = await context.goForward(args.tabId);
      return {
        content: [{ type: "text", text: res.success ? `Navigated forward to ${res.url}` : "Cannot go forward (at end of history)" }],
        data: res
      };
    }
  },
  {
    name: "reload",
    description: "Reload current page in active or specified tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" },
        bypassCache: { type: "boolean", description: "Bypass browser cache" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("reload", args);
      const res = await context.reload(args.tabId, args.bypassCache);
      return {
        content: [{ type: "text", text: `Reloaded ${res.url}` }],
        data: res
      };
    }
  },
  {
    name: "get_current_url",
    description: "Get the current URL and page title of active or specified tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_current_url", args);
      const res = await context.getCurrentUrl(args.tabId);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        data: res
      };
    }
  }
];

module.exports = {
  navigationTools
};
