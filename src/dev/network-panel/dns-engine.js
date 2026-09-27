/**
 * Dev Browser - DNS-over-HTTPS (DoH) Engine & Override Manager
 * Supports Cloudflare, Quad9, Google, NextDNS, custom resolvers,
 * per-domain DNS override table, and query logging.
 */

const dns = require("dns");

const DOH_RESOLVERS = {
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare (1.1.1.1)",
    url: "https://cloudflare-dns.com/dns-query",
    description: "Fastest privacy-first DNS resolution"
  },
  quad9: {
    id: "quad9",
    name: "Quad9 (9.9.9.9)",
    url: "https://dns.quad9.net/dns-query",
    description: "Malware & phishing blocking built-in"
  },
  google: {
    id: "google",
    name: "Google Public DNS (8.8.8.8)",
    url: "https://dns.google/dns-query",
    description: "Global high-reliability DNS"
  },
  nextdns: {
    id: "nextdns",
    name: "NextDNS",
    url: "https://dns.nextdns.io/dns-query",
    description: "Customizable privacy & ad-blocking DNS"
  },
  system: {
    id: "system",
    name: "System Default DNS",
    url: null,
    description: "Standard OS network resolver"
  }
};

class DnsEngine {
  constructor(options = {}) {
    this.activeResolverKey = options.initialResolver || "cloudflare";
    this.customResolvers = new Map();
    this.overrides = new Map();
    this.queryLogs = [];
    this.maxLogs = 100;

    if (options.overrides) {
      for (const [d, ip] of Object.entries(options.overrides)) {
        this.setOverride(d, ip);
      }
    }
  }

  setResolver(keyOrUrl) {
    if (!keyOrUrl || typeof keyOrUrl !== "string") {
      throw new Error("Resolver must be a non-empty string or URL");
    }

    const key = keyOrUrl.toLowerCase().trim();
    // Check aliases
    if (key === "cloudflare-doh" || key === "cloudflare") {
      this.activeResolverKey = "cloudflare";
      return DOH_RESOLVERS.cloudflare;
    }
    if (key === "quad9-doh" || key === "quad9") {
      this.activeResolverKey = "quad9";
      return DOH_RESOLVERS.quad9;
    }
    if (key === "google-doh" || key === "google") {
      this.activeResolverKey = "google";
      return DOH_RESOLVERS.google;
    }
    if (key === "nextdns") {
      this.activeResolverKey = "nextdns";
      return DOH_RESOLVERS.nextdns;
    }
    if (key === "system") {
      this.activeResolverKey = "system";
      return DOH_RESOLVERS.system;
    }

    // Check if valid custom URL
    if (keyOrUrl.startsWith("https://")) {
      const customKey = `custom-${this.customResolvers.size + 1}`;
      const entry = {
        id: customKey,
        name: `Custom DoH (${keyOrUrl})`,
        url: keyOrUrl,
        description: "Custom user-defined DoH endpoint"
      };
      this.customResolvers.set(customKey, entry);
      this.activeResolverKey = customKey;
      return entry;
    }

    throw new Error(`Unknown resolver: "${keyOrUrl}". Supported: cloudflare, quad9, google, nextdns, system, or https://...`);
  }

  getResolver() {
    if (DOH_RESOLVERS[this.activeResolverKey]) {
      return DOH_RESOLVERS[this.activeResolverKey];
    }
    if (this.customResolvers.has(this.activeResolverKey)) {
      return this.customResolvers.get(this.activeResolverKey);
    }
    return DOH_RESOLVERS.cloudflare;
  }

  listResolvers() {
    const list = Object.values(DOH_RESOLVERS);
    for (const custom of this.customResolvers.values()) {
      list.push(custom);
    }
    return list;
  }

  setOverride(domain, ip) {
    if (!domain || typeof domain !== "string") {
      throw new Error("Domain must be a non-empty string");
    }
    if (!ip || typeof ip !== "string") {
      throw new Error("IP must be a non-empty string");
    }

    const cleanDomain = domain.toLowerCase().trim();
    const cleanIp = ip.trim();
    this.overrides.set(cleanDomain, cleanIp);
    return { domain: cleanDomain, ip: cleanIp };
  }

  getOverride(domain) {
    if (!domain) return null;
    return this.overrides.get(domain.toLowerCase().trim()) || null;
  }

