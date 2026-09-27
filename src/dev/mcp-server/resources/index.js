/**
 * Dev Browser - MCP Resources Registry
 * Combines dom, network, and console resources.
 */

const { domResource } = require("./dom");
const { networkResource } = require("./network");
const { consoleResource } = require("./console");

const allResources = [
  domResource,
  networkResource,
  consoleResource
];

const resourceMap = new Map();
for (const res of allResources) {
  resourceMap.set(res.uri, res);
}

function getResource(uri) {
  return resourceMap.get(uri) || null;
}

function listResources() {
  return allResources.map(r => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType
  }));
}

module.exports = {
  allResources,
  resourceMap,
  getResource,
  listResources
};
