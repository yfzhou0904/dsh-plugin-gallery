/**
 * Host half of the dsh-full-width-chat plugin.
 *
 * This plugin is client-only (it injects a stylesheet into the web page that
 * widens the conversation). The host half exists only so the composition row
 * has a valid node-half plugin; all work happens in the browser client half.
 */
const name = "full-width-chat";
const inject = [];

function apply(_ctx) {
  // Nothing to do on the host: the stylesheet is injected by the client half.
}

export { apply, inject, name };
