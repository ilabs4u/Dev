/**
 * Dev Browser - Ollama Native Provider
 * Connects to http://localhost:11434/api/chat with streaming NDJSON.
 */

const { BaseProvider, StreamChunk, ProviderError, parseNdjsonStream } = require("./base");

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: "ollama",
      name: "Ollama",
      baseUrl: config.baseUrl || "http://localhost:11434",
      defaultModel: config.defaultModel || "llama3.2",
      ...config
    });
  }

  /**
   * Streams chat tokens from Ollama /api/chat NDJSON stream.
   * @param {Array|string} messages
   * @param {Object} [options]
   * @yields {StreamChunk}
   */
  async *chat(messages, options = {}) {
    const validMessages = this.validateMessages(messages);
    const validOptions = this.validateOptions(options);

    const { controller, cleanup } = this.setupAbortController(validOptions.signal);
    const url = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;

    const requestBody = {
      model: validOptions.model,
      messages: validMessages,
      stream: true,
      options: {
        temperature: validOptions.temperature
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch (err) {
      cleanup();
      if (err.name === "AbortError" || controller.signal.aborted) {
        const abortErr = new ProviderError("Request aborted", null, err);
        abortErr.name = "AbortError";
        throw abortErr;
      }
      throw new ProviderError(
        `Failed to connect to Ollama at ${this.baseUrl}. Is Ollama running? (${err.message})`,
        null,
        err
      );
    }

    if (!response.ok) {
      cleanup();
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = response.statusText;
      }
      throw new ProviderError(
        `Ollama API error (${response.status}): ${errorText || response.statusText}`,
        response.status
      );
    }

    try {
      for await (const chunk of parseNdjsonStream(response.body)) {
        if (controller.signal.aborted) {
          const abortErr = new ProviderError("Request aborted", null);
          abortErr.name = "AbortError";
          throw abortErr;
        }

        const delta = chunk.message?.content || "";
        const isDone = Boolean(chunk.done);

        yield new StreamChunk(delta, isDone, chunk);

        if (isDone) {
          break;
        }
      }
    } catch (err) {
      if (err.name === "AbortError" || controller.signal.aborted) {
        const abortErr = new ProviderError("Request aborted", null, err);
        abortErr.name = "AbortError";
        throw abortErr;
      }
      throw err;
    } finally {
      cleanup();
    }
  }
}

module.exports = {
  OllamaProvider
};
