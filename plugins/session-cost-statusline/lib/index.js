/**
 * Host half of the session-cost-statusline plugin.
 *
 * This plugin is client-only (it renders the status line and carries the CNY
 * rate table embedded in the browser half, since the persistent client module
 * system does not expose the dynamic `host.call`/`harness.handle` RPC bridge).
 * The host half exists so the composition row has a valid node-half plugin.
 */
const name = "session-cost-statusline";
const inject = [];

function apply(_ctx) {
  // Nothing to do on the host: all work happens in the browser client half.
}

export { apply, inject, name };
