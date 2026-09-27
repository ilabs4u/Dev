/**
 * Dev Browser - AI Context Extractor
 * Gathers active tab text, selection, console errors, and Agent Tree elements.
 * Generates prompt templates for Summarize, Explain Error, and Analyze Page.
 */

class ContextExtractor {
  constructor(options = {}) {
    this.maxTextLength = options.maxTextLength || 8000;
    this.consoleErrorBuffer = [];
    this.maxErrorBuffer = options.maxErrorBuffer || 50;
    this.targetWindow = options.window || (typeof window !== "undefined" ? window : null);

    if (options.attachConsole !== false) {
      this.attachConsoleListener();
    }
  }

  setWindow(win) {
    this.targetWindow = win;
  }

  /**
   * Captures console errors and window unhandled exceptions.
   */
  attachConsoleListener() {
    const win = this.targetWindow || (typeof window !== "undefined" ? window : null);
    if (!win) return;

    if (typeof win.addEventListener === "function") {
      win.addEventListener("error", (event) => {
        this.addConsoleError({
          message: event.message || String(event),
          source: event.filename || "unknown",
          lineno: event.lineno,
          colno: event.colno,
          timestamp: Date.now()
        });
      });

      win.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        this.addConsoleError({
          message: reason?.message || String(reason || "Unhandled Promise Rejection"),
          source: reason?.stack?.split("\n")?.[1]?.trim() || "promise",
          timestamp: Date.now()
        });
      });
    }
  }

  /**
   * Appends an error to the buffer.
   * @param {Object|string} error
   */
  addConsoleError(error) {
    const entry = typeof error === "string"
      ? { message: error, timestamp: Date.now() }
      : { ...error, timestamp: error.timestamp || Date.now() };

    this.consoleErrorBuffer.push(entry);
    if (this.consoleErrorBuffer.length > this.maxErrorBuffer) {
      this.consoleErrorBuffer.shift();
    }
  }

  /**
   * Clears console error buffer.
   */
  clearErrors() {
    this.consoleErrorBuffer = [];
  }

  /**
   * Extracts text content from active tab / document.
   * @param {Object} [opts]
   * @returns {{ text: string, title: string, url: string, truncated: boolean }}
   */
  extractPageText(opts = {}) {
    if (typeof opts.text === "string") {
      const limit = opts.maxLength || this.maxTextLength;
      const isTruncated = opts.text.length > limit;
      return {
        text: isTruncated ? opts.text.slice(0, limit) + "\n...[truncated]" : opts.text,
        title: opts.title || "Page",
        url: opts.url || "about:blank",
        truncated: isTruncated
      };
    }

    const win = this.targetWindow || (typeof window !== "undefined" ? window : null);
    const doc = opts.document || (win && win.document ? win.document : (typeof document !== "undefined" ? document : null));

    if (!doc || !doc.body) {
      return {
        text: "",
        title: "",
        url: "",
        truncated: false
      };
    }

    const title = doc.title || (win && win.location ? win.location.href : "Page");
    const url = (win && win.location ? win.location.href : doc.URL) || "about:blank";

    let rawText = "";
    if (typeof doc.body.innerText === "string") {
      rawText = doc.body.innerText;
    } else if (typeof doc.body.textContent === "string") {
      rawText = doc.body.textContent;
    }

    // Clean up excessive whitespace
    const cleaned = rawText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .join("\n");

    const limit = opts.maxLength || this.maxTextLength;
    const truncated = cleaned.length > limit;
    const text = truncated ? cleaned.slice(0, limit) + "\n...[content truncated]" : cleaned;

    return {
      text,
      title,
      url,
      truncated
    };
  }

  /**
   * Extracts user's currently highlighted/selected text.
   * @param {Object} [opts]
   * @returns {string}
   */
  extractSelection(opts = {}) {
    if (opts.selection) return opts.selection;

    const win = this.targetWindow || (typeof window !== "undefined" ? window : null);
    if (!win) return "";

    try {
      if (typeof win.getSelection === "function") {
        const sel = win.getSelection();
        return sel ? sel.toString().trim() : "";
      }
    } catch {
      return "";
    }
    return "";
  }

  /**
   * Returns recent console errors.
   * @param {Object} [opts]
   * @returns {Array<Object>}
   */
  extractConsoleErrors(opts = {}) {
    if (opts.errors && Array.isArray(opts.errors)) {
      return opts.errors;
    }
    return [...this.consoleErrorBuffer];
  }

  /**
   * Extracts Agent Tree distilled elements from active document.
   * @param {Object} [opts]
   * @returns {Array<Object>}
   */
  extractAgentTree(opts = {}) {
    if (opts.elements && Array.isArray(opts.elements)) {
      return opts.elements;
    }

    const win = this.targetWindow || (typeof window !== "undefined" ? window : null);
    const doc = opts.document || (win && win.document ? win.document : (typeof document !== "undefined" ? document : null));

    if (!doc) return [];

    try {
      const { distill } = require("../agent-tree/distiller");
      return distill(doc, opts);
    } catch {
      return [];
    }
  }

  /**
   * Formats Agent Tree elements into concise readable text.
   * @param {Array<Object>} elements
   * @param {number} [maxCount=50]
   * @returns {string}
   */
  formatAgentTreeSummary(elements, maxCount = 50) {
    if (!elements || elements.length === 0) {
      return "No interactive elements detected.";
    }

    const slice = elements.slice(0, maxCount);
    const lines = slice.map(el => {
      const label = el.label || "?";
      const tag = el.tag || "elem";
      const role = el.role ? ` (${el.role})` : "";
      const text = el.text ? ` "${el.text.replace(/\s+/g, " ").slice(0, 40)}"` : "";
      const selector = el.selector ? ` [${el.selector}]` : "";
      return `[${label}] <${tag}>${text}${role}${selector}`;
    });

    if (elements.length > maxCount) {
      lines.push(`...and ${elements.length - maxCount} more elements.`);
    }

    return lines.join("\n");
  }

  /**
   * Builds prompt for "Summarize Page" context action.
   * @param {Object} [customContext]
   * @returns {{ system: string, prompt: string, messages: Array<{role: string, content: string}> }}
   */
  buildSummarizePrompt(customContext = {}) {
    const page = this.extractPageText(customContext);
    const system = "You are an expert AI browser assistant. Provide a structured, concise summary of the webpage. Highlight the main topic, key points, takeaways, and any notable links or calls to action.";

    let prompt = `Please summarize the following webpage:\n`;
    if (page.title) prompt += `Title: ${page.title}\n`;
    if (page.url) prompt += `URL: ${page.url}\n`;
    prompt += `\nContent:\n${page.text || "(No readable text found on page)"}`;

    return {
      system,
      prompt,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      context: page
    };
  }

  /**
   * Builds prompt for "Explain Error" context action.
   * @param {Object} [customContext]
   * @returns {{ system: string, prompt: string, messages: Array<{role: string, content: string}> }}
   */
  buildExplainErrorPrompt(customContext = {}) {
    const errors = this.extractConsoleErrors(customContext);
    const page = this.extractPageText(customContext);

    const system = "You are an expert web development debugging assistant. Analyze the given browser console errors, explain why they occurred, identify potential root causes in client or server code, and provide concrete solutions or debugging steps.";

    let errorText = "";
    if (errors.length === 0) {
      errorText = "No recent console errors recorded. Check network or application logs.";
    } else {
      errorText = errors.map((e, idx) => {
        const time = e.timestamp ? new Date(e.timestamp).toISOString() : "";
        const loc = e.source ? ` at ${e.source}:${e.lineno || 0}:${e.colno || 0}` : "";
        return `[Error ${idx + 1}] ${time}\nMessage: ${e.message}${loc}`;
      }).join("\n\n");
    }

    let prompt = `Explain the following browser console error(s) and suggest fixes:\n\n${errorText}\n`;
    if (page.url) prompt += `\nPage URL: ${page.url}`;
    if (page.title) prompt += `\nPage Title: ${page.title}`;

    return {
      system,
      prompt,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      context: { errors, page }
    };
  }

  /**
   * Builds prompt for "Analyze Page" context action.
   * @param {Object} [customContext]
   * @returns {{ system: string, prompt: string, messages: Array<{role: string, content: string}> }}
   */
  buildAnalyzePagePrompt(customContext = {}) {
    const page = this.extractPageText(customContext);
    const elements = this.extractAgentTree(customContext);
    const agentTreeSummary = this.formatAgentTreeSummary(elements);

    const system = "You are an expert AI web accessibility, UX, and browser automation assistant. Analyze the interactive structure and semantic elements of the webpage. Provide insights on navigation flow, form controls, accessibility, and automation readiness.";

    let prompt = `Analyze this webpage structure and interactive elements:\n`;
    if (page.title) prompt += `Title: ${page.title}\n`;
    if (page.url) prompt += `URL: ${page.url}\n`;
    prompt += `\nInteractive Elements (Agent Tree):\n${agentTreeSummary}\n`;
    if (page.text) {
      prompt += `\nPage Text Overview:\n${page.text.slice(0, 1500)}\n`;
    }

    return {
      system,
      prompt,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      context: { page, elements }
    };
  }

  /**
   * Builds prompt for selected text.
   * @param {string} [selection]
   * @param {string} [customInstruction]
   * @returns {{ system: string, prompt: string, messages: Array<{role: string, content: string}> }}
   */
  buildSelectionPrompt(selection = null, customInstruction = "") {
    const sel = selection !== null ? selection : this.extractSelection();
    const system = "You are an expert AI browser assistant helping the user understand and analyze selected text.";

    const instruction = customInstruction || "Explain and analyze the following selected text:";
    const prompt = `${instruction}\n\n"""\n${sel || "(No text currently selected)"}\n"""`;

    return {
      system,
      prompt,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      context: { selection: sel }
    };
  }
}

const defaultContextExtractor = new ContextExtractor({ attachConsole: false });

module.exports = {
  ContextExtractor,
  defaultContextExtractor
};
