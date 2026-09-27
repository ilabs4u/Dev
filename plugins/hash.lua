-- Dev Browser Plugin: Hash Generator
-- Note: Uses browser's native crypto API via Lua bridge
-- TODO: requires native dev.crypto bridge (Phase 3)
if not dev or not dev.crypto then
  error("hash plugin requires dev.crypto bridge (not yet available)")
end

local M = {}
M.name = "Hash Generator"
M.description = "Generate MD5, SHA-1, SHA-256 hashes"
M.version = "1.0.0"

function M.sha256(input)
  return dev.crypto.digest("SHA-256", input)
end

function M.sha1(input)
  return dev.crypto.digest("SHA-1", input)
end

return M
