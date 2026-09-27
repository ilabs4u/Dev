/**
 * Dev Browser - Localhost Dashboard Module
 */

const { detectService, FRAMEWORK_SIGNATURES, extractTitle } = require("./detector");
const { LocalhostScanner, COMMON_DEV_PORTS } = require("./scanner");
const { DashboardUI } = require("./dashboard");

module.exports = {
  detectService,
  FRAMEWORK_SIGNATURES,
  extractTitle,
  LocalhostScanner,
  COMMON_DEV_PORTS,
  DashboardUI
};
