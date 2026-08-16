// Browser client for @yfzhou/dsh-touch-tooltips.
// On touch devices (coarse pointer) DSH's hover/focus tooltip bubbles never
// have a mouseleave/blur counterpart, so a tap leaves the bubble stuck on
// screen until the user taps empty space. The tooltip carries no hover
// affordance on a touchscreen, so suppress the bubbles entirely there. The
// anchor's accessible name is still exposed to assistive tech, so
// accessibility is unaffected.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-touch-tooltips",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const STYLE_ID = "@yfzhou/dsh-touch-tooltips/styles";
    const CSS = `
      @media (pointer: coarse) {
        [role="tooltip"] {
          display: none !important;
        }
      }
    `;

    const name = "touch-tooltips";
    const inject = [];

    function apply(ctx) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@yfzhou/dsh-touch-tooltips";
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      ctx.effect(() => () => tag.remove(), "touch-tooltips: styles");
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
