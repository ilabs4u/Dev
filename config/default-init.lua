-- =============================================
-- Dev Browser Default Configuration
-- Copy to ~/.config/dev/init.lua to customize
-- =============================================

-- ========= VIM KEYBINDINGS =========
keymap.set("n", "j", "scroll_down")
keymap.set("n", "k", "scroll_up")
keymap.set("n", "gg", "scroll_top")
keymap.set("n", "G", "scroll_bottom")
keymap.set("n", "d", "scroll_half_down")
keymap.set("n", "u", "scroll_half_up")
keymap.set("n", "H", "go_back")
keymap.set("n", "L", "go_forward")
keymap.set("n", "f", "link_hints")
keymap.set("n", "x", "close_tab")
keymap.set("n", "t", "new_tab")
keymap.set("n", "J", "prev_tab")
keymap.set("n", "K", "next_tab")
keymap.set("n", "<C-p>", "command_palette")
keymap.set("n", "<leader>t", "toggle_terminal")
keymap.set("n", "<leader>ip", "rotate_proxy")
keymap.set("n", "<leader>ai", "toggle_ai_sidebar")

-- ========= WORKSPACES =========
workspace.create("dev", {
  theme = "gruvbox",
  container = "development",
  proxy = "direct",
})

workspace.create("private", {
  theme = "catppuccin",
  container = "personal",
  proxy = "tor",
})

-- ========= AI AGENT =========
agent.mcp.enabled = true
agent.mcp.port = 9222
agent.permissions.allow_navigation = true
agent.permissions.allow_form_fill = true
agent.permissions.allow_click = true
agent.permissions.confirm_before = { "submit_form", "delete_*", "purchase_*" }

-- ========= AI SIDEBAR =========
ai.default_backend = "ollama"
ai.ollama.model = "llama3.2"
ai.ollama.url = "http://localhost:11434"

-- ========= NETWORK =========
network.dns.resolver = "cloudflare-doh"
network.proxy.default = "direct"

-- ========= PLUGINS =========
plugin.load("base64")
plugin.load("uuid")
plugin.load("hash")
plugin.load("timestamp")
