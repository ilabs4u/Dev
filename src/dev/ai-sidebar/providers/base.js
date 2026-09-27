/**
 * Dev Browser - Base AI Provider
 * Defines interface, stream iteration, options validation, and abort handling.
 */

class StreamChunk {
  constructor(text = "", done = false, raw = null) {
    this.text = text;
    this.delta = text;
    this.content = text;
    this.done = Boolean(done);
    this.raw = raw;
  }

  toString() {
    return this.text;
  }

  valueOf() {
    return this.text;
  }

  [Symbol.toPrimitive]() {
    return this.text;
  }
}

class ProviderError extends Error {
  constructor(message, status = null, cause = null) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.cause = cause;
  }
}

/**
 * Async generator that decodes and yields raw lines from any stream type
 * (Web ReadableStream, Node.js Readable, string, or AsyncIterable).
 */
async function* iterateStreamLines(body) {
  if (!body) return;

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  if (typeof body === "string") {
    let str = body;
    if (str.endsWith("\n")) str = str.slice(0, -1);
    const lines = str.split(/\r?\n/);
    for (const line of lines) {
      yield line;
    }
    return;
  }

  if (body[Symbol.asyncIterator]) {
    for await (const chunk of body) {
      buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop(); // Retain remainder
      for (const line of lines) {
        yield line;
      }
    }
  } else if (typeof body.getReader === "function") {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += typeof value === "string" ? value : decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) {
          yield line;
        }
      }
    } finally {
      reader.releaseLock?.();
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}

/**
 * Async generator for Server-Sent Events (SSE).
 * Emits { event, data } items.
 */
async function* parseSseStream(body) {
  let currentEvent = null;
  const currentData = [];

  for await (const rawLine of iterateStreamLines(body)) {
    const line = rawLine.replace(/\r$/, "");

    if (!line) {
      if (currentData.length > 0) {
        yield {
          event: currentEvent || "message",
          data: currentData.join("\n")
        };
        currentEvent = null;
        currentData.length = 0;
      }
      continue;
    }

    if (line.startsWith(":")) {
      // Keep-alive or comment
      continue;
    }

    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      currentData.push(line.slice(5).trim());
    }
  }

  if (currentData.length > 0) {
    yield {
      event: currentEvent || "message",
      data: currentData.join("\n")
    };
  }
}

/**
 * Async generator for Newline-Delimited JSON (NDJSON).
 */
async function* parseNdjsonStream(body) {
  for await (const rawLine of iterateStreamLines(body)) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      yield parsed;
    } catch {
      // Ignore malformed partial lines
    }
  }
}

class BaseProvider {
  /**
   * @param {Object} config
   * @param {string} [config.id]
   * @param {string} [config.name]
   * @param {string} [config.baseUrl]
   * @param {string} [config.apiKey]
   * @param {string} [config.defaultModel]
   */
  constructor(config = {}) {
    this.id = config.id || "base";
    this.name = config.name || "Base Provider";
    this.baseUrl = config.baseUrl || "";
    this.apiKey = config.apiKey || "";
    this.defaultModel = config.defaultModel || "";
    this.config = { ...config };
  }

  /**
   * Validates and normalizes chat messages array.
   * @param {Array|string} messages
   * @returns {Array<{role: string, content: string}>}
   */
  validateMessages(messages) {
    if (!messages) {
      throw new Error("Messages array is required for chat");
    }
    if (typeof messages === "string") {
      return [{ role: "user", content: messages }];
    }
    if (!Array.isArray(messages)) {
      throw new Error("Messages must be an array or string");
    }
    if (messages.length === 0) {
      throw new Error("Messages array cannot be empty");
    }
    return messages.map((m, idx) => {
      if (!m || typeof m !== "object") {
        throw new Error(`Message at index ${idx} must be an object with role and content`);
      }
      return {
        role: m.role || "user",
        content: String(m.content ?? "")
      };
    });
  }

  /**
   * Validates and merges call options.
   * @param {Object} options
   * @returns {Object}
   */
  validateOptions(options = {}) {
    const model = options.model || this.defaultModel;
    if (!model) {
      throw new Error(`No model specified for provider ${this.name}`);
    }
    return {
      model,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      stream: options.stream ?? true,
      signal: options.signal || null,
      ...options
    };
  }

  /**
   * Sets up an AbortController linked with any external AbortSignal.
   * @param {AbortSignal} [externalSignal]
   * @returns {{ controller: AbortController, cleanup: Function }}
   */
  setupAbortController(externalSignal = null) {
    const controller = new AbortController();
    let cleanup = () => {};

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        const onAbort = () => controller.abort(externalSignal.reason);
        externalSignal.addEventListener("abort", onAbort, { once: true });
        cleanup = () => externalSignal.removeEventListener("abort", onAbort);
      }
    }

    return { controller, cleanup };
  }

  /**
   * Main chat completion stream generator.
   * @param {Array|string} messages
   * @param {Object} [options]
   * @yields {StreamChunk}
   */
  // eslint-disable-next-line no-unused-vars
  async *chat(messages, options = {}) {
    throw new Error("chat() must be implemented by subclass");
  }
}

module.exports = {
  BaseProvider,
  StreamChunk,
  ProviderError,
  iterateStreamLines,
  parseSseStream,
  parseNdjsonStream
};
