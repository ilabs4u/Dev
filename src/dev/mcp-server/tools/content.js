/**
 * Dev Browser - MCP Page Content Tools
 * get_page_content, screenshot, evaluate_js, get_console_logs
 */

const contentTools = [
  {
    name: "get_page_content",
    description: "Get text, HTML, or markdown content of the current or specified tab",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["text", "html", "markdown"], description: "Output format (default: 'text')" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_page_content", args);
      const res = await context.getPageContent(args.tabId, args.format || "text");
      return {
        content: [{ type: "text", text: res.content }],
        data: res
      };
    }
  },
  {
    name: "screenshot",
    description: "Capture screenshot of the visible tab viewport as a base64 data image",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "jpeg"], description: "Image format (default: 'png')" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("screenshot", args);
      const res = await context.captureScreenshot(args.tabId, args.format || "png");
      return {
        content: [
          {
            type: "image",
            data: res.data.replace(/^data:image\/[a-z]+;base64,/, ""),
            mimeType: res.mimeType || "image/png"
          }
        ],
        data: res
      };
    }
  },
  {
    name: "evaluate_js",
    description: "Evaluate a JavaScript expression in the context of the page",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "The JavaScript code to execute" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      },
      required: ["script"]
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("evaluate_js", args);
      const res = await context.evaluateJs(args.script, args.tabId);
      const outputText = typeof res.result === "object" ? JSON.stringify(res.result, null, 2) : String(res.result);
      return {
        content: [{ type: "text", text: outputText }],
        data: res
      };
    }
  },
  {
    name: "get_console_logs",
    description: "Retrieve recent console logs from the active or specified tab",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of logs to retrieve (default: 100)" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_console_logs", args);
      const logs = await context.getConsoleLogs(args.limit || 100, args.tabId);
      const formatted = logs.map(l => `[${l.level.toUpperCase()}] ${l.message}`).join("\n");
      return {
        content: [{ type: "text", text: formatted || "No console logs recorded" }],
        data: logs
      };
    }
  }
];

module.exports = {
  contentTools
};
