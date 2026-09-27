/**
 * Dev Browser - MCP Tools Registry
 * Combines all 19 browser automation tools.
 */

const { navigationTools } = require("./navigation");
const { tabTools } = require("./tabs");
const { interactionTools } = require("./interaction");
const { contentTools } = require("./content");
const { devtoolsTools } = require("./devtools");

const allTools = [
  ...navigationTools,
  ...tabTools,
  ...interactionTools,
  ...contentTools,
  ...devtoolsTools
];

const toolMap = new Map();
for (const tool of allTools) {
  toolMap.set(tool.name, tool);
}

function getTool(name) {
  return toolMap.get(name) || null;
}

function listTools() {
  return allTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }));
}

module.exports = {
  allTools,
  toolMap,
  getTool,
  listTools
};
