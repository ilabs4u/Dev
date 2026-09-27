/**
 * Dev Browser - LM Studio Provider
 * Connects to http://localhost:1234/v1 extending the OpenAI-compatible streaming interface.
 */

const { OpenAIProvider } = require("./openai");

class LMStudioProvider extends OpenAIProvider {
  constructor(config = {}) {
    super({
      id: "lmstudio",
      name: "LM Studio",
      baseUrl: config.baseUrl || "http://localhost:1234/v1",
      apiKey: config.apiKey || "lm-studio",
      defaultModel: config.defaultModel || "local-model",
      ...config
    });
  }
}

module.exports = {
  LMStudioProvider
};
