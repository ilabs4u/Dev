/**
 * Dev Browser - AI Provider Registry
 * Manages provider registration, selection, and streaming delegation.
 */

const {
  BaseProvider,
  StreamChunk,
  ProviderError,
  iterateStreamLines,
  parseSseStream,
  parseNdjsonStream
} = require("./base");
const { OllamaProvider } = require("./ollama");
const { OpenAIProvider } = require("./openai");
const { ClaudeProvider } = require("./claude");
const { LMStudioProvider } = require("./lmstudio");

class ProviderRegistry {
  constructor(options = {}) {
    this.providers = new Map();
    this.activeId = options.defaultBackend || "ollama";

    // Register built-in providers
    this.register(new OllamaProvider(options.ollama || {}));
    this.register(new OpenAIProvider(options.openai || {}));
    this.register(new ClaudeProvider(options.claude || {}));
    this.register(new LMStudioProvider(options.lmstudio || {}));

    if (options.defaultBackend && this.providers.has(options.defaultBackend)) {
      this.activeId = options.defaultBackend;
    }
  }

  /**
   * Registers a provider instance or provider factory/class.
   * @param {BaseProvider|Function} provider
   * @param {Object} [config]
   */
  register(provider, config = {}) {
    let instance;
    if (typeof provider === "function") {
      instance = new provider(config);
    } else if (provider && typeof provider.chat === "function") {
      instance = provider;
    } else {
      throw new Error("Invalid provider: must be BaseProvider instance or constructor");
    }

    if (!instance.id) {
      throw new Error("Provider must have a valid id");
    }

    this.providers.set(instance.id, instance);
    return instance;
  }

  /**
   * Checks if provider is registered.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.providers.has(id);
  }

  /**
   * Gets provider by ID.
   * @param {string} id
   * @returns {BaseProvider}
   */
  get(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderError(`Provider '${id}' is not registered`);
    }
    return provider;
  }

  /**
   * Sets active provider by ID.
   * @param {string} id
   */
  setActive(id) {
    if (!this.providers.has(id)) {
      throw new ProviderError(`Cannot activate unknown provider '${id}'`);
    }
    this.activeId = id;
  }

  /**
   * Returns current active provider.
   * @returns {BaseProvider}
   */
  getActive() {
    return this.get(this.activeId);
  }

  /**
   * Returns active provider ID.
   * @returns {string}
   */
  getActiveId() {
    return this.activeId;
  }

  /**
   * Lists all registered providers.
   * @returns {Array<{ id: string, name: string, baseUrl: string, defaultModel: string }>}
   */
  list() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      defaultModel: p.defaultModel
    }));
  }

  /**
   * Delegates chat streaming to the active or specified provider.
   * @param {Array|string} messages
   * @param {Object} [options]
   * @param {string} [options.provider]
   * @yields {StreamChunk}
   */
  async *chat(messages, options = {}) {
    const providerId = options.provider || this.activeId;
    const provider = this.get(providerId);
    for await (const chunk of provider.chat(messages, options)) {
      yield chunk;
    }
  }
}

const defaultRegistry = new ProviderRegistry();

module.exports = {
  BaseProvider,
  StreamChunk,
  ProviderError,
  iterateStreamLines,
  parseSseStream,
  parseNdjsonStream,
  OllamaProvider,
  OpenAIProvider,
  ClaudeProvider,
  LMStudioProvider,
  ProviderRegistry,
  defaultRegistry
};
