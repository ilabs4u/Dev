/**
 * Dev Browser - JSON Formatter & Validator
 * Format / beautify, minify, syntax error locator with line & column reporting.
 */

function formatJson(input, { indent = 2 } = {}) {
  if (input === null || input === undefined) {
    throw new TypeError("Input must not be null or undefined");
  }

  let obj;
  if (typeof input === "string") {
    obj = JSON.parse(input);
  } else {
    obj = input;
  }

  const space = indent === "tab" || indent === "\t" ? "\t" : Number(indent) || 2;
  return JSON.stringify(obj, null, space);
}

function minifyJson(input) {
  if (input === null || input === undefined) {
    throw new TypeError("Input must not be null or undefined");
  }

  let obj;
  if (typeof input === "string") {
    obj = JSON.parse(input);
  } else {
    obj = input;
  }

  return JSON.stringify(obj);
}

function parseJsonError(errMessage, jsonString) {
  // Check for (line X column Y) in message
  const lineColMatch = errMessage.match(/\(line (\d+) column (\d+)\)/i);
  if (lineColMatch) {
    const line = parseInt(lineColMatch[1], 10);
    const column = parseInt(lineColMatch[2], 10);
    const lines = jsonString.split("\n");
    const errorLine = lines[line - 1] || "";
    return {
      message: errMessage,
      line,
      column,
      snippet: errorLine.trim()
    };
  }

  // Common Node / V8 error formats:
  // "Unexpected token 'x', ... at position 15"
  // "Unexpected token 'x', ..."..." is not valid JSON"
  let position = -1;
  const posMatch = errMessage.match(/at position (\d+)/i);
  if (posMatch) {
    position = parseInt(posMatch[1], 10);
  } else {
    const quoteMatch = errMessage.match(/,\s*(?:\.\.\.)?"(.*?)"(?:\.\.\.)?\s*is not valid JSON/);
    if (quoteMatch && quoteMatch[1]) {
      const unescaped = quoteMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      const idx = jsonString.indexOf(unescaped);
      if (idx !== -1) {
        position = idx;
        const tokenMatch = errMessage.match(/Unexpected token '([^']+)'/);
        if (tokenMatch && tokenMatch[1]) {
          const tokIdx = unescaped.indexOf(tokenMatch[1]);
          if (tokIdx !== -1) {
            position = idx + tokIdx;
          }
        }
      }
    } else {
      const tokenMatch = errMessage.match(/Unexpected token '([^']+)'/);
      if (tokenMatch && tokenMatch[1]) {
        const tokIdx = jsonString.indexOf(tokenMatch[1]);
        if (tokIdx !== -1) {
          position = tokIdx;
        }
      }
    }
  }

  if (position === -1) {
    return {
      message: errMessage,
      line: 1,
      column: 1,
      snippet: jsonString.slice(0, 40)
    };
  }

  let line = 1;
  let column = 1;
  for (let i = 0; i < position && i < jsonString.length; i++) {
    if (jsonString[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  const lines = jsonString.split("\n");
  const errorLine = lines[line - 1] || "";
  const snippet = errorLine.trim();

  return {
    message: errMessage,
    position,
    line,
    column,
    snippet
  };
}

function validateJson(input) {
  if (typeof input !== "string") {
    try {
      JSON.stringify(input);
      return { valid: true, error: null, parsed: input };
    } catch (err) {
      return {
        valid: false,
        error: { message: err.message, line: 1, column: 1, snippet: "" },
        parsed: null
      };
    }
  }

  const str = input.trim();
  if (str === "") {
    return {
      valid: false,
      error: { message: "Input string is empty", line: 1, column: 1, snippet: "" },
      parsed: null
    };
  }

  try {
    const parsed = JSON.parse(str);
    return {
      valid: true,
      error: null,
      parsed
    };
  } catch (err) {
    return {
      valid: false,
      error: parseJsonError(err.message, str),
      parsed: null
    };
  }
}

module.exports = {
  formatJson,
  minifyJson,
  validateJson,
  parseJsonError
};
