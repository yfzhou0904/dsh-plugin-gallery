// Browser client for @yfzhou/dsh-composer-enter.
// Enter inserts a newline; Cmd/Ctrl+Enter submits. The listener is capture-phase
// so it runs before DSH's InputBar handler, while leaving IME composition alone.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-composer-enter",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const name = "composer-enter";
    const inject = [];

    function isComposerTextArea(target) {
      return target instanceof HTMLTextAreaElement &&
        target.closest('[data-slot="conversation.composer"]') !== null;
    }

    function onKeyDown(event) {
      if (event.key !== "Enter" || event.isComposing || event.defaultPrevented) return;
      if (!isComposerTextArea(event.target)) return;

      // Leave Cmd/Ctrl+Enter to DSH: its native keyboard handler already
      // submits using the correct session-aware path. Only plain Enter needs
      // interception, because DSH otherwise prevents the textarea newline.
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;

      event.stopImmediatePropagation();
      event.preventDefault();
      const target = event.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.setRangeText("\n", start, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function apply(ctx) {
      document.addEventListener("keydown", onKeyDown, true);
      ctx.effect(() => () => {
        document.removeEventListener("keydown", onKeyDown, true);
      }, "composer-enter: keyboard listener");
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
