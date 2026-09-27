/**
 * Dev Browser - MCP Permission Manager
 * Enforces strict permission controls and user approvals for AI agent actions.
 */

class PermissionManager {
  /**
   * @param {Object} [options]
   * @param {Object} [options.permissions] - Initial permissions dictionary
   * @param {Function} [options.promptHandler] - User approval dialog callback
   */
  constructor(options = {}) {
    this.permissions = {
      allow_navigation: true,
      allow_form_fill: true,
      allow_click: true,
      allow_evaluate_js: false, // evaluate_js is sensitive by default
      confirm_before: [],
      ...(options.permissions || {})
    };
    this.promptHandler = options.promptHandler || null;
    this.history = [];
  }

  /**
   * Update permission settings (e.g. from Lua config).
   * @param {Object} perms
   */
  setPermissions(perms) {
    if (!perms || typeof perms !== "object") return;
    this.permissions = { ...this.permissions, ...perms };
  }

  /**
   * Set user prompt / confirmation handler.
   * @param {Function} fn - (actionDetails) => Promise<boolean> | boolean
   */
  setPromptHandler(fn) {
    this.promptHandler = fn;
  }

  /**
   * Check if action matches any wildcard pattern in confirm_before.
   * @param {string} toolName
   * @param {Object} [args]
   * @returns {boolean}
   */
  isConfirmRequired(toolName, args = {}) {
    const list = this.permissions.confirm_before || [];
    for (const pattern of list) {
      if (!pattern) continue;
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      const regex = new RegExp(`^${escaped}$`, "i");
      if (regex.test(toolName)) return true;
      if (args.selector && regex.test(args.selector)) return true;
      if (args.action && regex.test(args.action)) return true;
    }
    return false;
  }

  /**
   * Verify if a tool call is permitted.
   * Throws Error if permission is denied.
   * @param {string} toolName
   * @param {Object} [args]
   * @returns {Promise<boolean>}
   */
  async checkPermission(toolName, args = {}) {
    let allowedByDefault = false;

    switch (toolName) {
      case "navigate_to":
      case "go_back":
      case "go_forward":
      case "reload":
        allowedByDefault = this.permissions.allow_navigation !== false;
        break;
      case "click":
        allowedByDefault = !!this.permissions.allow_click;
        break;
      case "fill":
        allowedByDefault = !!this.permissions.allow_form_fill;
        break;
      case "evaluate_js":
        allowedByDefault = !!this.permissions.allow_evaluate_js;
        break;
      default:
        // Inspection and DevTools tools allowed unless matching confirm_before
        allowedByDefault = true;
        break;
    }

    const requiresConfirm = this.isConfirmRequired(toolName, args);

    if (!allowedByDefault || requiresConfirm) {
      const reason = requiresConfirm
        ? `Action matches confirm_before policy: ${toolName}`
        : `Action requires permission: ${toolName}`;

      if (typeof this.promptHandler === "function") {
        let approved = false;
        try {
          approved = await this.promptHandler({
            tool: toolName,
            arguments: args,
            reason
          });
        } catch {
          approved = false;
        }

        this.history.push({
          tool: toolName,
          arguments: args,
          approved: !!approved,
          prompted: true,
          timestamp: Date.now()
        });

        if (!approved) {
          throw new Error(`Permission denied: '${toolName}' action rejected by user`);
        }
        return true;
      }

      this.history.push({
        tool: toolName,
        arguments: args,
        approved: false,
        prompted: false,
        timestamp: Date.now()
      });

      const configKey = toolName === "fill"
        ? "allow_form_fill"
        : `allow_${toolName}`;

      throw new Error(`Permission denied: '${toolName}' requires user approval or agent.permissions.${configKey} = true`);
    }

    this.history.push({
      tool: toolName,
      arguments: args,
      approved: true,
      prompted: false,
      timestamp: Date.now()
    });
    return true;
  }
}

module.exports = {
  PermissionManager
};
