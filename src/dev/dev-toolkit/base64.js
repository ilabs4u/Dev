/**
 * Dev Browser - Base64 Encoder / Decoder
 * Supports standard RFC 4648 Base64 and URL-safe Base64 variants with UTF-8 encoding.
 */

function encode(input, { urlSafe = false, padding = true } = {}) {
  if (input === null || input === undefined) {
    throw new TypeError("Input must not be null or undefined");
  }

  let buf;
  if (Buffer.isBuffer(input)) {
    buf = input;
  } else if (input instanceof Uint8Array) {
    buf = Buffer.from(input);
  } else {
    buf = Buffer.from(String(input), "utf8");
  }

  let str = buf.toString("base64");

  if (urlSafe) {
    str = str.replace(/\+/g, "-").replace(/\//g, "_");
    if (!padding) {
      str = str.replace(/=+$/, "");
    }
  }

  return str;
}

function decode(input, { urlSafe = false } = {}) {
  if (input === null || input === undefined) {
    throw new TypeError("Input must not be null or undefined");
  }

  let str = String(input).trim();

  // Normalize URL-safe characters
  str = str.replace(/-/g, "+").replace(/_/g, "/");

  // Restore padding if missing
  const remainder = str.length % 4;
  if (remainder === 2) {
    str += "==";
  } else if (remainder === 3) {
    str += "=";
  } else if (remainder === 1) {
    throw new Error("Invalid base64 string length");
  }

  // Basic validation check
  if (!/^[A-Za-z0-9+/=]+$/.test(str) && str.length > 0) {
    throw new Error("Invalid base64 characters detected");
  }

  const buf = Buffer.from(str, "base64");
  return buf.toString("utf8");
}

function decodeRaw(input) {
  let str = String(input).trim().replace(/-/g, "+").replace(/_/g, "/");
  const remainder = str.length % 4;
  if (remainder === 2) str += "==";
  else if (remainder === 3) str += "=";
  return Buffer.from(str, "base64");
}

module.exports = {
  encode,
  decode,
  decodeRaw
};
