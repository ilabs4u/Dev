/**
 * Dev Browser - MCP Tab Management Tools
 * list_tabs, new_tab, close_tab, switch_tab
 */

const tabTools = [
  {
    name: "list_tabs",
    description: "List all currently open tabs in Dev Browser",
    inputSchema: {
      type: "object",
      properties: {}
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("list_tabs", args);
      const tabs = await context.listTabs();
      return {
        content: [{ type: "text", text: JSON.stringify(tabs, null, 2) }],
        data: tabs
      };
    }
  },
  {
    name: "new_tab",
    description: "Create and open a new browser tab",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to open in the new tab" },
        active: { type: "boolean", description: "Make this tab active" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("new_tab", args);
      const tab = await context.newTab(args);
      return {
        content: [{ type: "text", text: `Opened new tab [${tab.id}]: ${tab.url}` }],
        data: tab
      };
    }
  },
  {
    name: "close_tab",
    description: "Close an open browser tab by ID",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "ID of tab to close" }
      },
      required: ["tabId"]
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("close_tab", args);
      const res = await context.closeTab(args.tabId);
      return {
        content: [{ type: "text", text: `Closed tab ${args.tabId}` }],
        data: res
      };
    }
  },
  {
    name: "switch_tab",
    description: "Switch active focus to a specific tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "ID of tab to activate" }
      },
      required: ["tabId"]
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("switch_tab", args);
      const res = await context.switchTab(args.tabId);
      return {
        content: [{ type: "text", text: `Switched to tab ${args.tabId}` }],
        data: res
      };
    }
  }
];

module.exports = {
  tabTools
};
