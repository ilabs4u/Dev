/**
 * Dev Browser - AI Sidebar Controller
 * Responsive dark-themed collapsible chat sidebar with streaming,
 * markdown parsing, code copy, and page context injection.
 */

const { defaultRegistry } = require("./providers");
const { defaultContextExtractor } = require("./context");

/**
 * Escapes raw HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Lightweight, robust Markdown to HTML renderer.
 * Handles headers, bold, italics, lists, inline code, and code blocks with copy buttons.
 * Supports incomplete streaming code blocks.
 * @param {string} markdown
 * @returns {string}
 */
function renderMarkdown(markdown) {
  if (!markdown) return "";

  // 1. Extract and replace code blocks (including unclosed streaming blocks and CRLF)
  const codeBlocks = [];
  let processed = markdown.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang || "text", code });
    return placeholder;
  });

  // 2. Escape HTML on text outside code blocks
  processed = escapeHtml(processed);

  // 3. Headers (# H1 .. ###### H6)
  processed = processed.replace(/^###### (.*$)/gim, "<h6>$1</h6>");
  processed = processed.replace(/^##### (.*$)/gim, "<h5>$1</h5>");
  processed = processed.replace(/^#### (.*$)/gim, "<h4>$1</h4>");
  processed = processed.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  processed = processed.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  processed = processed.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // 4. Bold & Italic
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 5. Inline Code (`code`)
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 6. Safe links [title](https://...)
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s<)"]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 7. Blockquotes
  processed = processed.replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>");

  // 8. Unordered and ordered lists
  processed = processed.replace(/^\s*[-*]\s+(.*)$/gim, "<li>$1</li>");
  processed = processed.replace(/^\s*\d+\.\s+(.*)$/gim, "<li>$1</li>");
  processed = processed.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  // Clean up duplicated adjacent <ul> wrappers
  processed = processed.replace(/<\/ul>\s*<ul>/g, "");

  // 9. Paragraphs / Linebreaks
  processed = processed.replace(/\n\n+/g, "</p><p>");
  processed = processed.replace(/\n/g, "<br>");
  processed = `<p>${processed}</p>`;
  processed = processed.replace(/<p>\s*<\/p>/g, "");

  // 10. Reinsert sanitized code blocks safely using function replacer to prevent $ corruption
  for (let i = 0; i < codeBlocks.length; i++) {
    const { lang, code } = codeBlocks[i];
    const escapedCode = escapeHtml(code);
    const attrCode = escapeHtml(code);
    const blockHtml = `
      <div class="ai-code-block">
        <div class="ai-code-header">
          <span class="ai-code-lang">${escapeHtml(lang)}</span>
          <button class="ai-code-copy" data-raw-code="${attrCode}">Copy</button>
        </div>
        <pre><code class="language-${escapeHtml(lang)}">${escapedCode}</code></pre>
      </div>
    `.trim();
    processed = processed.replace(`__CODE_BLOCK_${i}__`, () => blockHtml);
  }

  return processed;
}

class AiSidebar {
  constructor(options = {}) {
    this.registry = options.registry || defaultRegistry;
    this.contextExtractor = options.contextExtractor || defaultContextExtractor;

    this.isOpen = false;
    this.isStreaming = false;
    this.currentAbortController = null;
    this.messages = []; // [{ role: 'user'|'assistant'|'system', content: string }]
    this.activeAssistantMessage = null;
    this.activeAssistantContent = "";

    this.dom = {
      sidebar: null,
      messages: null,
      input: null,
      btnSend: null,
      btnStop: null,
      btnClear: null,
      btnClose: null,
      selectProvider: null,
      inputModel: null,
      statusIndicator: null,
      statusMsg: null,
      chips: []
    };

    this.onStateChangeCallbacks = [];
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  notifyStateChange() {
    for (const cb of this.onStateChangeCallbacks) {
      try {
        cb({
          isOpen: this.isOpen,
          isStreaming: this.isStreaming,
          provider: this.registry.getActiveId(),
          messagesCount: this.messages.length
        });
      } catch (err) {
        console.error("Error in onStateChange callback:", err);
      }
    }
  }

  /**
   * Mounts the sidebar panel into the target document or container.
   * @param {Document|HTMLElement} [target]
   */
  mount(target = null) {
    const doc = (target && target.ownerDocument) ? target.ownerDocument : (target && target.getElementById ? target : (typeof document !== "undefined" ? document : null));
    if (!doc) return false;

    let el = doc.getElementById("dev-ai-sidebar");
    if (!el) {
      const container = doc.createElement("div");
      container.id = "dev-ai-sidebar-host";
      const fs = require("fs");
      const path = require("path");
      try {
        const htmlPath = path.resolve(__dirname, "sidebar.html");
        container.innerHTML = fs.readFileSync(htmlPath, "utf-8");
      } catch {
        container.innerHTML = `
          <aside id="dev-ai-sidebar" class="dev-ai-sidebar collapsed" aria-label="Dev Browser AI Sidebar">
            <div class="ai-header">
              <div class="ai-header-title-row">
                <div class="ai-title-wrap">
                  <span class="ai-logo-icon">⚡</span>
                  <span class="ai-title">Dev AI</span>
                  <span id="ai-status-indicator" class="ai-status-indicator ready" title="Ready"></span>
                </div>
                <div class="ai-header-actions">
                  <button id="ai-btn-clear" class="ai-icon-btn" title="Clear Conversation" aria-label="Clear Conversation">Clear</button>
                  <button id="ai-btn-close" class="ai-icon-btn" title="Close AI Sidebar" aria-label="Close AI Sidebar">×</button>
                </div>
              </div>
              <div class="ai-config-row">
                <div class="ai-control-group">
                  <label for="ai-select-provider">Backend</label>
                  <select id="ai-select-provider" class="ai-select">
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="lmstudio">LM Studio (Local)</option>
                  </select>
                </div>
                <div class="ai-control-group model-group">
                  <label for="ai-input-model">Model</label>
                  <input type="text" id="ai-input-model" class="ai-input-sm" value="llama3.2" placeholder="e.g. llama3.2">
                </div>
              </div>
            </div>
            <div class="ai-chips-bar" role="toolbar" aria-label="Page Context Quick Actions">
              <button class="ai-chip" data-action="summarize-page" title="Summarize current page text"><span>📄</span> Summarize</button>
              <button class="ai-chip" data-action="explain-error" title="Explain recent console errors"><span>⚠️</span> Errors</button>
              <button class="ai-chip" data-action="analyze-page" title="Analyze page elements with Agent Tree"><span>🌳</span> Elements</button>
              <button class="ai-chip" data-action="ask-selection" title="Ask about selected text"><span>✂️</span> Selection</button>
            </div>
            <div id="ai-messages" class="ai-messages" role="log" aria-live="polite">
              <div class="ai-message ai-message-assistant system-intro">
                <div class="ai-msg-avatar">⚡</div>
                <div class="ai-msg-body">
                  <div class="ai-msg-text">
                    <p><strong>Dev AI</strong> ready.</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="ai-input-container">
              <div id="ai-status-bar" class="ai-status-bar">
                <span id="ai-status-msg" class="ai-status-msg">Ready</span>
              </div>
              <div class="ai-textarea-wrapper">
                <textarea id="ai-input" class="ai-textarea" rows="2" placeholder="Ask AI..."></textarea>
                <div class="ai-btn-group">
                  <button id="ai-btn-stop" class="ai-btn ai-btn-stop" style="display: none;">Stop</button>
                  <button id="ai-btn-send" class="ai-btn ai-btn-send">Send</button>
                </div>
              </div>
            </div>
          </aside>
        `;
      }
      (doc.body || doc).appendChild(container);
      el = doc.getElementById("dev-ai-sidebar");

      // Programmatic fallback if innerHTML is not parsed (e.g. lightweight mock DOM)
      if (!el) {
        el = doc.createElement("aside");
        el.id = "dev-ai-sidebar";
        el.className = "dev-ai-sidebar collapsed";

        const header = doc.createElement("div");
        header.className = "ai-header";
        const titleSpan = doc.createElement("span");
        titleSpan.className = "ai-title";
        titleSpan.textContent = "Dev AI";
        const btnClose = doc.createElement("button");
        btnClose.id = "ai-btn-close";
        const btnClear = doc.createElement("button");
        btnClear.id = "ai-btn-clear";
        const selProvider = doc.createElement("select");
        selProvider.id = "ai-select-provider";
        const inputModel = doc.createElement("input");
        inputModel.id = "ai-input-model";
        inputModel.value = "llama3.2";
        header.appendChild(titleSpan);
        header.appendChild(btnClear);
        header.appendChild(btnClose);
        header.appendChild(selProvider);
        header.appendChild(inputModel);

        const chipsBar = doc.createElement("div");
        chipsBar.className = "ai-chips-bar";
        for (const action of ["summarize-page", "explain-error", "analyze-page", "ask-selection"]) {
          const chip = doc.createElement("button");
          chip.className = "ai-chip";
          chip.setAttribute("data-action", action);
          chip.textContent = action;
          chipsBar.appendChild(chip);
        }

        const messages = doc.createElement("div");
        messages.id = "ai-messages";
        messages.className = "ai-messages";

        const inputContainer = doc.createElement("div");
        inputContainer.className = "ai-input-container";
        const statusMsg = doc.createElement("span");
        statusMsg.id = "ai-status-msg";
        const statusIndicator = doc.createElement("span");
        statusIndicator.id = "ai-status-indicator";
        statusIndicator.className = "ai-status-indicator ready";
        const input = doc.createElement("textarea");
        input.id = "ai-input";
        const btnSend = doc.createElement("button");
        btnSend.id = "ai-btn-send";
        const btnStop = doc.createElement("button");
        btnStop.id = "ai-btn-stop";
        btnStop.style = { display: "none" };

        inputContainer.appendChild(statusMsg);
        inputContainer.appendChild(statusIndicator);
        inputContainer.appendChild(input);
        inputContainer.appendChild(btnStop);
        inputContainer.appendChild(btnSend);

        el.appendChild(header);
        el.appendChild(chipsBar);
        el.appendChild(messages);
        el.appendChild(inputContainer);

        (doc.body || doc).appendChild(el);
      }
    }

    this.doc = doc;
    this.dom.sidebar = el;
    this.dom.messages = doc.getElementById("ai-messages");
    this.dom.input = doc.getElementById("ai-input");
    this.dom.btnSend = doc.getElementById("ai-btn-send");
    this.dom.btnStop = doc.getElementById("ai-btn-stop");
    this.dom.btnClear = doc.getElementById("ai-btn-clear");
    this.dom.btnClose = doc.getElementById("ai-btn-close");
    this.dom.selectProvider = doc.getElementById("ai-select-provider");
    this.dom.inputModel = doc.getElementById("ai-input-model");
    this.dom.statusIndicator = doc.getElementById("ai-status-indicator");
    this.dom.statusMsg = doc.getElementById("ai-status-msg");
    this.dom.chips = Array.from(doc.querySelectorAll(".ai-chip"));

    this.bindEvents(doc);
    return true;
  }

  bindEvents(doc) {
    if (this.dom.btnClose) {
      this.dom.btnClose.addEventListener("click", () => this.close());
    }

    if (this.dom.btnClear) {
      this.dom.btnClear.addEventListener("click", () => this.clearHistory());
    }

    if (this.dom.btnSend) {
      this.dom.btnSend.addEventListener("click", () => this.submitInput());
    }

    if (this.dom.btnStop) {
      this.dom.btnStop.addEventListener("click", () => this.stopGeneration());
    }

    if (this.dom.input) {
      this.dom.input.addEventListener("keydown", (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.submitInput();
        }
      });
    }

    if (this.dom.selectProvider) {
      this.dom.selectProvider.value = this.registry.getActiveId();
      this.dom.selectProvider.addEventListener("change", (e) => {
        const id = e.target.value;
        if (this.registry.has(id)) {
          this.registry.setActive(id);
          const active = this.registry.getActive();
          if (this.dom.inputModel && active.defaultModel) {
            this.dom.inputModel.value = active.defaultModel;
          }
          this.setStatus(`Provider: ${active.name}`);
        }
      });
    }

    if (this.dom.chips) {
      this.dom.chips.forEach(chip => {
        chip.addEventListener("click", () => {
          const action = chip.getAttribute("data-action");
          this.handleChipAction(action);
        });
      });
    }

    // Code copy delegate
    if (this.dom.messages) {
      this.dom.messages.addEventListener("click", (e) => {
        const copyBtn = e.target.closest(".ai-code-copy");
        if (copyBtn) {
          const codeEl = copyBtn.closest(".ai-code-block")?.querySelector("code");
          const rawCode = (codeEl ? (codeEl.innerText ?? codeEl.textContent) : null) || copyBtn.getAttribute("data-raw-code") || "";
          this.copyToClipboard(rawCode, copyBtn);
        }
      });
    }
  }

  open() {
    this.isOpen = true;
    if (this.dom.sidebar) {
      this.dom.sidebar.classList.remove("collapsed");
    }
    if (this.dom.input && typeof this.dom.input.focus === "function") {
      setTimeout(() => this.dom.input.focus(), 50);
    }
    this.notifyStateChange();
    return true;
  }

  close() {
    this.isOpen = false;
    if (this.dom.sidebar) {
      this.dom.sidebar.classList.add("collapsed");
    }
    this.notifyStateChange();
    return false;
  }

  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  setStatus(msg, state = "ready") {
    if (this.dom.statusMsg) {
      this.dom.statusMsg.textContent = msg;
    }
    if (this.dom.statusIndicator) {
      this.dom.statusIndicator.className = `ai-status-indicator ${state}`;
    }
  }

  submitInput() {
    if (this.isStreaming) return;
    if (!this.dom.input) return;

    const text = this.dom.input.value.trim();
    if (!text) return;

    this.dom.input.value = "";
    this.sendMessage(text);
  }

  /**
   * Sends user message and streams assistant response.
   * @param {string} prompt
   * @param {Object} [options]
   */
  async sendMessage(prompt, options = {}) {
    if (!prompt || !String(prompt).trim() || this.isStreaming) return;

    // Append user message
    this.messages.push({ role: "user", content: prompt });
    this.renderMessageElement("user", prompt);

    // Setup streaming UI
    this.isStreaming = true;
    this.currentAbortController = new AbortController();
    if (this.dom.btnSend) this.dom.btnSend.style.display = "none";
    if (this.dom.btnStop) this.dom.btnStop.style.display = "inline-block";
    this.setStatus("Thinking...", "streaming");
    this.notifyStateChange();

    // Create assistant message placeholder
    const assistantEl = this.renderMessageElement("assistant", "");
    this.activeAssistantMessage = assistantEl;
    this.activeAssistantContent = "";

    const providerId = options.provider || (this.dom.selectProvider ? this.dom.selectProvider.value : this.registry.getActiveId());
    const model = options.model || (this.dom.inputModel ? this.dom.inputModel.value.trim() : null);

    try {
      const stream = this.registry.chat(this.messages, {
        provider: providerId,
        model: model || undefined,
        signal: this.currentAbortController.signal,
        ...options
      });

      this.setStatus("Streaming...", "streaming");

      for await (const chunk of stream) {
        const delta = chunk.text ?? chunk.delta ?? String(chunk);
        if (delta) {
          this.appendAssistantToken(delta);
        }
      }

      this.messages.push({ role: "assistant", content: this.activeAssistantContent });
      this.setStatus("Ready", "ready");
    } catch (err) {
      if (err.name === "AbortError" || this.currentAbortController?.signal.aborted) {
        this.setStatus("Stopped", "ready");
        if (this.activeAssistantContent) {
          this.messages.push({ role: "assistant", content: this.activeAssistantContent + " [Stopped]" });
        }
      } else {
        this.setStatus(`Error: ${err.message}`, "error");
        this.appendAssistantToken(`\n\n> ⚠️ **Error:** ${err.message}`);
        if (this.activeAssistantContent) {
          const cleanContent = this.activeAssistantContent.replace(/\n\n> ⚠️ \*\*Error:\*\*.*$/, "").trim();
          if (cleanContent) {
            this.messages.push({ role: "assistant", content: cleanContent });
          }
        }
      }
    } finally {
      this.isStreaming = false;
      this.currentAbortController = null;
      this.activeAssistantMessage = null;
      if (this.dom.btnSend) this.dom.btnSend.style.display = "inline-block";
      if (this.dom.btnStop) this.dom.btnStop.style.display = "none";
      this.notifyStateChange();
    }
  }

  appendAssistantToken(token) {
    this.activeAssistantContent += token;
    if (this.activeAssistantMessage) {
      const textWrap = this.activeAssistantMessage.querySelector(".ai-msg-text");
      if (textWrap) {
        textWrap.innerHTML = renderMarkdown(this.activeAssistantContent);
      }
      this.scrollToBottom();
    }
  }

  stopGeneration() {
    if (this.isStreaming && this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  clearHistory() {
    this.messages = [];
    if (this.dom.messages) {
      this.dom.messages.innerHTML = `
        <div class="ai-message ai-message-assistant system-intro">
          <div class="ai-msg-avatar">⚡</div>
          <div class="ai-msg-body">
            <div class="ai-msg-text">
              <p>Conversation cleared. Ready for your questions.</p>
            </div>
          </div>
        </div>
      `;
    }
    this.setStatus("Ready", "ready");
    this.notifyStateChange();
  }

  renderMessageElement(role, content) {
    if (!this.dom.messages) return null;

    const doc = this.doc || (this.dom.messages && this.dom.messages.ownerDocument) || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;

    const msgEl = doc.createElement("div");
    msgEl.className = `ai-message ai-message-${role}`;

    const avatar = role === "user" ? "👤" : "⚡";
    const headerTitle = role === "user" ? "You" : "Dev AI";

    const avatarEl = doc.createElement("div");
    avatarEl.className = "ai-msg-avatar";
    avatarEl.textContent = avatar;

    const bodyEl = doc.createElement("div");
    bodyEl.className = "ai-msg-body";

    const headerEl = doc.createElement("div");
    headerEl.className = "ai-msg-header";
    const headerSpan = doc.createElement("span");
    headerSpan.textContent = headerTitle;
    headerEl.appendChild(headerSpan);

    const textEl = doc.createElement("div");
    textEl.className = "ai-msg-text";
    textEl.innerHTML = renderMarkdown(content);

    bodyEl.appendChild(headerEl);
    bodyEl.appendChild(textEl);

    msgEl.appendChild(avatarEl);
    msgEl.appendChild(bodyEl);

    this.dom.messages.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
  }

  scrollToBottom() {
    if (this.dom.messages) {
      this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }
  }

  handleChipAction(action) {
    if (this.isStreaming) return;

    switch (action) {
      case "summarize-page": {
        const item = this.contextExtractor.buildSummarizePrompt();
        this.sendMessage(item.prompt);
        break;
      }
      case "explain-error": {
        const item = this.contextExtractor.buildExplainErrorPrompt();
        this.sendMessage(item.prompt);
        break;
      }
      case "analyze-page": {
        const item = this.contextExtractor.buildAnalyzePagePrompt();
        this.sendMessage(item.prompt);
        break;
      }
      case "ask-selection": {
        const item = this.contextExtractor.buildSelectionPrompt();
        this.sendMessage(item.prompt);
        break;
      }
      default:
        console.warn(`Unknown AI chip action: ${action}`);
    }
  }

  copyToClipboard(text, btnElement) {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(() => {
        this.showCopiedFeedback(btnElement);
      }).catch(() => {
        this.fallbackCopy(text, btnElement);
      });
    } else {
      this.fallbackCopy(text, btnElement);
    }
  }

  fallbackCopy(text, btnElement) {
    const doc = this.doc || (typeof document !== "undefined" ? document : null);
    if (doc && doc.body) {
      const textarea = doc.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      doc.body.appendChild(textarea);
      if (typeof textarea.select === "function") textarea.select();
      try {
        if (typeof doc.execCommand === "function") {
          doc.execCommand("copy");
        }
        this.showCopiedFeedback(btnElement);
      } catch {
        // Ignore fallback copy error
      }
      doc.body.removeChild(textarea);
    }
  }

  showCopiedFeedback(btnElement) {
    if (!btnElement) return;
    const originalText = btnElement.textContent;
    btnElement.textContent = "Copied!";
    btnElement.style.color = "#4ade80";
    setTimeout(() => {
      btnElement.textContent = originalText;
      btnElement.style.color = "";
    }, 1500);
  }
}

const defaultSidebar = new AiSidebar();

module.exports = {
  AiSidebar,
  defaultSidebar,
  renderMarkdown,
  escapeHtml
};
