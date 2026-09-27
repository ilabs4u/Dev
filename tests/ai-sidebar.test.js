const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
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
} = require("../src/dev/ai-sidebar/providers");

const {
  ContextExtractor,
  defaultContextExtractor
} = require("../src/dev/ai-sidebar/context");

const {
  AiSidebar,
  defaultSidebar,
  renderMarkdown,
  escapeHtml
} = require("../src/dev/ai-sidebar/sidebar");

const {
  ask,
  summarize,
  setupAiSidebar
} = require("../src/dev/ai-sidebar");

const { DevLuaBridge } = require("../src/dev/lua-engine/lua-bridge");
const { KeymapManager } = require("../src/dev/lua-engine/keymap");
const { VimController } = require("../src/dev/vim-mode/vim-controller");

// Helper: Mock DOM Node & Document for Node environment
class MockDOMElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.childNodes = [];
    this.attributes = new Map();
    this.style = {};
    this.innerText = "";
    this.textContent = "";
    this.innerHTML = "";
    this.value = "";
    this.className = "";
    this.scrollTop = 0;
    this.scrollHeight = 100;
    this.listeners = new Map();
    this.parentElement = null;

    const self = this;
    this.classList = {
      _classes: new Set(),
      add(c) {
        self.classList._classes.add(c);
        self.className = Array.from(self.classList._classes).join(" ");
      },
      remove(c) {
        self.classList._classes.delete(c);
        self.className = Array.from(self.classList._classes).join(" ");
      },
      contains(c) {
        return self.classList._classes.has(c);
      }
    };
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }

  getAttribute(k) {
    return this.attributes.get(k) || null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    const cIdx = this.childNodes.indexOf(child);
    if (cIdx !== -1) {
      this.childNodes.splice(cIdx, 1);
    }
    return child;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.has(type)) {
      const arr = this.listeners.get(type).filter(l => l !== listener);
      this.listeners.set(type, arr);
    }
  }

  dispatchEvent(event) {
    const type = event.type || event;
    const list = this.listeners.get(type) || [];
    for (const l of list) {
      l(event);
    }
    return true;
  }

  querySelector(selector) {
    return this._findFirst(selector);
  }

  querySelectorAll(selector) {
    const results = [];
    this._findAll(selector, results);
    return results;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr._matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  _matches(selector) {
    if (selector.startsWith(".")) {
      const cls = selector.slice(1);
      return this.classList.contains(cls);
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  _findFirst(selector) {
    for (const child of this.children) {
      if (child._matches(selector)) return child;
      const found = child._findFirst(selector);
      if (found) return found;
    }
    return null;
  }

  _findAll(selector, acc) {
    for (const child of this.children) {
      if (child._matches(selector)) acc.push(child);
      child._findAll(selector, acc);
    }
  }

  focus() {
    this.isFocused = true;
  }
}

class MockDOMDocument {
  constructor() {
    this.body = new MockDOMElement("body");
    this.title = "Test Page Title";
    this.URL = "https://example.com/test";
  }

  createElement(tag) {
    return new MockDOMElement(tag);
  }

  getElementById(id) {
    if (this.body.id === id) return this.body;
    return this.body._findFirst(`#${id}`);
  }

  querySelector(sel) {
    return this.body.querySelector(sel);
  }

  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  }
}

// Helper: create mock streaming response
function createMockStreamResponse(chunks, status = 200, statusText = "OK") {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    }
  });

  return new Response(stream, { status, statusText });
}

