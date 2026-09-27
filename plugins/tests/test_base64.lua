-- Tests for Base64 plugin
local base64 = require("plugins.base64")

describe("Base64 Plugin", function()
  it("encodes a string", function()
    assert.are.equal("SGVsbG8=", base64.encode("Hello"))
  end)

  it("decodes a string", function()
    assert.are.equal("Hello", base64.decode("SGVsbG8="))
  end)

  it("roundtrips correctly", function()
    local original = "Dev Browser is awesome!"
    assert.are.equal(original, base64.decode(base64.encode(original)))
  end)
end)
