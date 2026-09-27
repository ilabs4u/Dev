/**
 * Dev Browser - UUID Generator & Validator
 * RFC 4122 UUID v4 generation and batch creation.
 */

const crypto = require("crypto");

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ANY_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateV4({ uppercase = false, hyphens = true } = {}) {
  let id = crypto.randomUUID();
  if (!hyphens) {
    id = id.replace(/-/g, "");
  }
  return uppercase ? id.toUpperCase() : id.toLowerCase();
}

function generateBatch(count = 10, options = {}) {
  const num = typeof count === "number" ? count : parseInt(count, 10);
  const parsed = isNaN(num) ? 10 : num;
  const safeCount = Math.max(1, Math.min(1000, parsed));
  const results = [];
  for (let i = 0; i < safeCount; i++) {
    results.push(generateV4(options));
  }
  return results;
}

function validateUuid(id, { version = 4 } = {}) {
  if (!id || typeof id !== "string") return false;
  const str = id.trim();
  if (version === 4) {
    return UUID_V4_REGEX.test(str);
  }
  return UUID_ANY_REGEX.test(str);
}

module.exports = {
  v4: generateV4,
  generateV4,
  generateBatch,
  validateUuid
};
