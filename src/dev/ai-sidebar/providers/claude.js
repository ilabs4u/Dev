/**
 * Dev Browser - Anthropic Claude Provider
 * Connects to https://api.anthropic.com/v1/messages with SSE streaming.
 */

const { BaseProvider, StreamChunk, ProviderError, parseSseStream } = require("./base");

class ClaudeProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: "claude",
      name: "Anthropic Claude",
      baseUrl: config.baseUrl || "https://api.anthropic.com",
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || "",
      defaultModel: config.defaultModel || "claude-3-5-sonnet-20241022",
      ...config
    });
  }

  /**
   * Formats messages for Claude Messages API:
   * Separates system messages into the top-level 'system' param.
   * @param {Array<{role: string, content: string}>} messages
   * @returns {{ system: string|undefined, messages: Array<{role: string, content: string}> }}
   */
  formatMessages(messages) {
    const systemParts = [];
    const chatMessages = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        chatMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content
        });
      }
    }

    // Claude requires at least one non-system message
    if (chatMessages.length === 0) {
      chatMessages.push({
        role: "user",
        content: systemParts.join("\n\n") || "Hello"
      });
      return { system: undefined, messages: chatMessages };
    }

    return {
      system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
      messages: chatMessages
    };
  }

  /**
   * Streams chat completions from Claude Messages API.
   * @param {Array|string} messages
   * @param {Object} [options]
   * @yields {StreamChunk}
   */
  async *chat(messages, options = {}) {
    const validMessages = this.validateMessages(messages);
    const validOptions = this.validateOptions(options);

    const { controller, cleanup } = this.setupAbortController(validOptions.signal);
    const url = `${this.baseUrl.replace(/\/+$/, "")}/v1/messages`;

    const effectiveApiKey = validOptions.apiKey || this.apiKey;
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01"
    };

    if (effectiveApiKey) {
      headers["x-api-key"] = effectiveApiKey;
    }

    const { system, messages: formattedMessages } = this.formatMessages(validMessages);

    const requestBody = {
      model: validOptions.model,
      messages: formattedMessages,
      max_tokens: validOptions.maxTokens || 4096,
      stream: true,
      temperature: validOptions.temperature
    };

    if (system) {
      requestBody.system = system;
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
        `Failed to connect to Claude API at ${this.baseUrl}: ${err.message}`,
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
          "Claude API error (401): Unauthorized - invalid or missing API key",
          401
        );
      }

      throw new ProviderError(
        `Claude API error (${response.status}): ${errorBody || response.statusText}`,
        response.status
      );
    }

    try {
      for await (const { event, data } of parseSseStream(response.body)) {
        if (controller.signal.aborted) {
          const abortErr = new ProviderError("Request aborted", null);
          abortErr.name = "AbortError";
          throw abortErr;
        }

        if (!data) continue;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        if (event === "error" || parsed.type === "error") {
          const errMsg = parsed.error?.message || "Claude stream error";
          throw new ProviderError(errMsg, response.status);
        }

        if (event === "content_block_delta" || parsed.type === "content_block_delta") {
          const deltaText = parsed.delta?.text || "";
          yield new StreamChunk(deltaText, false, parsed);
        } else if (event === "message_stop" || parsed.type === "message_stop") {
          yield new StreamChunk("", true, parsed);
          break;
        } else if (event === "message_delta" || parsed.type === "message_delta") {
          if (parsed.delta?.stop_reason) {
            yield new StreamChunk("", true, parsed);
            break;
          }
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
  ClaudeProvider
};
