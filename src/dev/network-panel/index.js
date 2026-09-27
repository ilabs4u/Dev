/**
 * Dev Browser - Network Panel Module
 * Export all proxy, IP monitoring, and toolbar switching components.
 */

const { ProxyManager, PROXY_MODES, DEFAULT_CONFIGS, DEFAULT_BYPASS_LIST } = require("./proxy-manager");
const { IPMonitor, DEFAULT_IP_ENDPOINTS, isValidIP } = require("./ip-monitor");
const { NetworkToolbarWidget, MODE_METADATA } = require("./network-toolbar");
const { NetworkPanelUI } = require("./network-panel");
const { DnsEngine, DOH_RESOLVERS } = require("./dns-engine");

// Singleton instances for shared browser state
const defaultProxyManager = new ProxyManager();
const defaultIPMonitor = new IPMonitor();
const defaultDnsEngine = new DnsEngine();

module.exports = {
  ProxyManager,
  PROXY_MODES,
  DEFAULT_CONFIGS,
  DEFAULT_BYPASS_LIST,
  IPMonitor,
  isValidIP,
  DEFAULT_IP_ENDPOINTS,
  NetworkToolbarWidget,
  MODE_METADATA,
  NetworkPanelUI,
  DnsEngine,
  DOH_RESOLVERS,
  defaultProxyManager,
  defaultIPMonitor,
  defaultDnsEngine
};
