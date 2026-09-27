/**
 * Dev Browser - Dev Toolkit Module
 * Exports all developer tools: Base64, JWT, JSON, Hash, UUID, Timestamp, Regex, and HTTP Client.
 */

const base64 = require("./base64");
const jwt = require("./jwt");
const json = require("./json-tools");
const hash = require("./hash");
const uuid = require("./uuid-tools");
const timestamp = require("./timestamp");
const regex = require("./regex-tools");
const http = require("./http-client");
const { DevToolkitUI } = require("./dev-toolkit");

const defaultToolkit = new DevToolkitUI();

module.exports = {
  // Sub-modules
  base64,
  jwt,
  json,
  hash,
  uuid,
  timestamp,
  regex,
  http,

  // Direct utilities
  encodeBase64: base64.encode,
  decodeBase64: base64.decode,
  parseJwt: jwt.parseJwt,
  isJwtExpired: jwt.isExpired,
  inspectJwt: jwt.inspect,
  formatJson: json.formatJson,
  minifyJson: json.minifyJson,
  validateJson: json.validateJson,
  digest: hash.digest,
  generateAllHashes: hash.generateAll,
  cryptoBridge: hash.cryptoBridge,
  generateUuid: uuid.generateV4,
  generateBatchUuids: uuid.generateBatch,
  validateUuid: uuid.validateUuid,
  formatRelativeTime: timestamp.formatRelativeTime,
  parseTimestamp: timestamp.parseTimestamp,
  testRegex: regex.testRegex,
  replaceRegex: regex.replaceRegex,
  parseHttpFile: http.parseHttpFile,
  executeRequest: http.executeRequest,

  // UI class and default instance
  DevToolkitUI,
  defaultToolkit
};
