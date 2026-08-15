// Prebuilt browser client for @yfzhou/dsh-mobile-sidebar.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-mobile-sidebar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const { IconPanelLeftOutline16 } = require("@deepseek-ai/dsh-client-ui-primitives");

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

        [data-sidebar-collapsed] [data-phase="active"] header,
        [data-sidebar-collapsed] [data-phase="settling"] header {
          padding-left: 48px !important;
        }

        [data-sidebar-collapsed] .mobnav-mobile-toggle {
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
          pointer-events: auto;
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
          "aria-label": "Toggle sidebar",
          title: "Toggle sidebar",
          onClick: () => layout.toggleSidebar(),
        },
        React.createElement(IconPanelLeftOutline16, {
          size: 18,
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

      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "mobile-sidebar-toggle",
            order: -20,
            label: "Toggle sidebar",
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
