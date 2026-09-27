/**
 * Dev Browser - MCP Page Interaction Tools
 * get_interactive_elements, click, fill
 */

const interactionTools = [
  {
    name: "get_interactive_elements",
    description: "Extract interactive elements (buttons, links, inputs) with Agent Tree labels (A, B, C...)",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      await permissions.checkPermission("get_interactive_elements", args);
      const elements = await context.getInteractiveElements(args.tabId);
      const formatted = elements.map(el => `[${el.label}] <${el.tag}${el.id ? ' id="' + el.id + '"' : ''}> ${el.text || el.placeholder || el.name || el.selector}`).join("\n");
      return {
        content: [{ type: "text", text: formatted || "No interactive elements found" }],
        data: elements
      };
    }
  },
  {
    name: "click",
    description: "Click an interactive element identified by CSS selector or Agent Tree label",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of element to click" },
        label: { type: "string", description: "Agent Tree label (e.g. 'A', 'B') of element to click" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      }
    },
    handler: async (args, context, permissions) => {
      if (!args.selector && !args.label) {
        throw new Error("Must provide either 'selector' or 'label' to click");
      }
      await permissions.checkPermission("click", args);
      const res = await context.clickElement(args);
      return {
        content: [{ type: "text", text: `Clicked ${res.clicked}` }],
        data: res
      };
    }
  },
  {
    name: "fill",
    description: "Fill a form input or textarea with text",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text string to type into the field" },
        selector: { type: "string", description: "CSS selector of target input/textarea" },
        label: { type: "string", description: "Agent Tree label (e.g. 'A', 'B') of target input" },
        tabId: { type: ["number", "string"], description: "Optional tab ID" }
      },
      required: ["text"]
    },
    handler: async (args, context, permissions) => {
      if (!args.selector && !args.label) {
        throw new Error("Must provide either 'selector' or 'label' to fill");
      }
      await permissions.checkPermission("fill", args);
      const res = await context.fillElement(args);
      return {
        content: [{ type: "text", text: `Filled ${res.filled} with "${res.text}"` }],
        data: res
      };
    }
  }
];

module.exports = {
  interactionTools
};
