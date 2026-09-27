-- Dev Browser Plugin: Unix Timestamp Converter
local M = {}
M.name = "Timestamp Converter"
M.description = "Convert between Unix timestamps and human-readable dates"
M.version = "1.0.0"

function M.to_human(timestamp)
  return os.date("%Y-%m-%d %H:%M:%S", tonumber(timestamp))
end

function M.to_unix()
  return tostring(os.time())
end

return M
