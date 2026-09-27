/**
 * Dev Browser - Localhost Framework & Service Detector
 * Detects server frameworks, languages, and applications from headers and content.
 */

const FRAMEWORK_SIGNATURES = [
  // Python
  {
    name: "Python HTTP Server",
    category: "Python",
    icon: "🐍",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("simplehttp") || server.includes("basehttp") || server.includes("python");
    }
  },
  {
    name: "FastAPI",
    category: "Python",
    icon: "⚡",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("uvicorn") && (body.includes("fastapi") || body.includes("docs") || body.includes("openapi.json"));
    }
  },
  {
    name: "Flask",
    category: "Python",
    icon: "🌶️",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("werkzeug");
    }
  },
  {
    name: "Django",
    category: "Python",
    icon: "🎸",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("wsgiserver") || body.includes("csrfmiddlewaretoken");
    }
  },
  // JavaScript / Node
  {
    name: "Next.js",
    category: "JavaScript",
    icon: "▲",
    match: (headers, body) => {
      const powered = (headers["x-powered-by"] || "").toLowerCase();
      return powered.includes("next.js") || body.includes("__NEXT_DATA__") || body.includes("/_next/");
    }
  },
  {
    name: "Vite Dev Server",
    category: "JavaScript",
    icon: "⚡",
    match: (headers, body) => {
      return body.includes("@vite/client") || body.includes("/@vite/") || body.includes("vite");
    }
  },
  {
    name: "Express.js",
    category: "Node.js",
    icon: "🚂",
    match: (headers, body) => {
      const powered = (headers["x-powered-by"] || "").toLowerCase();
      return powered.includes("express");
    }
  },
  {
    name: "React App",
    category: "JavaScript",
    icon: "⚛️",
    match: (headers, body) => {
      return body.includes("react-root") || body.includes("_reactRootContainer") || body.includes("react");
    }
  },
  {
    name: "Vue App",
    category: "JavaScript",
    icon: "💚",
    match: (headers, body) => {
      return body.includes("__vue__") || body.includes("data-v-") || body.includes("vue");
    }
  },
  {
    name: "Svelte App",
    category: "JavaScript",
    icon: "🔥",
    match: (headers, body) => {
      return body.includes("svelte") || body.includes("__svelte");
    }
  },
  // Backend / Other
  {
    name: "Ollama AI API",
    category: "AI",
    icon: "🦙",
    match: (headers, body, port) => {
      return port === 11434 || body.includes("Ollama is running");
    }
  },
  {
    name: "Rust Web Server",
    category: "Rust",
    icon: "🦀",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("actix") || server.includes("axum") || server.includes("rocket");
    }
  },
  {
    name: "Go Web Server",
    category: "Go",
    icon: "🐹",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("go") || server.includes("gin");
    }
  },
  {
    name: "Ruby on Rails",
    category: "Ruby",
    icon: "💎",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      const powered = (headers["x-powered-by"] || "").toLowerCase();
      return server.includes("puma") || powered.includes("phusion") || body.includes("rails");
    }
  },
  {
    name: "Nginx",
    category: "Server",
    icon: "🟢",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("nginx");
    }
  },
  {
    name: "Apache HTTP Server",
    category: "Server",
    icon: "🪶",
    match: (headers, body) => {
      const server = (headers["server"] || "").toLowerCase();
      return server.includes("apache");
    }
  }
];

function extractTitle(html) {
  if (!html) return "";
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

function detectService(info) {
  const headers = info.headers || {};
  // Normalize header keys to lowercase
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = String(v);
  }

  const body = (info.body || "").toString();
  const port = info.port || 0;
  const title = extractTitle(body) || info.defaultTitle || `localhost:${port}`;

  for (const sig of FRAMEWORK_SIGNATURES) {
    try {
      if (sig.match(lowerHeaders, body, port)) {
        return {
          framework: sig.name,
          category: sig.category,
          icon: sig.icon,
          title
        };
      }
    } catch {
      // Continue to next signature
    }
  }

  // Fallback server detection from Server header
  const serverHeader = lowerHeaders["server"];
  if (serverHeader) {
    return {
      framework: serverHeader,
      category: "HTTP Server",
      icon: "🌐",
      title
    };
  }

  return {
    framework: "HTTP Service",
    category: "Web",
    icon: "🌐",
    title
  };
}

module.exports = {
  FRAMEWORK_SIGNATURES,
  detectService,
  extractTitle
};
