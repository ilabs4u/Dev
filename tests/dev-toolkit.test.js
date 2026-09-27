/**
 * Tests for Dev Toolkit (Task 3.2)
 * Validates Base64, JWT, JSON, Hash, UUID, Timestamp, Regex, and .http client.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  base64,
  jwt,
  json,
  hash,
  uuid,
  timestamp,
  regex,
  http,
  encodeBase64,
  decodeBase64,
  parseJwt,
  isJwtExpired,
  inspectJwt,
  formatJson,
  minifyJson,
  validateJson,
  digest,
  generateAllHashes,
  cryptoBridge,
  generateUuid,
  generateBatchUuids,
  validateUuid,
  formatRelativeTime,
  parseTimestamp,
  testRegex,
  replaceRegex,
  parseHttpFile,
  executeRequest
} = require("../src/dev/dev-toolkit");

const { DevLua } = require("../src/dev/lua-engine");

describe("Phase 3: Dev Toolkit Suite", () => {
  describe("Base64 Encoder / Decoder", () => {
    it("encodes and decodes standard UTF-8 string", () => {
      const original = "Hello World! 🚀 Привет мир";
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      assert.equal(decoded, original);
    });

    it("encodes and decodes URL-safe base64 without padding", () => {
      // String designed to produce '+' and '/' in standard base64
      const input = "subjects?_d=1&user=alice+bob";
      const urlSafe = encodeBase64(input, { urlSafe: true, padding: false });
      assert.ok(!urlSafe.includes("+"), "Must not contain +");
      assert.ok(!urlSafe.includes("/"), "Must not contain /");
      assert.ok(!urlSafe.includes("="), "Must not contain = when padding is false");

      const decoded = decodeBase64(urlSafe, { urlSafe: true });
      assert.equal(decoded, input);
    });

    it("handles binary Buffer input", () => {
      const buf = Buffer.from([0x00, 0xff, 0x42, 0x13]);
      const encoded = encodeBase64(buf);
      const rawDecoded = base64.decodeRaw(encoded);
      assert.deepEqual(rawDecoded, buf);
    });

    it("throws on invalid base64 length or non-string null input", () => {
      assert.throws(() => decodeBase64("a"), /Invalid base64/);
      assert.throws(() => encodeBase64(null), /TypeError/);
    });
  });

  describe("JWT Inspector & Decoder", () => {
    const makeJwt = (header, payload) => {
      const h = encodeBase64(JSON.stringify(header), { urlSafe: true, padding: false });
      const p = encodeBase64(JSON.stringify(payload), { urlSafe: true, padding: false });
      const s = "fake_sig_abc123";
      return `${h}.${p}.${s}`;
    };

    it("parses valid JWT header, payload, and claims", () => {
      const token = makeJwt(
        { alg: "HS256", typ: "JWT" },
        { sub: "usr_12345", name: "Alice Developer", role: "admin", iat: 1700000000 }
      );

      const parsed = parseJwt(token);
      assert.equal(parsed.algorithm, "HS256");
      assert.equal(parsed.type, "JWT");
      assert.equal(parsed.claims.subject, "usr_12345");
      assert.equal(parsed.claims.name, "Alice Developer");
      assert.equal(parsed.claims.role, "admin");
    });

    it("correctly identifies active vs expired tokens", () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // +1 hour
      const pastExp = Math.floor(Date.now() / 1000) - 3600;   // -1 hour

      const activeToken = makeJwt({ alg: "HS256" }, { sub: "alice", exp: futureExp });
      const expiredToken = makeJwt({ alg: "HS256" }, { sub: "bob", exp: pastExp });

      assert.equal(isJwtExpired(activeToken), false, "Future exp must not be expired");
      assert.equal(isJwtExpired(expiredToken), true, "Past exp must be expired");

      const inspection = inspectJwt(expiredToken);
      assert.equal(inspection.valid, true);
      assert.equal(inspection.data.isExpired, true);
      assert.ok(inspection.data.remainingMs < 0);
    });

    it("handles malformed JWT tokens gracefully", () => {
      const inspection1 = inspectJwt("not.a.valid.jwt.four.dots");
      assert.equal(inspection1.valid, false);
      assert.ok(inspection1.error.includes("Invalid JWT format"));

      const inspection2 = inspectJwt("eyJhbGciOiJIUzI1NiJ9.invalid-json.sig");
      assert.equal(inspection2.valid, false);
      assert.ok(inspection2.error.includes("Failed to decode JWT Payload"));
    });
  });

  describe("JSON Formatter & Validator", () => {
    it("formats and beautifies JSON with custom indentation", () => {
      const raw = '{"name":"dev","items":[1,2],"ok":true}';
      const formatted2 = formatJson(raw, { indent: 2 });
      assert.ok(formatted2.includes('  "name": "dev"'));

      const formatted4 = formatJson(raw, { indent: 4 });
      assert.ok(formatted4.includes('    "name": "dev"'));

      const formattedTab = formatJson(raw, { indent: "tab" });
      assert.ok(formattedTab.includes('\t"name": "dev"'));
    });

    it("minifies formatted JSON", () => {
      const formatted = `{\n  "status": 200,\n  "data": {\n    "test": true\n  }\n}`;
      const minified = minifyJson(formatted);
      assert.equal(minified, '{"status":200,"data":{"test":true}}');
    });

    it("validates correct JSON and pinpoints syntax errors", () => {
      const validRes = validateJson('{"valid": true}');
      assert.equal(validRes.valid, true);
      assert.equal(validRes.error, null);
      assert.deepEqual(validRes.parsed, { valid: true });

      const invalidJson = '{\n  "title": "hello",\n  "broken": unquoted,\n  "count": 5\n}';
      const invalidRes = validateJson(invalidJson);
      assert.equal(invalidRes.valid, false);
      assert.ok(invalidRes.error !== null);
      assert.equal(invalidRes.error.line, 3);
      assert.ok(invalidRes.error.snippet.includes("unquoted"));
    });
  });

  describe("Hash Generator & Crypto Digest Bridge", () => {
    it("generates correct MD5, SHA-1, SHA-256, and SHA-512 hashes", () => {
      const input = "hello world";
      // Known standard test vectors
      assert.equal(digest("md5", input), "5eb63bbbe01eeed093cb22bb8f5acdc3");
      assert.equal(digest("sha1", input), "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
      assert.equal(digest("sha256", input), "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
      assert.equal(digest("sha512", input), "309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f");
    });

    it("generates all hashes in batch object", () => {
      const hashes = generateAllHashes("dev browser");
      assert.ok(hashes.md5);
      assert.ok(hashes.sha1);
      assert.ok(hashes.sha256);
      assert.ok(hashes.sha512);
      assert.equal(typeof hashes.sha256, "string");
      assert.equal(hashes.sha256.length, 64);
    });

    it("exposes native cryptoBridge and functions cleanly with DevLua", () => {
      assert.equal(typeof cryptoBridge.digest, "function");
      const res = cryptoBridge.digest("SHA-256", "test");
      assert.equal(res, "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");

      // Verify dev.crypto on DevLua bridge
      assert.equal(typeof DevLua.crypto.digest, "function");
      assert.equal(DevLua.crypto.digest("SHA-1", "test"), "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3");

      // Verify plugin.load("hash") returns working hash functions
      const hashPlugin = DevLua.loadPlugin("hash");
      assert.equal(hashPlugin.name, "Hash Generator");
      assert.equal(hashPlugin.sha256("test"), "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
      assert.equal(hashPlugin.sha1("test"), "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3");
    });
  });

  describe("UUID v4 Generator & Batch Generation", () => {
    it("generates valid RFC 4122 v4 UUIDs", () => {
      const id = generateUuid();
      assert.equal(validateUuid(id), true);
      assert.equal(id.length, 36);
      assert.equal(id[14], "4", "Version digit must be 4");
    });

    it("generates batch of unique UUIDs with options", () => {
      const batch = generateBatchUuids(20, { uppercase: true, hyphens: true });
      assert.equal(batch.length, 20);
      const unique = new Set(batch);
      assert.equal(unique.size, 20, "All generated UUIDs must be distinct");
      assert.equal(batch[0], batch[0].toUpperCase(), "Must be uppercase");

      const noHyphens = generateBatchUuids(5, { hyphens: false });
      assert.equal(noHyphens[0].length, 32);
      assert.ok(!noHyphens[0].includes("-"));
    });
  });

  describe("Timestamp & Epoch Converter", () => {
    it("converts epoch milliseconds and seconds to ISO and relative time", () => {
      const fixedMs = 1700000000000;
      const resMs = parseTimestamp(fixedMs);
      assert.equal(resMs.ms, fixedMs);
      assert.equal(resMs.seconds, 1700000000);
      assert.equal(resMs.iso, "2023-11-14T22:13:20.000Z");

      // Epoch in seconds (auto-detected)
      const resSec = parseTimestamp(1700000000);
      assert.equal(resSec.ms, fixedMs);
      assert.equal(resSec.iso, "2023-11-14T22:13:20.000Z");
    });

    it("calculates accurate human relative time", () => {
      const now = Date.now();
      assert.equal(formatRelativeTime(now - 1000, now), "just now");
      assert.equal(formatRelativeTime(now - 60000 * 5, now), "5 minutes ago");
      assert.equal(formatRelativeTime(now - 3600000 * 2, now), "2 hours ago");
      assert.equal(formatRelativeTime(now + 3600000 * 3, now), "in 3 hours");
      assert.equal(formatRelativeTime(now + 86400000 * 4, now), "in 4 days");
    });
  });

  describe("Regex Tester", () => {
    it("finds matches, indices, and capture groups", () => {
      const pattern = "(\\w+)@(\\w+)\\.([a-z]+)";
      const flags = "g";
      const text = "Contact alice@dev.org or bob@corp.io for info";

      const res = testRegex(pattern, flags, text);
      assert.equal(res.valid, true);
      assert.equal(res.count, 2);
      assert.equal(res.matches[0].match, "alice@dev.org");
      assert.deepEqual(res.matches[0].captures, ["alice", "dev", "org"]);
      assert.equal(res.matches[1].match, "bob@corp.io");
    });

    it("extracts named capture groups", () => {
      const pattern = "(?<proto>https?)://(?<domain>[a-z0-9.-]+)";
      const text = "Visit https://github.com and http://localhost";
      const res = testRegex(pattern, "g", text);
      assert.equal(res.count, 2);
      assert.deepEqual(res.matches[0].groups, { proto: "https", domain: "github.com" });
    });

    it("replaces matches with substitution string", () => {
      const res = replaceRegex("\\d+", "g", "item 1 costs 20 dollars", "#");
      assert.equal(res.valid, true);
      assert.equal(res.result, "item # costs # dollars");
    });

    it("handles invalid regex pattern gracefully without throwing", () => {
      const res = testRegex("[invalid(regex", "g", "sample");
      assert.equal(res.valid, false);
      assert.ok(res.error.length > 0);
    });
  });

  describe(".http REST Client", () => {
    it("parses RFC 7230 / VS Code .http file with variables, headers, and body", () => {
      const httpFile = `
@baseUrl = https://api.devbrowser.local/v1
@token = secret_bearer_token_xyz

### Get Profile
GET {{baseUrl}}/profile HTTP/1.1
Authorization: Bearer {{token}}
Accept: application/json

### Create Item
POST {{baseUrl}}/items
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Widget A",
  "price": 49.99
}
`;

      const parsed = parseHttpFile(httpFile);
      assert.equal(parsed.variables.baseUrl, "https://api.devbrowser.local/v1");
      assert.equal(parsed.variables.token, "secret_bearer_token_xyz");
      assert.equal(parsed.requests.length, 2);

      const req1 = parsed.requests[0];
      assert.equal(req1.name, "Get Profile");
      assert.equal(req1.method, "GET");
      assert.equal(req1.url, "https://api.devbrowser.local/v1/profile");
      assert.equal(req1.headers["Authorization"], "Bearer secret_bearer_token_xyz");

      const req2 = parsed.requests[1];
      assert.equal(req2.name, "Create Item");
      assert.equal(req2.method, "POST");
      assert.equal(req2.url, "https://api.devbrowser.local/v1/items");
      assert.ok(req2.body.includes('"name": "Widget A"'));
    });

    it("executes HTTP request with timing measurements using mock fetch", async () => {
      const mockFetch = async (url, options) => {
        return {
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "application/json"]]),
          text: async () => JSON.stringify({ success: true, url, method: options.method })
        };
      };

      const req = {
        name: "Mock Request",
        method: "POST",
        url: "https://example.com/api/test",
        headers: { "Content-Type": "application/json" },
        body: '{"foo":"bar"}'
      };

      const result = await executeRequest(req, { fetchFn: mockFetch });
      assert.equal(result.isError, false);
      assert.equal(result.status, 200);
      assert.equal(result.data.success, true);
      assert.equal(result.data.method, "POST");
      assert.ok(typeof result.durationMs === "number");
    });

    it("handles fetch failure gracefully and returns timing", async () => {
      const failingFetch = async () => {
        throw new Error("Connection refused (ECONNREFUSED 127.0.0.1:8080)");
      };

      const req = { method: "GET", url: "http://127.0.0.1:8080/health" };
      const res = await executeRequest(req, { fetchFn: failingFetch });
      assert.equal(res.isError, true);
      assert.ok(res.error.includes("ECONNREFUSED"));
      assert.ok(typeof res.durationMs === "number");
    });
  });

  describe("Edge Cases & Robustness", () => {
    it("handles empty strings across Base64, Hash, and Regex", () => {
      assert.equal(encodeBase64(""), "");
      assert.equal(decodeBase64(""), "");

      const emptyHashes = generateAllHashes("");
      assert.equal(emptyHashes.md5, "d41d8cd98f00b204e9800998ecf8427e");
      assert.equal(emptyHashes.sha256, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

      const regexEmpty = testRegex("", "", "any text");
      assert.equal(regexEmpty.valid, true);
    });

    it("parses 2-segment unsecured JWT without signature", () => {
      const h = encodeBase64(JSON.stringify({ alg: "none", typ: "JWT" }), { urlSafe: true });
      const p = encodeBase64(JSON.stringify({ sub: "user-42", scope: "read" }), { urlSafe: true });
      const unsecured = `${h}.${p}`;

      const res = inspectJwt(unsecured);
      assert.equal(res.valid, true);
      assert.equal(res.data.claims.subject, "user-42");
      assert.equal(res.data.signature, "");
    });

    it("normalizes diverse hash algorithm case formats", () => {
      const v1 = digest("SHA-256", "abc");
      const v2 = digest("sha256", "abc");
      const v3 = digest("Sha-256", "abc");
      assert.equal(v1, v2);
      assert.equal(v2, v3);
    });

    it("handles batch UUID count edge values safely", () => {
      const zeroBatch = generateBatchUuids(0);
      assert.equal(zeroBatch.length, 1, "Must generate at least 1");

      const negativeBatch = generateBatchUuids(-10);
      assert.equal(negativeBatch.length, 1);
    });

    it("parses valid ISO 8601 strings into epoch timestamps", () => {
      const iso = "2026-09-27T12:00:00.000Z";
      const res = parseTimestamp(iso);
      assert.equal(res.iso, iso);
      assert.equal(typeof res.ms, "number");
    });
  });
});
