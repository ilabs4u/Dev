/**
 * Dev Browser - Agent Tree Module
 * Distilled DOM labeling engine and in-browser visual badge overlay.
 */

const { DomDistiller, distill, generateLabel, parseLabel } = require("./distiller");
const { AgentTreeOverlay, defaultOverlay } = require("./overlay");

/**
 * Convenience hook to initialize Agent Tree overlay in a window or tab.
 * @param {Window} targetWindow - target browser window
 * @param {Object} options - overlay and distiller options
 * @returns {AgentTreeOverlay}
 */
function setupAgentTree(targetWindow = null, options = {}) {
  const win = targetWindow || (typeof window !== "undefined" ? window : null);
  const doc = win && win.document ? win.document : (typeof document !== "undefined" ? document : null);

  const overlay = new AgentTreeOverlay(options);
  if (doc) {
    overlay.mount(doc);
  }
  return overlay;
}

module.exports = {
  DomDistiller,
  distill,
  generateLabel,
  parseLabel,
  AgentTreeOverlay,
  defaultOverlay,
  setupAgentTree
};
