/**
 * Dev Browser - Per-Domain Boost Engine
 * Arc-style Boosts: Inject custom CSS and JavaScript into specific web domains.
 */

class BoostManager {
  constructor() {
    this.boosts = new Map();
  }

  /**
   * Creates or updates a boost for a domain pattern.
   * @param {string} domainPattern - e.g. "github.com", "*.local", "*"
   * @param {Object} options
   * @param {string} [options.css] - Custom CSS rules
   * @param {string} [options.js] - Custom JavaScript code
   * @param {string} [options.name] - Friendly name
   * @param {boolean} [options.enabled] - Whether boost is active
   */
  create(domainPattern, options = {}) {
    if (!domainPattern || typeof domainPattern !== "string") {
      throw new Error("Domain pattern must be a non-empty string");
    }

    const pattern = domainPattern.toLowerCase().trim();
    const boost = {
      domain: pattern,
      name: options.name || pattern,
      css: options.css || "",
      js: options.js || "",
      enabled: options.enabled !== false,
      updatedAt: Date.now()
    };

    this.boosts.set(pattern, boost);
    return boost;
  }

  get(domainPattern) {
    if (!domainPattern) return null;
    return this.boosts.get(domainPattern.toLowerCase().trim()) || null;
  }

  list() {
    return Array.from(this.boosts.values());
  }

  remove(domainPattern) {
    if (!domainPattern) return false;
    return this.boosts.delete(domainPattern.toLowerCase().trim());
  }

  toggle(domainPattern, enabled = null) {
    const boost = this.get(domainPattern);
    if (!boost) {
      throw new Error(`Boost for pattern "${domainPattern}" does not exist`);
    }
    boost.enabled = enabled !== null ? Boolean(enabled) : !boost.enabled;
    boost.updatedAt = Date.now();
    return boost;
  }

  clear() {
    this.boosts.clear();
  }

  /**
   * Matches a target hostname against a registered domain pattern.
   */
  matches(pattern, hostname) {
    if (!pattern || !hostname) return false;
    const p = pattern.toLowerCase();
    const h = hostname.toLowerCase();

    if (p === "*" || p === h) {
      return true;
    }

    if (p.startsWith("*.")) {
      const root = p.slice(2);
      return h === root || h.endsWith("." + root);
    }

    return false;
  }

  /**
   * Retrieves all enabled boosts that match the given hostname or URL.
   */
  getMatchingBoosts(urlOrHostname) {
    let hostname = urlOrHostname;
    try {
      if (urlOrHostname.includes("://")) {
        const u = new URL(urlOrHostname);
        hostname = u.hostname;
      }
    } catch {
      // Treat as raw hostname
    }

    const matched = [];
    for (const boost of this.boosts.values()) {
      if (boost.enabled && this.matches(boost.domain, hostname)) {
        matched.push(boost);
      }
    }
    return matched;
  }

  /**
   * Injects matching CSS and JS into a target DOM document.
   */
  inject(targetDoc, urlOrHostname) {
    if (!targetDoc || !targetDoc.head) {
      return { injected: false, error: "Target document head not available" };
    }

    const matching = this.getMatchingBoosts(urlOrHostname);
    let cssCount = 0;
    let jsCount = 0;

    for (const boost of matching) {
      // Inject CSS
      if (boost.css && boost.css.trim()) {
        let styleEl = targetDoc.querySelector(`style[data-boost="${boost.domain}"]`);
        if (!styleEl) {
          styleEl = targetDoc.createElement("style");
          styleEl.className = "dev-boost-style";
          styleEl.setAttribute("data-boost", boost.domain);
          targetDoc.head.appendChild(styleEl);
        }
        styleEl.textContent = boost.css;
        cssCount++;
      }

      // Inject JS
      if (boost.js && boost.js.trim()) {
        try {
          if (typeof targetDoc.defaultView !== "undefined" && typeof targetDoc.defaultView.eval === "function") {
            targetDoc.defaultView.eval(boost.js);
          } else {
            const scriptEl = targetDoc.createElement("script");
            scriptEl.className = "dev-boost-script";
            scriptEl.setAttribute("data-boost", boost.domain);
            scriptEl.textContent = boost.js;
            (targetDoc.body || targetDoc.head).appendChild(scriptEl);
          }
          jsCount++;
        } catch {
          // Script execution error isolated to page
        }
      }
    }

    return {
      injected: true,
      matchedBoosts: matching.length,
      cssCount,
      jsCount
    };
  }
}

module.exports = {
  BoostManager
};
