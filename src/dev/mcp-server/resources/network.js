/**
 * Dev Browser - MCP Network Resource
 * mcp://network/failed
 */

const networkResource = {
  uri: "mcp://network/failed",
  name: "Failed Network Requests",
  description: "Last 50 failed network requests in the browser",
  mimeType: "application/json",
  read: async (context) => {
    const failed = context.getFailedRequests();
    return {
      uri: "mcp://network/failed",
      mimeType: "application/json",
      text: JSON.stringify(failed, null, 2)
    };
  }
};

module.exports = {
  networkResource
};
