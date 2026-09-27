/**
 * Dev Browser - AI Sidebar Module Entry Point
 * Coordinates BYOM providers, context extraction, and sidebar lifecycle.
 */

const {
  BaseProvider,
  StreamChunk,
  ProviderError,
  OllamaProvider,
  OpenAIProvider,
  ClaudeProvider,
  LMStudioProvider,
  ProviderRegistry,
  defaultRegistry
} = require("./providers");

const {
  ContextExtractor,
  defaultContextExtractor
} = require("./context");

const {
  AiSidebar,
  defaultSidebar,
  renderMarkdown,
  escapeHtml
} = require("./sidebar");

/**
 * High-level programmatic API to ask AI a question.
 * Accumulates streaming response into a complete text string.
 * @param {string} prompt
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function ask(prompt, options = {}) {
  const registry = options.registry || defaultRegistry;
  const messages = [{ role: "user", content: String(prompt) }];
  let fullResponse = "";

  for await (const chunk of registry.chat(messages, options)) {
    const text = chunk.text ?? chunk.delta ?? String(chunk);
    if (text) {
      fullResponse += text;
    }
  }

  return fullResponse;
}

/**
 * High-level programmatic API to summarize text.
 * @param {string} text
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function summarize(text, options = {}) {
  const extractor = options.contextExtractor || defaultContextExtractor;
  const item = extractor.buildSummarizePrompt({ text: String(text) });
  const registry = options.registry || defaultRegistry;

  let fullResponse = "";
  for await (const chunk of registry.chat(item.messages, options)) {
    const delta = chunk.text ?? chunk.delta ?? String(chunk);
    if (delta) {
      fullResponse += delta;
    }
  }

  return fullResponse;
}

/**
 * Mounts AI Sidebar on target window.
 * @param {Window} [targetWindow]
 * @param {Object} [options]
 * @returns {AiSidebar}
 */
function setupAiSidebar(targetWindow = null, options = {}) {
  const win = targetWindow || (typeof window !== "undefined" ? window : null);
  const doc = win && win.document ? win.document : (typeof document !== "undefined" ? document : null);

  const sidebar = new AiSidebar(options);
  if (win && sidebar.contextExtractor && typeof sidebar.contextExtractor.setWindow === "function") {
    sidebar.contextExtractor.setWindow(win);
  }
  if (doc) {
    sidebar.mount(doc);
  }
  return sidebar;
}

module.exports = {
  // Core classes & singletons
  AiSidebar,
  defaultSidebar,
  setupAiSidebar,
  ContextExtractor,
  defaultContextExtractor,
  BaseProvider,
  StreamChunk,
  ProviderError,
  OllamaProvider,
  OpenAIProvider,
  ClaudeProvider,
  LMStudioProvider,
  ProviderRegistry,
  defaultRegistry,
  // Markdown & Utilities
  renderMarkdown,
  escapeHtml,
  // Programmatic API
  ask,
  summarize
};
