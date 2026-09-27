-- Dev Browser Plugin: Hash Generator
-- Note: Uses browser's native crypto API via Lua bridge
local M = {}
M.name = "Hash Generator"
M.description = "Generate MD5, SHA-1, SHA-256 hashes"
M.version = "1.0.0"

function M.sha256(input)
  -- Delegates to browser's SubtleCrypto API via dev.crypto bridge
  return dev.crypto.digest("SHA-256", input)
end

function M.sha1(input)
  return dev.crypto.digest("SHA-1", input)
end

return M
