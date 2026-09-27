/**
 * Dev Browser - .http REST Client
 * Parses RFC 7230 / VS Code .http and .rest files and executes HTTP requests with timing.
 */

function parseHttpFile(content) {
  if (typeof content !== "string") {
    throw new TypeError("HTTP file content must be a string");
  }

  const lines = content.split(/\r?\n/);
  const variables = {};
  const rawSections = [];
  let currentSection = { name: "Request", lines: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check variable definition: @varName = value
    const varMatch = trimmed.match(/^@([a-zA-Z0-9_-]+)\s*=\s*(.*)$/);
    if (varMatch) {
      variables[varMatch[1]] = varMatch[2].trim();
      continue;
    }

    // Check delimiter: ### [Optional Request Name]
    if (trimmed.startsWith("###")) {
      if (currentSection.lines.length > 0) {
        rawSections.push(currentSection);
      }
      const title = trimmed.replace(/^###\s*/, "").trim() || `Request ${rawSections.length + 1}`;
      currentSection = { name: title, lines: [] };
      continue;
    }

    currentSection.lines.push(line);
  }

  if (currentSection.lines.length > 0) {
    rawSections.push(currentSection);
  }

  const requests = [];

  for (const section of rawSections) {
    const req = parseSingleRequest(section.lines, variables, section.name);
    if (req) {
      requests.push(req);
    }
  }

  return {
    variables,
    requests
  };
}

function substituteVariables(text, variables) {
  if (!text) return "";
  return text.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (match, varName) => {
    return Object.prototype.hasOwnProperty.call(variables, varName) ? variables[varName] : match;
  });
}

function parseSingleRequest(lines, variables, defaultName) {
  // Strip comments and empty leading lines
  let startIdx = 0;
  while (startIdx < lines.length) {
    const t = lines[startIdx].trim();
    if (t && !t.startsWith("#") && !t.startsWith("//")) {
      break;
    }
    startIdx++;
  }

  if (startIdx >= lines.length) return null;

  // First line is request line: METHOD URL [HTTP/1.1]
  const reqLine = substituteVariables(lines[startIdx].trim(), variables);
  const reqParts = reqLine.split(/\s+/);

  let method = "GET";
  let url = "";

  const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
  if (HTTP_METHODS.includes(reqParts[0].toUpperCase())) {
    method = reqParts[0].toUpperCase();
    url = reqParts.slice(1).filter(p => !p.startsWith("HTTP/")).join(" ");
  } else {
    // Implicit GET
    url = reqParts.filter(p => !p.startsWith("HTTP/")).join(" ");
  }

  if (!url) return null;

  // Headers: until first blank line
  const headers = {};
  let bodyStartIdx = -1;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      bodyStartIdx = i + 1;
      break;
    }

    if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const colonIdx = rawLine.indexOf(":");
    if (colonIdx > 0) {
      const headerKey = rawLine.slice(0, colonIdx).trim();
      const headerVal = substituteVariables(rawLine.slice(colonIdx + 1).trim(), variables);
      headers[headerKey] = headerVal;
    }
  }

  let body = "";
  if (bodyStartIdx !== -1 && bodyStartIdx < lines.length) {
    const rawBody = lines.slice(bodyStartIdx).join("\n").trim();
    body = substituteVariables(rawBody, variables);
  }

  return {
    name: defaultName,
    method,
    url,
    headers,
    body
  };
}

async function executeRequest(req, { fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== "function") {
    throw new Error("A valid fetch function is required to execute HTTP requests");
  }

  const startTime = Date.now();
  const options = {
    method: req.method || "GET",
    headers: { ...req.headers }
  };

  if (req.body && !["GET", "HEAD"].includes(req.method.toUpperCase())) {
    options.body = req.body;
  }

  try {
    const response = await fetchFn(req.url, options);
    const durationMs = Date.now() - startTime;

    const responseHeaders = {};
    if (response.headers && typeof response.headers.forEach === "function") {
      response.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });
    }

    let responseBody = "";
    if (typeof response.text === "function") {
      responseBody = await response.text();
    }

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(responseBody);
    } catch {
      // Body is not JSON
    }

    return {
      isError: false,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      data: parsedJson,
      durationMs,
      sizeBytes: Buffer.byteLength(responseBody, "utf8"),
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers
      }
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      isError: true,
      error: err.message,
      durationMs,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers
      }
    };
  }
}

module.exports = {
  parseHttpFile,
  parseSingleRequest,
  substituteVariables,
  executeRequest
};
