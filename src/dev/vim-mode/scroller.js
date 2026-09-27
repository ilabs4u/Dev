/**
 * Dev Browser - Smooth Page Scroller
 * Implements Vim scrolling actions: j, k, d, u, gg, G.
 */

class PageScroller {
  constructor(options = {}) {
    this.scrollStep = options.scrollStep || 80;
    this.smooth = options.smooth !== undefined ? options.smooth : true;
  }

  scrollDown(step = this.scrollStep) {
    if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
      window.scrollBy({ top: step, behavior: this.smooth ? "smooth" : "auto" });
      return true;
    }
    return false;
  }

  scrollUp(step = this.scrollStep) {
    if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
      window.scrollBy({ top: -step, behavior: this.smooth ? "smooth" : "auto" });
      return true;
    }
    return false;
  }

  scrollHalfDown() {
    const half = typeof window !== "undefined" && window.innerHeight ? window.innerHeight / 2 : 400;
    return this.scrollDown(half);
  }

  scrollHalfUp() {
    const half = typeof window !== "undefined" && window.innerHeight ? window.innerHeight / 2 : 400;
    return this.scrollUp(half);
  }

  scrollTop() {
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, left: 0, behavior: this.smooth ? "smooth" : "auto" });
      return true;
    }
    return false;
  }

  scrollBottom() {
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      const maxScroll = (typeof document !== "undefined" && document.body)
        ? Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
        : 100000;
      window.scrollTo({ top: maxScroll, left: 0, behavior: this.smooth ? "smooth" : "auto" });
      return true;
    }
    return false;
  }
}

module.exports = {
  PageScroller
};
