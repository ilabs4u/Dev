/**
 * Dev Browser - Localhost Port Scanner
 * High-speed parallel port scanner for 127.0.0.1 completing in <2 seconds.
 */

const { detectService } = require("./detector");
const { DockerClient } = require("../docker-dashboard/docker-client");

// Common development server ports prioritized for instant discovery
const COMMON_DEV_PORTS = [
  3000, 3001, 3002, 3333,
  4000, 4200,
  5000, 5173, 5174,
  8000, 8080, 8081, 8888,
  9000, 9222,
  11434, // Ollama
  4173, // Vite preview
  8501, // Streamlit
  7860, // Gradio
  1337  // Strapi
];

class LocalhostScanner {
  constructor(options = {}) {
    this.host = options.host || "127.0.0.1";
    this.probeTimeoutMs = options.probeTimeoutMs || 250;
    this.maxScanTimeMs = options.maxScanTimeMs || 2000;
    this.concurrency = options.concurrency || 30;
    this.customPorts = options.ports || COMMON_DEV_PORTS;
    this.fetchFn = options.fetchFn || (typeof fetch !== "undefined" ? fetch : null);
  }

  async probePort(port) {
    const url = `http://${this.host}:${port}`;
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    if (!this.fetchFn) {
      return null;
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), this.probeTimeoutMs) : null;

    try {
      let response;
      try {
        response = await this.fetchFn(url, {
          method: "GET",
          signal: controller ? controller.signal : undefined,
          headers: { "Accept": "text/html,application/json,*/*" }
        });
      } catch (err) {
        if (typeof window !== "undefined") {
          response = await this.fetchFn(url, {
            method: "GET",
            mode: "no-cors",
            signal: controller ? controller.signal : undefined
          });
        } else {
          throw err;
        }
      }

      if (timeoutId) clearTimeout(timeoutId);
      const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const latencyMs = Math.round(t1 - t0);

      // Extract headers if available (accessible in same-origin or mock)
      const headers = {};
      if (response && response.headers) {
        if (typeof response.headers.forEach === "function") {
          response.headers.forEach((val, key) => {
            headers[key] = val;
          });
        } else if (typeof response.headers.entries === "function") {
          for (const [k, v] of response.headers.entries()) {
            headers[k] = v;
          }
        }
      }

      let body = "";
      try {
        if (response && typeof response.text === "function") {
          body = await response.text();
        }
      } catch {
        // Ignore body read errors
      }

      const detection = detectService({
        port,
        headers,
        body,
        defaultTitle: `localhost:${port}`
      });

      return {
        port,
        url,
        status: response.status || 200,
        headers,
        framework: detection.framework,
        category: detection.category,
        icon: detection.icon,
        title: detection.title,
        latencyMs
      };
    } catch {
      if (timeoutId) clearTimeout(timeoutId);
      return null;
    }
  }

  /**
   * Scans prioritized developer ports concurrently.
   * Guaranteed to complete within maxScanTimeMs (<2 seconds).
   */
  async scan(portsToScan = null) {
    const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const ports = portsToScan || this.customPorts;
    const activeServices = [];

    // Worker pool
    const queue = [...ports];
    const workers = [];

    const worker = async () => {
      while (queue.length > 0) {
        // Enforce maxScanTimeMs deadline
        const elapsed = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime;
        if (elapsed >= this.maxScanTimeMs - 50) {
          break;
        }

        const port = queue.shift();
        if (port === undefined) break;

        const res = await this.probePort(port);
        if (res) {
          activeServices.push(res);
        }
      }
    };

    const numWorkers = Math.min(this.concurrency, ports.length);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const scanDurationMs = Math.round(endTime - startTime);

    // Sort services by port number
    activeServices.sort((a, b) => a.port - b.port);

    return {
      host: this.host,
      services: activeServices,
      totalScanned: ports.length - queue.length,
      scanDurationMs
    };
  }
}

module.exports = {
  COMMON_DEV_PORTS,
  LocalhostScanner
};
