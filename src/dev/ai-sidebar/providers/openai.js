/**
 * Dev Browser - OpenAI & OpenAI-Compatible Provider
 * Supports custom baseUrl (LocalAI, vLLM, OpenRouter, etc.) and SSE streaming.
 */

const { BaseProvider, StreamChunk, ProviderError, parseSseStream } = require("./base");

class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: config.id || "openai",
      name: config.name || "OpenAI",
      baseUrl: config.baseUrl || "https://api.openai.com/v1",
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || "",
      defaultModel: config.defaultModel || "gpt-4o",
      ...config
    });
  }

  /**
   * Streams chat completions from OpenAI-compatible /chat/completions endpoint.
   * @param {Array|string} messages
   * @param {Object} [options]
   * @yields {StreamChunk}
   */
  async *chat(messages, options = {}) {
    const validMessages = this.validateMessages(messages);
    const validOptions = this.validateOptions(options);

    const { controller, cleanup } = this.setupAbortController(validOptions.signal);
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const headers = {
      "Content-Type": "application/json"
    };

    const effectiveApiKey = validOptions.apiKey || this.apiKey;
    if (effectiveApiKey) {
      headers["Authorization"] = `Bearer ${effectiveApiKey}`;
    }

    const requestBody = {
      model: validOptions.model,
      messages: validMessages,
      stream: true,
      temperature: validOptions.temperature
    };

    if (validOptions.maxTokens) {
      requestBody.max_tokens = validOptions.maxTokens;
    }

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
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
        `Failed to connect to ${this.name} at ${this.baseUrl}: ${err.message}`,
        null,
        err
      );
    }

    if (!response.ok) {
      cleanup();
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        errorBody = response.statusText;
      }

      if (response.status === 401) {
        throw new ProviderError(
          `${this.name} API error (401): Unauthorized - invalid or missing API key`,
          401
        );
      }

      throw new ProviderError(
        `${this.name} API error (${response.status}): ${errorBody || response.statusText}`,
        response.status
      );
    }

    try {
      for await (const { data } of parseSseStream(response.body)) {
        if (controller.signal.aborted) {
          const abortErr = new ProviderError("Request aborted", null);
          abortErr.name = "AbortError";
          throw abortErr;
        }

        if (data === "[DONE]") {
          yield new StreamChunk("", true);
          break;
        }

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new ProviderError(
            parsed.error.message || `${this.name} stream error`,
            response.status
          );
        }

        const choice = parsed.choices?.[0];
        const delta = choice?.delta?.content || "";
        const finishReason = choice?.finish_reason;
        const isDone = Boolean(finishReason && finishReason !== "null");

        yield new StreamChunk(delta, isDone, parsed);

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
  OpenAIProvider
};
