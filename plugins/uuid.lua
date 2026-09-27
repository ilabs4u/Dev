-- Dev Browser Plugin: UUID v4 Generator
math.randomseed(os.time() + math.floor(os.clock() * 1000000))

local M = {}
M.name = "UUID Generator"
M.description = "Generate UUID v4 strings"
M.version = "1.0.0"

function M.generate()
  local template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  return string.gsub(template, "[xy]", function(c)
    local v = (c == "x") and math.random(0, 0xf) or math.random(8, 0xb)
    return string.format("%x", v)
  end)
end

return M
