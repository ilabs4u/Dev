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
      return body.includes("/@vite/client") || body.includes("@vite/client") || body.includes("/@vite/");
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
      return body.includes("data-reactroot") || body.includes("_reactRootContainer") || body.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__") || /<div[^>]+id=["']root["'][^>]*data-reactroot/i.test(body);
    }
  },
  {
    name: "Vue App",
    category: "JavaScript",
    icon: "💚",
    match: (headers, body) => {
      return body.includes("__vue__") || body.includes("__vue_app__") || /data-v-[a-f0-9]{6,8}/i.test(body) || /<div[^>]+id=["']app["'][^>]*data-v-/i.test(body);
    }
  },
  {
    name: "Svelte App",
    category: "JavaScript",
    icon: "🔥",
    match: (headers, body) => {
      return body.includes("__svelte") || /class=["'][^"']*\bsvelte-[a-z0-9]+\b/i.test(body);
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
      return server.includes("puma") || powered.includes("phusion") || (body.includes("csrf-param") && body.includes("authenticity_token")) || body.includes("data-turbo-track");
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

  // Fallback port heuristics for opaque cross-origin or stripped-header responses
  const PORT_HEURISTICS = {
    3000: { framework: "Node / Next.js Server", category: "JavaScript", icon: "▲" },
    3001: { framework: "Dev Server", category: "Web", icon: "🌐" },
    4200: { framework: "Angular Dev Server", category: "JavaScript", icon: "🅰️" },
    5000: { framework: "Flask / Express Server", category: "Backend", icon: "🌶️" },
    5173: { framework: "Vite Dev Server", category: "JavaScript", icon: "⚡" },
    5174: { framework: "Vite Dev Server", category: "JavaScript", icon: "⚡" },
    4173: { framework: "Vite Preview Server", category: "JavaScript", icon: "⚡" },
    8000: { framework: "Python / Django Server", category: "Python", icon: "🐍" },
    8080: { framework: "HTTP Web Server", category: "Web", icon: "🌐" },
    8501: { framework: "Streamlit App", category: "Python", icon: "🎈" },
    7860: { framework: "Gradio App", category: "AI", icon: "🤗" },
    11434: { framework: "Ollama AI API", category: "AI", icon: "🦙" },
    1337: { framework: "Strapi CMS", category: "Node.js", icon: "🚀" },
    9222: { framework: "Chrome DevTools Protocol", category: "DevTools", icon: "🔧" }
  };

  const portHeuristic = PORT_HEURISTICS[port];
  if (portHeuristic) {
    return {
      framework: portHeuristic.framework,
      category: portHeuristic.category,
      icon: portHeuristic.icon,
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
