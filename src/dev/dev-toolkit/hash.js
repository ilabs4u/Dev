/**
 * Dev Browser - Hash Generator & Crypto Digest Bridge
 * Generates MD5, SHA-1, SHA-256, SHA-512 digests and provides the native
 * dev.crypto bridge for plugins (e.g. plugins/hash.lua).
 */

const crypto = require("crypto");

const ALGORITHM_MAP = {
  md5: "md5",
  sha1: "sha1",
  "sha-1": "sha1",
  sha256: "sha256",
  "sha-256": "sha256",
  sha512: "sha512",
  "sha-512": "sha512"
};

function normalizeAlgorithm(algo) {
  if (!algo || typeof algo !== "string") {
    throw new Error(`Invalid hash algorithm: ${algo}`);
  }
  const key = algo.toLowerCase().trim();
  const normalized = ALGORITHM_MAP[key];
  if (!normalized) {
    throw new Error(`Unsupported hash algorithm "${algo}". Supported: MD5, SHA-1, SHA-256, SHA-512`);
  }
  return normalized;
}

function digest(algorithm, input, { encoding = "hex" } = {}) {
  const normAlgo = normalizeAlgorithm(algorithm);
  let data;
  if (Buffer.isBuffer(input)) {
    data = input;
  } else if (input instanceof Uint8Array) {
    data = Buffer.from(input);
  } else {
    data = Buffer.from(input === null || input === undefined ? "" : String(input), "utf8");
  }

  const hash = crypto.createHash(normAlgo);
  hash.update(data);
  return hash.digest(encoding);
}

function generateAll(input, { encoding = "hex" } = {}) {
  return {
    md5: digest("md5", input, { encoding }),
    sha1: digest("sha1", input, { encoding }),
    sha256: digest("sha256", input, { encoding }),
    sha512: digest("sha512", input, { encoding })
  };
}

/**
 * Native bridge object matching Lua plugins expectation (e.g. dev.crypto.digest)
 */
const cryptoBridge = {
  digest(algorithm, input) {
    return digest(algorithm, input, { encoding: "hex" });
  }
};

module.exports = {
  digest,
  generateAll,
  normalizeAlgorithm,
  cryptoBridge
};
