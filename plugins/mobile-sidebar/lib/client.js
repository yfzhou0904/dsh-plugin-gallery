// Prebuilt browser client for @yfzhou/dsh-mobile-sidebar.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-mobile-sidebar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");

    const STYLE_ID = "@yfzhou/dsh-mobile-sidebar/styles";
    const CSS = `
      .mobnav-mobile-toggle {
        display: none;
      }

      @media (max-width: 767px) {
        [data-sidebar-collapsed] {
          grid-template-columns: 0 minmax(0, 1fr) 0 !important;
        }

        [data-sidebar-collapsed] > :first-child {
          border-right: 0 !important;
        }

        [data-sidebar-collapsed] > [data-side="sidebar"] {
          display: none !important;
        }

        header:has(.mobnav-mobile-toggle) {
          padding-left: 56px !important;
        }

        :has(> .mobnav-mobile-toggle) {
          display: contents !important;
        }

        .mobnav-mobile-toggle {
          appearance: none;
          display: inline-flex;
          position: absolute;
          z-index: 2;
          top: 12px;
          left: 16px;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          padding: 0;
          color: var(--dsw-alias-label-secondary);
          background: transparent;
          border: 0;
          border-radius: 50%;
          cursor: pointer;
        }

        .mobnav-mobile-toggle:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }

        .mobnav-mobile-toggle:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }

        .mobnav-mobile-toggle-lines,
        .mobnav-mobile-toggle-lines::before,
        .mobnav-mobile-toggle-lines::after {
          display: block;
          width: 17px;
          height: 1.5px;
          background: currentColor;
          border-radius: 2px;
        }

        .mobnav-mobile-toggle-lines {
          position: relative;
        }

        .mobnav-mobile-toggle-lines::before,
        .mobnav-mobile-toggle-lines::after {
          content: "";
          position: absolute;
          left: 0;
        }

        .mobnav-mobile-toggle-lines::before { top: -5px; }
        .mobnav-mobile-toggle-lines::after { top: 5px; }
      }
    `;

    const name = "mobile-sidebar";
    const inject = ["layout", "slots"];

    function MobileSidebarToggle({ layout }) {
      return React.createElement(
        "button",
        {
          type: "button",
          className: "mobnav-mobile-toggle",
          "aria-label": "Open sidebar",
          title: "Open sidebar",
          onClick: () => layout.toggleSidebar(),
        },
        React.createElement("span", {
          className: "mobnav-mobile-toggle-lines",
          "aria-hidden": true,
        }),
      );
    }

    function apply(ctx) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@yfzhou/dsh-mobile-sidebar";
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      ctx.effect(() => () => tag.remove(), "mobile-sidebar: styles");

      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          {
            name: "conversation.session.header.actions",
            id: "mobile-sidebar-toggle",
            order: -20,
            label: "Open sidebar",
          },
          () => React.createElement(MobileSidebarToggle, { layout: ctx.layout }),
        ),
      );
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