  removeOverride(domain) {
    if (!domain) return false;
    return this.overrides.delete(domain.toLowerCase().trim());
  }

  listOverrides() {
    const results = [];
    for (const [domain, ip] of this.overrides.entries()) {
      results.push({ domain, ip });
    }
    return results;
  }

  clearOverrides() {
    this.overrides.clear();
  }

  logQuery(entry) {
    this.queryLogs.unshift({
      id: Math.random().toString(36).slice(2, 9),
      timestamp: Date.now(),
      ...entry
    });
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs.pop();
    }
  }

  getQueryLogs() {
    return [...this.queryLogs];
  }

  clearQueryLogs() {
    this.queryLogs = [];
  }

  async resolve(domain, type = "A", { fetchFn = globalThis.fetch } = {}) {
    if (!domain || typeof domain !== "string") {
      throw new Error("Domain to resolve must be a string");
    }

    const cleanDomain = domain.toLowerCase().trim();
    const startTime = Date.now();

    // 1. Check Per-Domain Override Table
    const overrideIp = this.getOverride(cleanDomain);
    if (overrideIp) {
      const result = {
        domain: cleanDomain,
        type,
        ip: overrideIp,
        answers: [{ name: cleanDomain, type: 1, data: overrideIp, TTL: 300 }],
        fromOverride: true,
        resolver: "override",
        latencyMs: 0,
        status: "success"
      };
      this.logQuery({
        domain: cleanDomain,
        type,
        resolver: "override",
        ip: overrideIp,
        latencyMs: 0,
        status: "success"
      });
      return result;
    }

    const resolver = this.getResolver();

    // 2. System Resolver Fallback
    if (resolver.id === "system" || !resolver.url) {
      try {
        const lookupRes = await dns.promises.lookup(cleanDomain, { all: true });
        const latencyMs = Date.now() - startTime;
        const ips = lookupRes.map(r => r.address);
        const primaryIp = ips[0] || null;

        const result = {
          domain: cleanDomain,
          type,
          ip: primaryIp,
          answers: ips.map(addr => ({ name: cleanDomain, data: addr })),
          fromOverride: false,
          resolver: "system",
          latencyMs,
          status: "success"
        };
        this.logQuery({
          domain: cleanDomain,
          type,
          resolver: "system",
          ip: primaryIp,
          latencyMs,
          status: "success"
        });
        return result;
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        this.logQuery({
          domain: cleanDomain,
          type,
          resolver: "system",
          ip: null,
          error: err.message,
          latencyMs,
          status: "error"
        });
        return {
          domain: cleanDomain,
          type,
          error: err.message,
          fromOverride: false,
          resolver: "system",
          latencyMs,
          status: "error"
        };
      }
    }

    // 3. DNS-over-HTTPS (DoH) Query
    try {
      const dohUrl = new URL(resolver.url);
      dohUrl.searchParams.set("name", cleanDomain);
      dohUrl.searchParams.set("type", type);

      const resp = await fetchFn(dohUrl.toString(), {
        headers: {
          Accept: "application/dns-json"
        }
      });

      const latencyMs = Date.now() - startTime;

      if (!resp.ok) {
        throw new Error(`DoH server returned HTTP status ${resp.status}`);
      }

      const json = await resp.json();
      const answers = json.Answer || [];
      // Type 1 is A record, Type 28 is AAAA record
      const matchedRecord = answers.find(a => a.type === 1 || a.type === 28 || a.data);
      const resolvedIp = matchedRecord ? matchedRecord.data : null;

      const result = {
        domain: cleanDomain,
        type,
        ip: resolvedIp,
        answers,
        fromOverride: false,
        resolver: resolver.id,
        latencyMs,
        status: "success"
      };

      this.logQuery({
        domain: cleanDomain,
        type,
        resolver: resolver.id,
        ip: resolvedIp,
        latencyMs,
        status: "success"
      });

      return result;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      this.logQuery({
        domain: cleanDomain,
        type,
        resolver: resolver.id,
        ip: null,
        error: err.message,
        latencyMs,
        status: "error"
      });
      return {
        domain: cleanDomain,
        type,
        error: err.message,
        fromOverride: false,
        resolver: resolver.id,
        latencyMs,
        status: "error"
      };
    }
  }
}

module.exports = {
  DnsEngine,
  DOH_RESOLVERS
};
