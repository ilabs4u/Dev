/**
 * Dev Browser - JWT Inspector & Decoder
 * Decodes JSON Web Tokens (Header, Payload, Signature), checks expiration,
 * and extracts standard RFC 7519 claims.
 */

const { decode } = require("./base64");

function base64UrlDecode(str) {
  return decode(str, { urlSafe: true });
}

function parseJwt(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Token must be a non-empty string");
  }

  const parts = token.trim().split(".");
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid JWT format: expected 2 or 3 segments separated by dots, got ${parts.length}`);
  }

  const [rawHeader, rawPayload, rawSignature = ""] = parts;

  let header;
  try {
    const decodedHeader = base64UrlDecode(rawHeader);
    header = JSON.parse(decodedHeader);
  } catch (err) {
    throw new Error(`Failed to decode JWT Header: ${err.message}`);
  }

  let payload;
  try {
    const decodedPayload = base64UrlDecode(rawPayload);
    payload = JSON.parse(decodedPayload);
  } catch (err) {
    throw new Error(`Failed to decode JWT Payload: ${err.message}`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  let isExpired = false;
  let expiresAt = null;
  let issuedAt = null;
  let notBefore = null;
  let remainingMs = null;

  if (typeof payload.exp === "number") {
    // exp is in seconds per RFC 7519
    const expMs = payload.exp * 1000;
    expiresAt = new Date(expMs);
    isExpired = nowMs >= expMs;
    remainingMs = expMs - nowMs;
  }

  if (typeof payload.iat === "number") {
    issuedAt = new Date(payload.iat * 1000);
  }

  if (typeof payload.nbf === "number") {
    notBefore = new Date(payload.nbf * 1000);
  }

  const standardClaims = ["iss", "sub", "aud", "exp", "nbf", "iat", "jti"];
  const customClaims = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!standardClaims.includes(k)) {
      customClaims[k] = v;
    }
  }

  return {
    raw: {
      header: rawHeader,
      payload: rawPayload,
      signature: rawSignature
    },
    header,
    payload,
    signature: rawSignature,
    algorithm: header.alg || "none",
    type: header.typ || "JWT",
    isExpired,
    expiresAt,
    issuedAt,
    notBefore,
    remainingMs,
    claims: {
      issuer: payload.iss || null,
      subject: payload.sub || null,
      audience: payload.aud || null,
      jwtId: payload.jti || null,
      ...customClaims
    }
  };
}

function isExpired(token, currentTimeMs = Date.now()) {
  const parsed = parseJwt(token);
  if (!parsed.expiresAt) return false;
  return currentTimeMs >= parsed.expiresAt.getTime();
}

function inspect(token) {
  try {
    const parsed = parseJwt(token);
    return {
      valid: true,
      data: parsed,
      error: null
    };
  } catch (err) {
    return {
      valid: false,
      data: null,
      error: err.message
    };
  }
}

module.exports = {
  parseJwt,
  isExpired,
  inspect,
  base64UrlDecode
};