describe("Phase 2C: AI Sidebar (BYOM) Suite", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /* ------------------------------------------------------------------
   * 1. BaseProvider & Stream Utilities
   * ------------------------------------------------------------------ */
  describe("BaseProvider & Stream Utilities", () => {
    it("iterateStreamLines handles string, array, and fragmented streams", async () => {
      const sampleText = "line1\nline2\r\nline3\n";
      const lines = [];
      for await (const line of iterateStreamLines(sampleText)) {
        lines.push(line.replace(/\r$/, ""));
      }
      assert.deepEqual(lines, ["line1", "line2", "line3"]);

      // Fragmented ReadableStream
      const encoder = new TextEncoder();
      const fragments = ["chunk-", "1\nchunk", "-2\nchunk-3"];
      const stream = new ReadableStream({
        start(c) {
          for (const f of fragments) c.enqueue(encoder.encode(f));
          c.close();
        }
      });

      const fragLines = [];
      for await (const l of iterateStreamLines(stream)) {
        fragLines.push(l);
      }
      assert.deepEqual(fragLines, ["chunk-1", "chunk-2", "chunk-3"]);
    });

    it("parseSseStream handles events, comments, and data payloads", async () => {
      const ssePayload = [
        ": keepalive comment\n",
        "event: custom_event\n",
        "data: {\"hello\":\"world\"}\n\n",
        "data: [DONE]\n\n"
      ].join("");

      const events = [];
      for await (const ev of parseSseStream(ssePayload)) {
        events.push(ev);
      }

      assert.equal(events.length, 2);
      assert.equal(events[0].event, "custom_event");
      assert.equal(events[0].data, '{"hello":"world"}');
      assert.equal(events[1].data, "[DONE]");
    });

    it("parseNdjsonStream parses newline-delimited JSON and ignores invalid lines", async () => {
      const ndjson = '{"a":1}\n\n{"b":2}\ninvalid json line\n{"c":3}\n';
      const items = [];
      for await (const item of parseNdjsonStream(ndjson)) {
        items.push(item);
      }
      assert.deepEqual(items, [{ a: 1 }, { b: 2 }, { c: 3 }]);
    });

    it("StreamChunk supports text, delta, done, and primitive coercion", () => {
      const chunk = new StreamChunk("hello", false, { raw: 1 });
      assert.equal(chunk.text, "hello");
      assert.equal(chunk.delta, "hello");
      assert.equal(chunk.done, false);
      assert.equal(String(chunk), "hello");
      assert.equal(`${chunk} world`, "hello world");
    });

    it("BaseProvider validates messages and options correctly", () => {
      const provider = new BaseProvider({ defaultModel: "test-model" });

      // Validates string prompt into user message array
      const m1 = provider.validateMessages("single prompt");
      assert.deepEqual(m1, [{ role: "user", content: "single prompt" }]);

      // Validates array
      const m2 = provider.validateMessages([{ role: "assistant", content: "hi" }]);
      assert.deepEqual(m2, [{ role: "assistant", content: "hi" }]);

      // Throws on empty
      assert.throws(() => provider.validateMessages([]), /Messages array cannot be empty/);
      assert.throws(() => provider.validateMessages(null), /Messages array is required/);

      // Options validation
      const opts = provider.validateOptions({ temperature: 0.2 });
      assert.equal(opts.model, "test-model");
      assert.equal(opts.temperature, 0.2);

      const noModelProvider = new BaseProvider();
      assert.throws(() => noModelProvider.validateOptions(), /No model specified/);
    });

    it("BaseProvider setupAbortController handles external abort signals", () => {
      const provider = new BaseProvider();
      const externalController = new AbortController();
      const { controller, cleanup } = provider.setupAbortController(externalController.signal);

      assert.equal(controller.signal.aborted, false);
      externalController.abort("cancelled");
      assert.equal(controller.signal.aborted, true);
      cleanup();
    });
  });

  /* ------------------------------------------------------------------
   * 2. OllamaProvider
   * ------------------------------------------------------------------ */
  describe("OllamaProvider", () => {
    it("streams chat tokens via NDJSON from /api/chat", async () => {
      const provider = new OllamaProvider({ baseUrl: "http://localhost:11434" });

      const mockChunks = [
        JSON.stringify({ message: { role: "assistant", content: "Hello" }, done: false }) + "\n",
        JSON.stringify({ message: { role: "assistant", content: " from" }, done: false }) + "\n",
        JSON.stringify({ message: { role: "assistant", content: " Ollama" }, done: true }) + "\n"
      ];

      let capturedUrl = "";
      let capturedBody = null;

      globalThis.fetch = async (url, opts) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return createMockStreamResponse(mockChunks);
      };

      const tokens = [];
      for await (const chunk of provider.chat("Hello test", { model: "llama3.2" })) {
        tokens.push(chunk.text);
      }

      assert.equal(capturedUrl, "http://localhost:11434/api/chat");
      assert.equal(capturedBody.model, "llama3.2");
      assert.equal(capturedBody.stream, true);
      assert.deepEqual(tokens, ["Hello", " from", " Ollama"]);
    });

    it("handles offline server with clear connection error", async () => {
      const provider = new OllamaProvider({ baseUrl: "http://localhost:11434" });

      globalThis.fetch = async () => {
        throw new TypeError("fetch failed: connect ECONNREFUSED 127.0.0.1:11434");
      };

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("test")) {
          // should not reach
        }
      }, /Is Ollama running/);
    });

    it("handles HTTP 500 error response from Ollama", async () => {
      const provider = new OllamaProvider();
      globalThis.fetch = async () => {
        return new Response("model 'unknown-model' not found", { status: 500, statusText: "Internal Error" });
      };

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("test", { model: "unknown-model" })) {
          // should not reach
        }
      }, /Ollama API error \(500\)/);
    });

    it("supports stream cancellation via AbortSignal", async () => {
      const provider = new OllamaProvider();
      const controller = new AbortController();

      globalThis.fetch = async (url, opts) => {
        const stream = new ReadableStream({
          async start(c) {
            c.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: "part1" }, done: false }) + "\n"));
            // simulate abort before next chunk
            controller.abort();
            c.close();
          }
        });
        return new Response(stream, { status: 200 });
      };

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("test", { signal: controller.signal })) {
          // aborted during iteration
        }
      }, (err) => err.name === "AbortError");
    });
  });

  /* ------------------------------------------------------------------
   * 3. OpenAIProvider
   * ------------------------------------------------------------------ */
  describe("OpenAIProvider", () => {
    it("streams chat completions via SSE and handles custom baseUrl and [DONE]", async () => {
      const provider = new OpenAIProvider({
        baseUrl: "http://localhost:8000/v1",
        apiKey: "sk-mock-key",
        defaultModel: "gpt-4o"
      });

      const mockSse = [
        'data: {"id":"1","choices":[{"delta":{"content":"OpenAI"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"2","choices":[{"delta":{"content":" streaming"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"3","choices":[{"delta":{"content":" works!"},"index":0,"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n"
      ];

      let capturedUrl = "";
      let capturedAuth = "";

      globalThis.fetch = async (url, opts) => {
        capturedUrl = url;
        capturedAuth = opts.headers["Authorization"];
        return createMockStreamResponse(mockSse);
      };

      const chunks = [];
      for await (const chunk of provider.chat([{ role: "user", content: "hi" }])) {
        chunks.push(chunk.text);
      }

      assert.equal(capturedUrl, "http://localhost:8000/v1/chat/completions");
      assert.equal(capturedAuth, "Bearer sk-mock-key");
      assert.deepEqual(chunks, ["OpenAI", " streaming", " works!"]);
    });

    it("handles 401 Unauthorized error with specific message", async () => {
      const provider = new OpenAIProvider({ apiKey: "bad-key" });

      globalThis.fetch = async () => {
        return new Response('{"error":{"message":"Incorrect API key provided"}}', {
          status: 401,
          statusText: "Unauthorized"
        });
      };

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("hi")) {
          // error expected
        }
      }, /Unauthorized - invalid or missing API key/);
    });

    it("handles stream error payload inside SSE", async () => {
      const provider = new OpenAIProvider();
      const mockSse = [
        'data: {"error":{"message":"Rate limit exceeded","type":"rate_limit"}}\n\n'
      ];

      globalThis.fetch = async () => createMockStreamResponse(mockSse);

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("hi")) {
          // error expected
        }
      }, /Rate limit exceeded/);
    });

    it("aborts stream via AbortSignal", async () => {
      const provider = new OpenAIProvider();
      const controller = new AbortController();
      controller.abort();

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("hi", { signal: controller.signal })) {
          // aborted immediately
        }
      }, (err) => err.name === "AbortError");
    });
  });

  /* ------------------------------------------------------------------
   * 4. ClaudeProvider
   * ------------------------------------------------------------------ */
  describe("ClaudeProvider", () => {
    it("streams content_block_delta, sets headers, and isolates system prompt", async () => {
      const provider = new ClaudeProvider({
        apiKey: "sk-ant-test-key",
        defaultModel: "claude-3-5-sonnet-20241022"
      });

      const mockSse = [
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Claude"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" response"}}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n'
      ];

      let capturedHeaders = null;
      let capturedBody = null;

      globalThis.fetch = async (url, opts) => {
        capturedHeaders = opts.headers;
        capturedBody = JSON.parse(opts.body);
        return createMockStreamResponse(mockSse);
      };

      const messages = [
        { role: "system", content: "You are a coding tutor" },
        { role: "user", content: "Explain async" }
      ];

      const parts = [];
      for await (const chunk of provider.chat(messages)) {
        parts.push(chunk.text);
      }

      assert.equal(capturedHeaders["x-api-key"], "sk-ant-test-key");
      assert.equal(capturedHeaders["anthropic-version"], "2023-06-01");
      assert.equal(capturedBody.system, "You are a coding tutor");
      assert.deepEqual(capturedBody.messages, [{ role: "user", content: "Explain async" }]);
      assert.deepEqual(parts, ["Claude", " response", ""]);
    });

    it("handles Claude 401 Unauthorized", async () => {
      const provider = new ClaudeProvider({ apiKey: "invalid" });
      globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("test")) {}
      }, /Unauthorized - invalid or missing API key/);
    });

    it("handles Claude streaming error event", async () => {
      const provider = new ClaudeProvider();
      const mockSse = [
        'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Anthropic is overloaded"}}\n\n'
      ];
      globalThis.fetch = async () => createMockStreamResponse(mockSse);

      await assert.rejects(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of provider.chat("test")) {}
      }, /Anthropic is overloaded/);
    });
  });

  /* ------------------------------------------------------------------
   * 5. LMStudioProvider
   * ------------------------------------------------------------------ */
  describe("LMStudioProvider", () => {
    it("extends OpenAIProvider on http://localhost:1234/v1 with local-model", async () => {
      const provider = new LMStudioProvider();
      assert.equal(provider.baseUrl, "http://localhost:1234/v1");
      assert.equal(provider.id, "lmstudio");
      assert.equal(provider.defaultModel, "local-model");
      assert.ok(provider instanceof OpenAIProvider);

      let requestedUrl = "";
      globalThis.fetch = async (url) => {
        requestedUrl = url;
        const mockSse = ['data: {"choices":[{"delta":{"content":"LMStudio output"}}]}\n\n', 'data: [DONE]\n\n'];
        return createMockStreamResponse(mockSse);
      };

      const res = [];
      for await (const chunk of provider.chat("hi")) {
        res.push(chunk.text);
      }

      assert.equal(requestedUrl, "http://localhost:1234/v1/chat/completions");
      assert.ok(res.includes("LMStudio output"));
    });
  });

  /* ------------------------------------------------------------------
   * 6. ProviderRegistry
   * ------------------------------------------------------------------ */
  describe("ProviderRegistry", () => {
    it("contains all 4 built-in providers and allows runtime switching", () => {
      const registry = new ProviderRegistry();
      assert.ok(registry.has("ollama"));
      assert.ok(registry.has("openai"));
      assert.ok(registry.has("claude"));
      assert.ok(registry.has("lmstudio"));

      assert.equal(registry.getActiveId(), "ollama");
      registry.setActive("claude");
      assert.equal(registry.getActiveId(), "claude");

      assert.throws(() => registry.setActive("non-existent"), /Cannot activate unknown provider/);

      const list = registry.list();
      assert.equal(list.length, 4);
      assert.ok(list.some(p => p.id === "lmstudio"));
    });

    it("registers custom provider instance and delegates chat()", async () => {
      const registry = new ProviderRegistry();

      class MockCustomProvider extends BaseProvider {
        constructor() {
          super({ id: "mock-custom", name: "Mock Custom" });
        }
        async *chat() {
          yield new StreamChunk("custom token 1");
          yield new StreamChunk("custom token 2");
        }
      }

      registry.register(new MockCustomProvider());
      assert.ok(registry.has("mock-custom"));

      const tokens = [];
      for await (const chunk of registry.chat("hello", { provider: "mock-custom" })) {
        tokens.push(chunk.text);
      }
      assert.deepEqual(tokens, ["custom token 1", "custom token 2"]);
    });
  });

  /* ------------------------------------------------------------------
   * 7. ContextExtractor
   * ------------------------------------------------------------------ */
  describe("ContextExtractor", () => {
    it("extracts page text with whitespace cleanup and truncation limit", () => {
      const extractor = new ContextExtractor({ maxTextLength: 30, attachConsole: false });
      const mockDoc = {
        title: "Test Page",
        URL: "https://example.com",
        body: { innerText: "This is a very long page text content that will exceed thirty characters" }
      };

      const extracted = extractor.extractPageText({ document: mockDoc });
      assert.equal(extracted.title, "Test Page");
      assert.equal(extracted.url, "https://example.com");
      assert.equal(extracted.truncated, true);
      assert.ok(extracted.text.includes("[content truncated]"));
    });

    it("extracts text selection and manages console error buffer", () => {
      const extractor = new ContextExtractor({ attachConsole: false });

      // Selection mock
      const mockWin = {
        getSelection: () => ({ toString: () => "selected code snippet" })
      };
      extractor.setWindow(mockWin);
      assert.equal(extractor.extractSelection(), "selected code snippet");

      // Error buffer
      extractor.addConsoleError("ReferenceError: x is not defined");
      extractor.addConsoleError({ message: "Network timeout", source: "api.js", lineno: 42 });

      const errors = extractor.extractConsoleErrors();
      assert.equal(errors.length, 2);
      assert.equal(errors[0].message, "ReferenceError: x is not defined");
      assert.equal(errors[1].lineno, 42);

      extractor.clearErrors();
      assert.equal(extractor.extractConsoleErrors().length, 0);
    });

    it("formats Agent Tree summary and builds context prompts", () => {
      const extractor = new ContextExtractor({ attachConsole: false });

      const mockElements = [
        { label: "A", tag: "button", text: "Submit Order", role: "button", selector: "#submit-btn" },
        { label: "B", tag: "input", text: "Email Address", role: "textbox", selector: "#email" }
      ];

      const summary = extractor.formatAgentTreeSummary(mockElements);
      assert.ok(summary.includes('[A] <button> "Submit Order" (button) [#submit-btn]'));
      assert.ok(summary.includes('[B] <input> "Email Address" (textbox) [#email]'));

      // Summarize prompt
      const sumItem = extractor.buildSummarizePrompt({ text: "Hello page content", title: "My Page" });
      assert.ok(sumItem.prompt.includes("My Page"));
      assert.ok(sumItem.prompt.includes("Hello page content"));

      // Explain error prompt
      const errItem = extractor.buildExplainErrorPrompt({
        errors: [{ message: "Uncaught TypeError: cannot read properties of undefined" }]
      });
      assert.ok(errItem.prompt.includes("Uncaught TypeError"));

      // Analyze page prompt
      const analyzeItem = extractor.buildAnalyzePagePrompt({ elements: mockElements, title: "Dashboard" });
      assert.ok(analyzeItem.prompt.includes("Interactive Elements (Agent Tree)"));
      assert.ok(analyzeItem.prompt.includes("[A] <button>"));

      // Selection prompt
      const selItem = extractor.buildSelectionPrompt("selected text fragment");
      assert.ok(selItem.prompt.includes("selected text fragment"));
    });
  });

  /* ------------------------------------------------------------------
   * 8. Markdown Parsing & Code Block Extraction
   * ------------------------------------------------------------------ */
  describe("Markdown Parsing & Code Block Extraction", () => {
    it("renders headers, bold, italics, inline code, and lists", () => {
      const md = "# Title\n## Subtitle\n**bold text** and *italic text* with `console.log()`";
      const html = renderMarkdown(md);

      assert.ok(html.includes("<h1>Title</h1>"));
      assert.ok(html.includes("<h2>Subtitle</h2>"));
      assert.ok(html.includes("<strong>bold text</strong>"));
      assert.ok(html.includes("<em>italic text</em>"));
      assert.ok(html.includes("<code>console.log()</code>"));
    });

    it("extracts code blocks with language badge and copy button attribute", () => {
      const md = "```javascript\nconst a = 10;\nconsole.log(a);\n```";
      const html = renderMarkdown(md);

      assert.ok(html.includes('<div class="ai-code-block">'));
      assert.ok(html.includes('<span class="ai-code-lang">javascript</span>'));
      assert.ok(html.includes('class="ai-code-copy"'));
      assert.ok(html.includes("const a = 10;"));
    });

    it("handles unclosed streaming code blocks gracefully", () => {
      const streamingMd = "Here is the code:\n```python\ndef solve():\n    return 42";
      const html = renderMarkdown(streamingMd);

      assert.ok(html.includes('<div class="ai-code-block">'));
      assert.ok(html.includes('<span class="ai-code-lang">python</span>'));
      assert.ok(html.includes("def solve():"));
    });

    it("escapes dangerous HTML tags to protect against XSS", () => {
      const malicious = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
      const safe = renderMarkdown(malicious);

      assert.ok(!safe.includes("<script>"));
      assert.ok(safe.includes("&lt;script&gt;"));
      assert.ok(!safe.includes("<img"));
      assert.ok(safe.includes("&lt;img"));
    });
  });

  /* ------------------------------------------------------------------
   * 9. AiSidebar UI & Session State
   * ------------------------------------------------------------------ */
  describe("AiSidebar UI & Session State", () => {
    it("mounts into DOM, opens, closes, toggles and tracks state", () => {
      const doc = new MockDOMDocument();
      const sidebar = new AiSidebar();
      const mounted = sidebar.mount(doc);
      assert.equal(mounted, true);

      assert.equal(sidebar.isOpen, false);
      sidebar.open();
      assert.equal(sidebar.isOpen, true);
      assert.equal(sidebar.dom.sidebar.classList.contains("collapsed"), false);

      sidebar.close();
      assert.equal(sidebar.isOpen, false);
      assert.equal(sidebar.dom.sidebar.classList.contains("collapsed"), true);

      sidebar.toggle();
      assert.equal(sidebar.isOpen, true);
    });

    it("updates provider when select element changes", () => {
      const doc = new MockDOMDocument();
      const sidebar = new AiSidebar();
      sidebar.mount(doc);

      if (sidebar.dom.selectProvider) {
        sidebar.dom.selectProvider.value = "claude";
        sidebar.dom.selectProvider.dispatchEvent({ type: "change", target: sidebar.dom.selectProvider });
        assert.equal(sidebar.registry.getActiveId(), "claude");
      }
    });

    it("sendMessage() streams tokens into assistant bubble and handles stop", async () => {
      const doc = new MockDOMDocument();
      const registry = new ProviderRegistry();

      class MockStreamingProvider extends BaseProvider {
        constructor() {
          super({ id: "mock-stream", defaultModel: "test-model" });
        }
        async *chat(msgs, opts) {
          for (const word of ["Hello", " user,", " this", " is", " streaming!"]) {
            if (opts.signal?.aborted) return;
            yield new StreamChunk(word);
          }
        }
      }

      registry.register(new MockStreamingProvider());
      registry.setActive("mock-stream");

      const sidebar = new AiSidebar({ registry });
      sidebar.mount(doc);

      let stateChanges = 0;
      sidebar.onStateChange(() => stateChanges++);

      await sidebar.sendMessage("Test query");

      assert.ok(stateChanges > 0);
      assert.equal(sidebar.messages.length, 2);
      assert.equal(sidebar.messages[0].role, "user");
      assert.equal(sidebar.messages[0].content, "Test query");
      assert.equal(sidebar.messages[1].role, "assistant");
      assert.ok(sidebar.messages[1].content.includes("Hello user, this is streaming!"));

      // Clear history
      sidebar.clearHistory();
      assert.equal(sidebar.messages.length, 0);
    });

    it("stopGeneration() aborts active streaming process", async () => {
      const doc = new MockDOMDocument();
      const registry = new ProviderRegistry();

      class InfiniteStreamProvider extends BaseProvider {
        constructor() {
          super({ id: "inf-stream" });
        }
        async *chat(msgs, opts) {
          yield new StreamChunk("Token1");
          // Wait for abort signal
          while (!opts.signal?.aborted) {
            await new Promise(r => setTimeout(r, 10));
          }
          const err = new Error("Request aborted");
          err.name = "AbortError";
          throw err;
        }
      }

      registry.register(new InfiniteStreamProvider());
      registry.setActive("inf-stream");

      const sidebar = new AiSidebar({ registry });
      sidebar.mount(doc);

      const sendPromise = sidebar.sendMessage("Long query");
      // Stop after 20ms
      setTimeout(() => sidebar.stopGeneration(), 20);
      await sendPromise;

      assert.equal(sidebar.isStreaming, false);
      assert.ok(sidebar.messages[1].content.includes("[Stopped]"));
    });

    it("handleChipAction invokes context extractor and sends corresponding prompt", async () => {
      const doc = new MockDOMDocument();
      const registry = new ProviderRegistry();
      let lastPrompt = "";

      class RecordingProvider extends BaseProvider {
        constructor() { super({ id: "rec" }); }
        async *chat(msgs) {
          lastPrompt = msgs[msgs.length - 1].content;
          yield new StreamChunk("Done");
        }
      }

      registry.register(new RecordingProvider());
      registry.setActive("rec");

      const extractor = new ContextExtractor({ attachConsole: false });
      extractor.extractPageText = () => ({ title: "Doc Title", text: "Page body text", url: "https://foo" });

      const sidebar = new AiSidebar({ registry, contextExtractor: extractor });
      sidebar.mount(doc);

      sidebar.handleChipAction("summarize-page");
      // wait for microtasks
      await new Promise(r => setTimeout(r, 20));

      assert.ok(lastPrompt.includes("Please summarize the following webpage"));
      assert.ok(lastPrompt.includes("Doc Title"));
    });
  });

  /* ------------------------------------------------------------------
   * 10. Programmatic Helpers & Lua Bridge Integration
   * ------------------------------------------------------------------ */
  describe("Programmatic Helpers & Lua Bridge Integration", () => {
    it("ask() and summarize() helpers collect full streaming text", async () => {
      const registry = new ProviderRegistry();

      class EchoProvider extends BaseProvider {
        constructor() { super({ id: "echo", defaultModel: "echo-1" }); }
        async *chat(msgs) {
          yield new StreamChunk("Response to: ");
          yield new StreamChunk(msgs[msgs.length - 1].content.slice(0, 10));
        }
      }

      registry.register(new EchoProvider());
      registry.setActive("echo");

      const ans = await ask("What is gravity?", { registry });
      assert.equal(ans, "Response to: What is gr");

      const sum = await summarize("A very long article", { registry });
      assert.ok(sum.startsWith("Response to: "));
    });

    it("LuaBridge parses ai.default_backend and ai.<provider>.<key> config", () => {
      const bridge = new DevLuaBridge();
      bridge.init();

      const luaScript = `
        ai.default_backend = "openai"
        ai.ollama.model = "mistral"
        ai.ollama.url = "http://127.0.0.1:11434"
        ai.openai.model = "gpt-4o-mini"
      `;

      bridge.evaluateLuaScript(luaScript);

      assert.equal(bridge.aiSettings.default_backend, "openai");
      assert.equal(bridge.aiSettings.ollama.model, "mistral");
      assert.equal(bridge.aiSettings.ollama.url, "http://127.0.0.1:11434");
      assert.equal(bridge.aiSettings.openai.model, "gpt-4o-mini");
      assert.equal(bridge.getDefaultBackend(), "openai");

      bridge.setDefaultBackend("claude");
      assert.equal(bridge.getDefaultBackend(), "claude");
    });

    it("LuaBridge.ask() and LuaBridge.summarize() execute via active AI provider", async () => {
      const bridge = new DevLuaBridge();
      bridge.init();

      // Register mock into defaultRegistry for test
      class LuaMockProvider extends BaseProvider {
        constructor() { super({ id: "lua-mock" }); }
        async *chat(msgs) {
          yield new StreamChunk(`Answer to: ${msgs[msgs.length - 1].content}`);
        }
      }
      defaultRegistry.register(new LuaMockProvider());
      bridge.setDefaultBackend("lua-mock");

      const response = await bridge.ask("Explain closures in Lua");
      assert.equal(response, "Answer to: Explain closures in Lua");

      const summary = await bridge.summarize("Long text snippet");
      assert.ok(summary.includes("Answer to: Please summarize"));
    });
  });

  /* ------------------------------------------------------------------
   * 11. Vim Mode <leader>ai Toggle Integration
   * ------------------------------------------------------------------ */
  describe("Vim Mode <leader>ai Toggle Integration", () => {
    it("VimController toggles AI sidebar via <leader>ai shortcut", () => {
      const keymapMgr = new KeymapManager({ leaderKey: "\\" });
      let sidebarToggled = false;
      const mockSidebar = {
        toggle: () => {
          sidebarToggled = !sidebarToggled;
          return sidebarToggled;
        }
      };

      const vim = new VimController({
        keymap: keymapMgr,
        aiSidebar: mockSidebar
      });

      // Press \ then a then i
      keymapMgr.handleKeyEvent({ key: "\\", preventDefault() {} });
      keymapMgr.handleKeyEvent({ key: "a", preventDefault() {} });
      const res = keymapMgr.handleKeyEvent({ key: "i", preventDefault() {} });

      assert.equal(res.handled, true);
      assert.equal(res.action, "toggle_ai_sidebar");
      assert.equal(sidebarToggled, true);
    });

    it("VimController delegates toggleAiSidebar via browserDelegate", () => {
      const keymapMgr = new KeymapManager({ leaderKey: "\\" });
      let delegateCalled = false;

      const vim = new VimController({
        keymap: keymapMgr,
        browserDelegate: {
          toggleAiSidebar: () => {
            delegateCalled = true;
            return true;
          }
        }
      });

      keymapMgr.handleKeyEvent({ key: "\\", preventDefault() {} });
      keymapMgr.handleKeyEvent({ key: "a", preventDefault() {} });
      keymapMgr.handleKeyEvent({ key: "i", preventDefault() {} });

      assert.equal(delegateCalled, true);
    });

    it("VimController defaultDelegate falls back to defaultSidebar.toggle()", () => {
      const keymapMgr = new KeymapManager({ leaderKey: "\\" });
      let defaultToggled = false;
      defaultSidebar.toggle = () => {
        defaultToggled = true;
        return true;
      };

      const vim = new VimController({
        keymap: keymapMgr
      });

      keymapMgr.handleKeyEvent({ key: "\\", preventDefault() {} });
      keymapMgr.handleKeyEvent({ key: "a", preventDefault() {} });
      keymapMgr.handleKeyEvent({ key: "i", preventDefault() {} });

      assert.equal(defaultToggled, true);
    });
  });

  /* ------------------------------------------------------------------
   * 12. Robustness & Edge Cases Verification
   * ------------------------------------------------------------------ */
  describe("Robustness & Edge Cases Verification", () => {
    it("BaseProvider.validateMessages handles null and undefined contents safely", () => {
      const provider = new BaseProvider({ defaultModel: "m" });
      const msgs = provider.validateMessages([
        { role: "user", content: null },
        { role: "assistant", content: undefined }
      ]);
      assert.equal(msgs[0].content, "");
      assert.equal(msgs[1].content, "");
    });

    it("parseSseStream joins multi-line data payloads according to SSE spec", async () => {
      const multilineSse = "data: line 1\ndata: line 2\n\n";
      const events = [];
      for await (const ev of parseSseStream(multilineSse)) {
        events.push(ev);
      }
      assert.equal(events.length, 1);
      assert.equal(events[0].data, "line 1\nline 2");
    });

    it("ClaudeProvider ignores non-text deltas without error", async () => {
      const provider = new ClaudeProvider();
      const mockSse = [
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"a\\":1}"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Real text"}}\n\n'
      ];
      globalThis.fetch = async () => createMockStreamResponse(mockSse);

      const chunks = [];
      for await (const c of provider.chat("hi")) {
        if (c.text) chunks.push(c.text);
      }
      assert.deepEqual(chunks, ["Real text"]);
    });

    it("OpenAIProvider handles stream chunk with empty choices array without crashing", async () => {
      const provider = new OpenAIProvider();
      const mockSse = [
        'data: {"id":"1","choices":[]}\n\n',
        'data: {"id":"2","choices":[{"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n'
      ];
      globalThis.fetch = async () => createMockStreamResponse(mockSse);

      const received = [];
      for await (const chunk of provider.chat("test")) {
        if (chunk.text) received.push(chunk.text);
      }
      assert.deepEqual(received, ["ok"]);
    });

    it("OllamaProvider handles metadata-only chunks without message content", async () => {
      const provider = new OllamaProvider();
      const mockNdjson = [
        '{"model":"llama3.2","total_duration":100}\n',
        '{"model":"llama3.2","message":{"content":"hello"},"done":false}\n',
        '{"model":"llama3.2","done":true}\n'
      ];
      globalThis.fetch = async () => createMockStreamResponse(mockNdjson);

      const tokens = [];
      for await (const chunk of provider.chat("test")) {
        if (chunk.text) tokens.push(chunk.text);
      }
      assert.deepEqual(tokens, ["hello"]);
    });

    it("ContextExtractor returns empty structure when document is null or missing body", () => {
      const extractor = new ContextExtractor({ attachConsole: false });
      const res = extractor.extractPageText({ document: null });
      assert.equal(res.text, "");
      assert.equal(res.title, "");
      assert.equal(res.truncated, false);

      const resNoBody = extractor.extractPageText({ document: {} });
      assert.equal(resNoBody.text, "");
    });

    it("ContextExtractor enforces error buffer cap", () => {
      const extractor = new ContextExtractor({ maxErrorBuffer: 3, attachConsole: false });
      extractor.addConsoleError("err1");
      extractor.addConsoleError("err2");
      extractor.addConsoleError("err3");
      extractor.addConsoleError("err4");

      const errors = extractor.extractConsoleErrors();
      assert.equal(errors.length, 3);
      assert.equal(errors[0].message, "err2");
      assert.equal(errors[2].message, "err4");
    });

    it("renderMarkdown handles code blocks containing special characters and unformatted markdown", () => {
      const codeSnippet = "```python\n# This should not be **bold**\nx = '<script>' & 1\n```";
      const rendered = renderMarkdown(codeSnippet);

      assert.ok(!rendered.includes("<strong>bold</strong>"));
      assert.ok(rendered.includes("# This should not be **bold**"));
      assert.ok(rendered.includes("&lt;script&gt;"));
      assert.ok(rendered.includes("&amp;"));
    });

    it("AiSidebar.sendMessage ignores empty or whitespace-only prompts", async () => {
      const sidebar = new AiSidebar();
      let called = false;
      sidebar.registry = {
        chat: async function* () {
          called = true;
          yield new StreamChunk("noop");
        },
        getActiveId: () => "ollama"
      };

      await sidebar.sendMessage("");
      await sidebar.sendMessage("   \t\n  ");
      assert.equal(called, false);
      assert.equal(sidebar.messages.length, 0);
    });

    it("setupAiSidebar helper mounts sidebar into target window", () => {
      const doc = new MockDOMDocument();
      const mockWin = { document: doc };
      const sidebar = setupAiSidebar(mockWin);

      assert.ok(sidebar instanceof AiSidebar);
      assert.ok(sidebar.dom.sidebar);
    });

    it("DevLuaBridge throws descriptive error when calling ask() with unknown provider", async () => {
      const bridge = new DevLuaBridge();
      bridge.init();
      bridge.setDefaultBackend("unknown-ghost-provider");

      await assert.rejects(async () => {
        await bridge.ask("hello");
      }, /Provider 'unknown-ghost-provider' is not registered/);
    });

    it("iterateStreamLines yields lines from synchronous Arrays of strings and Uint8Arrays", async () => {
      const stringArray = ["line 1\n", "line 2\n", "line 3"];
      const lines = [];
      for await (const line of iterateStreamLines(stringArray)) {
        lines.push(line);
      }
      assert.deepEqual(lines, ["line 1", "line 2", "line 3"]);

      const encoder = new TextEncoder();
      const uintArray = [encoder.encode("part A\n"), encoder.encode("part B\n")];
      const uintLines = [];
      for await (const line of iterateStreamLines(uintArray)) {
        uintLines.push(line);
      }
      assert.deepEqual(uintLines, ["part A", "part B"]);
    });

    it("parseSseStream preserves code indentation without aggressive trim()", async () => {
      const payload = "data:    def my_code():\n\n";
      const events = [];
      for await (const ev of parseSseStream(payload)) {
        events.push(ev);
      }
      assert.equal(events.length, 1);
      assert.equal(events[0].data, "   def my_code():");
    });

    it("StreamChunk supports isDone getter and setter alias", () => {
      const chunk = new StreamChunk("foo", false);
      assert.equal(chunk.done, false);
      assert.equal(chunk.isDone, false);
      chunk.isDone = true;
      assert.equal(chunk.done, true);
      assert.equal(chunk.isDone, true);
    });

    it("ClaudeProvider formatMessages merges consecutive user messages and ensures leading user role", () => {
      const provider = new ClaudeProvider();
      const input = [
        { role: "system", content: "You are an assistant." },
        { role: "user", content: "First question." },
        { role: "user", content: "Followup elaboration." },
        { role: "assistant", content: "Response." },
        { role: "assistant", content: "More response." }
      ];

      const formatted = provider.formatMessages(input);
      assert.equal(formatted.system, "You are an assistant.");
      assert.equal(formatted.messages.length, 2);
      assert.equal(formatted.messages[0].role, "user");
      assert.equal(formatted.messages[0].content, "First question.\n\nFollowup elaboration.");
      assert.equal(formatted.messages[1].role, "assistant");
      assert.equal(formatted.messages[1].content, "Response.\n\nMore response.");

      // Initial assistant message handling
      const leadingAssistant = [{ role: "assistant", content: "Hi" }];
      const res = provider.formatMessages(leadingAssistant);
      assert.equal(res.messages[0].role, "user");
      assert.equal(res.messages[1].role, "assistant");
    });

    it("ClaudeProvider sends anthropic-dangerous-direct-browser-access header", async () => {
      const provider = new ClaudeProvider({ apiKey: "sk-ant-test" });
      let capturedHeaders = null;

      globalThis.fetch = async (url, options) => {
        capturedHeaders = options.headers;
        return createMockStreamResponse(["event: message_stop\ndata: {}\n\n"]);
      };

      for await (const chunk of provider.chat("hello")) {
        // consume
      }

      assert.equal(capturedHeaders["anthropic-dangerous-direct-browser-access"], "true");
      assert.equal(capturedHeaders["x-api-key"], "sk-ant-test");
    });

    it("renderMarkdown parses CRLF code blocks and preserves regex tokens without corruption", () => {
      const inputWithTokens = "```bash\r\necho $1 and $& and $` and $'\r\n```";
      const rendered = renderMarkdown(inputWithTokens);

      assert.ok(rendered.includes('<pre><code class="language-bash">echo $1 and $&amp; and $` and $&#039;'));
      assert.ok(!rendered.includes("__CODE_BLOCK_"));
    });

    it("renderMarkdown formats headings H4-H6 and safe links", () => {
      const md = "#### H4 Title\n##### H5 Title\n###### H6 Title\n[Visit Us](https://example.com)";
      const rendered = renderMarkdown(md);

      assert.ok(rendered.includes("<h4>H4 Title</h4>"));
      assert.ok(rendered.includes("<h5>H5 Title</h5>"));
      assert.ok(rendered.includes("<h6>H6 Title</h6>"));
      assert.ok(rendered.includes('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Visit Us</a>'));
    });

    it("ContextExtractor captures unhandledrejection and respects empty string and custom maxLength", () => {
      const listeners = new Map();
      const mockWin = {
        addEventListener: (event, handler) => listeners.set(event, handler)
      };

      const extractor = new ContextExtractor({ window: mockWin });
      const rejectHandler = listeners.get("unhandledrejection");
      assert.ok(typeof rejectHandler === "function");

      rejectHandler({ reason: new Error("Network timeout") });
      const errors = extractor.extractConsoleErrors();
      assert.equal(errors.length, 1);
      assert.ok(errors[0].message.includes("Network timeout"));

      // opts.text = "" should return empty without falling back to window.document
      const emptyRes = extractor.extractPageText({ text: "" });
      assert.equal(emptyRes.text, "");
      assert.equal(emptyRes.truncated, false);

      // custom maxLength
      const truncRes = extractor.extractPageText({ text: "1234567890", maxLength: 5 });
      assert.ok(truncRes.text.startsWith("12345"));
      assert.equal(truncRes.truncated, true);
    });

    it("DevLuaBridge updates defaultRegistry on assignment and propagates custom url and apiKey", async () => {
      const bridge = new DevLuaBridge();
      bridge.init();

      bridge.evaluateLuaScript('ai.default_backend = "lmstudio"');
      assert.equal(bridge.getDefaultBackend(), "lmstudio");
      assert.equal(defaultRegistry.getActiveId(), "lmstudio");

      // Set custom url and apiKey in Lua
      bridge.evaluateLuaScript('ai.ollama.url = "http://custom-ollama:11434"');
      bridge.evaluateLuaScript('ai.openai.api_key = "sk-custom-lua-key"');

      let capturedOptions = null;
      const originalChat = defaultRegistry.chat;
      defaultRegistry.chat = async function* (msgs, opts) {
        capturedOptions = opts;
        yield new StreamChunk("resp");
      };

      try {
        await bridge.ask("hello", { provider: "ollama" });
        assert.equal(capturedOptions.baseUrl, "http://custom-ollama:11434");

        await bridge.ask("hello", { provider: "openai" });
        assert.equal(capturedOptions.apiKey, "sk-custom-lua-key");
      } finally {
        defaultRegistry.chat = originalChat;
        defaultRegistry.setActive("ollama");
      }
    });

    it("AiSidebar.sendMessage does not pollute conversation history with error banners", async () => {
      const doc = new MockDOMDocument();
      const registry = new ProviderRegistry();
      class FailingProvider extends BaseProvider {
        constructor() { super({ id: "fail" }); }
        async *chat() {
          throw new ProviderError("Connection refused by server");
        }
      }
      registry.register(new FailingProvider());
      registry.setActive("fail");

      const sidebar = new AiSidebar({ registry });
      sidebar.mount(doc);

      await sidebar.sendMessage("Test failure");

      assert.equal(sidebar.isStreaming, false);
      assert.ok(sidebar.dom.statusMsg.textContent.includes("Error"));
      // The conversation messages array should not contain the error banner as assistant response
      const assistantMessages = sidebar.messages.filter(m => m.role === "assistant");
      assert.equal(assistantMessages.length, 0);
    });

    it("AiSidebar input ignores Enter during IME composition", () => {
      const doc = new MockDOMDocument();
      const sidebar = new AiSidebar();
      sidebar.mount(doc);

      let sent = false;
      sidebar.sendMessage = () => { sent = true; };

      sidebar.dom.input.value = "typing...";
      sidebar.dom.input.dispatchEvent({ key: "Enter", shiftKey: false, isComposing: true, preventDefault: () => {} });
      assert.equal(sent, false);

      sidebar.dom.input.dispatchEvent({ key: "Enter", shiftKey: false, keyCode: 229, preventDefault: () => {} });
      assert.equal(sent, false);
    });

    it("setupAiSidebar links target window to contextExtractor", () => {
      const doc = new MockDOMDocument();
      const mockWin = { document: doc, addEventListener: () => {} };
      const sidebar = setupAiSidebar(mockWin);

      assert.equal(sidebar.contextExtractor.targetWindow, mockWin);
    });
  });
});
