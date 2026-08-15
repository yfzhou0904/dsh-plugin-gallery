// Browser client bundle for @yfzhou/dsh-full-width-chat.
// Served as a prebuilt module via window.__ModuleLoader__.load (CJS factory
// form). Client-only: injects a stylesheet that overrides the conversation
// column's fixed width cap so the chat fills the full available width.
//
// The conversation root element is the direct child of the `[data-slot="conversation"]`
// slot wrapper and carries a `data-phase` attribute; the shell defines
// --dsh-chat-content-width (default 748px) on it. We override it to 100%.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-full-width-chat",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const STYLE_ID = "@yfzhou/dsh-full-width-chat/styles";
    const CSS = [
      '[data-slot="conversation"] > [data-phase] {',
      "  --dsh-chat-content-width: 100%;",
      "}",
    ].join("\n");

    const name = "full-width-chat";
    const inject = [];

    function apply(_ctx) {
      if (typeof document === "undefined") return;
      if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") !== null) return;
      const tag = document.createElement("style");
      tag.dataset.plugin = "@yfzhou/dsh-full-width-chat";
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      _ctx.effect(() => () => tag.remove(), "full-width-chat: styles");
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
