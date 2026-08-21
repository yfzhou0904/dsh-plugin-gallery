// Prebuilt browser client for @yfzhou/dsh-codex-usage.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-codex-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");

    const name = "codex-usage";
    const STYLE_ID = "@yfzhou/dsh-codex-usage/styles";
    const CSS = `
      .codex-usage-panel {
          left: auto !important;
          right: 0 !important;
          width: min(176px, calc(100vw - 32px)) !important;
          max-width: calc(100vw - 32px) !important;
          padding: 10px 10px 9px !important;
        }

        .codex-usage-panel .codex-usage-header {
          gap: 5px !important;
          padding-bottom: 8px !important;
        }

        .codex-usage-panel .codex-usage-header strong {
          font-size: 13px !important;
        }

        .codex-usage-panel .codex-usage-plan {
          gap: 5px !important;
          padding: 7px 0 6px !important;
          font-size: 11px !important;
        }

        .codex-usage-panel .codex-usage-window {
          padding: 7px 0 !important;
        }

        .codex-usage-panel .codex-usage-window-first {
          padding-top: 1px !important;
        }

        .codex-usage-panel .codex-usage-window > div:first-child {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 2px !important;
          margin-bottom: 5px !important;
        }

        .codex-usage-panel .codex-usage-window > div:last-child {
          font-size: 10px !important;
          line-height: 1.3 !important;
          white-space: nowrap !important;
        }

        .codex-usage-panel .codex-usage-footer {
          padding-top: 7px !important;
        }

      .codex-usage-panel .codex-usage-footer button {
        width: 100% !important;
        padding: 0 7px !important;
      }
    `;
    const inject = ["slots"];
    const colors = {
      surface: "var(--dsw-alias-bg-overlay)",
      raised: "var(--dsw-alias-bg-layer-1)",
      nested: "var(--dsw-alias-bg-layer-2)",
      border: "var(--dsw-alias-border-l1)",
      strongBorder: "var(--dsw-alias-border-l2)",
      primary: "var(--dsw-alias-label-primary)",
      secondary: "var(--dsw-alias-label-secondary)",
      brand: "var(--dsw-alias-brand-primary)",
      error: "var(--dsw-alias-state-error-primary)",
    };

    function Icon({ size = 17 }) {
      return React.createElement(
        "svg",
        { width: size, height: size, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
        React.createElement("circle", { cx: 10, cy: 10, r: 7.2, stroke: "currentColor", strokeWidth: 1.8 }),
        React.createElement("path", { d: "M10 3v7h7", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" }),
      );
    }

    function formatReset(resetAt) {
      if (typeof resetAt !== "number") return "Reset time unavailable";
      const date = new Date(resetAt * 1000);
      if (Number.isNaN(date.getTime())) return "Reset time unavailable";
      const pad = (value) => String(value).padStart(2, "0");
      const offsetMinutes = -date.getTimezoneOffset();
      const offsetSign = offsetMinutes < 0 ? "-" : "+";
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetRemainder = Math.abs(offsetMinutes) % 60;
      const offset = `${offsetSign}${offsetHours}${offsetRemainder ? `:${pad(offsetRemainder)}` : ""}`;
      return `Reset ${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (${offset})`;
    }

    function UsagePanel({ usage, loading, error, onRefresh, onClose }) {
      const windows = usage?.windows ?? [];
      return React.createElement(
        "div",
        {
          className: "codex-usage-panel",
          role: "dialog",
          "aria-label": "Codex usage",
          style: {
            position: "absolute",
            left: 0,
            bottom: "calc(100% + 10px)",
            zIndex: 1000,
            boxSizing: "border-box",
            width: 176,
            maxWidth: "calc(100vw - 32px)",
            padding: "13px 14px 12px",
            border: `1px solid ${colors.strongBorder}`,
            borderRadius: 13,
            background: colors.surface,
            color: colors.primary,
            boxShadow: "0 14px 34px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.12)",
            pointerEvents: "auto",
            opacity: 1,
          },
        },
        React.createElement(
          "div",
          { className: "codex-usage-header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${colors.border}` } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 7 } },
            React.createElement("span", { style: { display: "inline-flex", color: colors.brand } }, React.createElement(Icon)),
            React.createElement("strong", { style: { fontSize: 14, fontWeight: 650 } }, "Codex usage"),
          ),
          React.createElement(
            "button",
            { type: "button", onClick: onClose, "aria-label": "Close Codex usage", style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 25, height: 25, padding: 0, border: 0, borderRadius: 7, background: "transparent", color: colors.secondary, cursor: "pointer", font: "inherit", fontSize: 20, lineHeight: 1 } },
            "×",
          ),
        ),
        usage?.planType
          ? React.createElement(
              "div",
              { className: "codex-usage-plan", style: { display: "flex", alignItems: "center", gap: 7, padding: "9px 0 8px", color: colors.secondary, fontSize: 12 } },
              React.createElement("span", null, "Plan"),
              React.createElement("span", { style: { padding: "3px 7px", borderRadius: 99, background: colors.nested, color: colors.primary, fontSize: 11, fontWeight: 600, textTransform: "capitalize" } }, usage.planType),
            )
          : null,
        error ? React.createElement("div", { style: { padding: "12px 0", color: colors.error, fontSize: 13, lineHeight: 1.4 } }, error) : null,
        !loading && !error && windows.length === 0
          ? React.createElement("div", { style: { padding: "12px 0", color: colors.secondary, fontSize: 13 } }, "No usage windows returned")
          : null,
        windows.map((item, index) => {
          const remaining = Math.round(item.remainingPercent);
          return React.createElement(
            "div",
            { key: `${item.label}-${index}`, className: `codex-usage-window${index === 0 ? " codex-usage-window-first" : ""}`, style: { padding: index === 0 ? "2px 0 10px" : "10px 0", borderTop: index === 0 ? 0 : `1px solid ${colors.border}` } },
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 7 } },
              React.createElement("span", { style: { fontSize: 13, fontWeight: 600 } }, item.label),
              React.createElement("span", { style: { color: colors.brand, fontSize: 13, fontWeight: 650 } }, `${remaining}% remaining`),
            ),
            React.createElement(
              "div",
              { role: "progressbar", "aria-label": `${item.label} remaining`, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": remaining, style: { height: 4, overflow: "hidden", marginBottom: 7, borderRadius: 99, background: colors.nested } },
              React.createElement("div", { style: { width: `${remaining}%`, height: "100%", borderRadius: 99, background: colors.brand } }),
            ),
            React.createElement("div", { style: { color: colors.secondary, fontSize: 11, lineHeight: 1.35 } }, formatReset(item.resetAt)),
          );
        }),
        React.createElement(
          "div",
          { className: "codex-usage-footer", style: { display: "flex", justifyContent: "flex-end", paddingTop: 9, borderTop: windows.length ? `1px solid ${colors.border}` : 0 } },
          React.createElement(
            "button",
            { type: "button", onClick: onRefresh, disabled: loading, style: { height: 28, padding: "0 11px", border: `1px solid ${colors.border}`, borderRadius: 7, background: colors.raised, color: colors.primary, cursor: loading ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 550, opacity: loading ? 0.65 : 1 } },
            loading ? "Loading…" : "Refresh",
          ),
        ),
      );
    }

    function providerOf(directory) {
      try {
        const provider = directory?.getSnapshot?.()?.current?.provider;
        return typeof provider === "string" ? provider : undefined;
      } catch (_) {
        return undefined;
      }
    }

    function UsageControl({ directory }) {
      const [provider, setProvider] = React.useState(() => providerOf(directory));
      const [open, setOpen] = React.useState(false);
      const [usage, setUsage] = React.useState(undefined);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(undefined);

      React.useEffect(() => {
        if (directory === undefined || typeof directory.subscribe !== "function") {
          setProvider(undefined);
          return undefined;
        }
        const update = () => setProvider(providerOf(directory));
        update();
        const stop = directory.subscribe(update);
        return typeof stop === "function" ? stop : undefined;
      }, [directory]);

      React.useEffect(() => {
        if (provider !== "codex") {
          setOpen(false);
          setUsage(undefined);
          setError(undefined);
        }
      }, [provider]);

      if (provider !== "codex") return null;

      const request = () => {
        setOpen(true);
        setLoading(true);
        setError(undefined);
        globalThis.fetch("/api/codex-usage", { headers: { accept: "application/json" } })
          .then((response) => response.json().then((result) => ({ response, result })))
          .then(({ response, result }) => {
            if (!response.ok && result?.status !== "ok") {
              throw new Error(result?.message ?? `Codex usage request failed (HTTP ${response.status})`);
            }
            if (result?.status === "ok") {
              setUsage(result);
              setError(undefined);
            } else {
              setUsage(result);
              setError(result?.message ?? "Codex usage unavailable");
            }
          })
          .catch((reason) => setError(reason?.message ?? "Codex usage unavailable"))
          .finally(() => setLoading(false));
      };

      return React.createElement(
        "div",
        { style: { position: "relative", display: "inline-flex", alignItems: "center" } },
        React.createElement(
          "button",
          { type: "button", onClick: open ? () => setOpen(false) : request, "aria-label": open ? "Codex usage open" : "Show Codex usage", "aria-expanded": open, title: "Show Codex usage", style: { display: "inline-flex", alignItems: "center", gap: 6, height: 29, padding: "0 9px", border: `1px solid ${colors.border}`, borderRadius: 8, background: open ? colors.nested : "transparent", color: open ? colors.primary : colors.secondary, cursor: "pointer", font: "inherit", fontSize: 12, lineHeight: 1, whiteSpace: "nowrap" } },
          React.createElement("span", { style: { display: "inline-flex", color: colors.brand } }, React.createElement(Icon, { size: 15 })),
          React.createElement("span", null, "Codex usage"),
        ),
        open ? React.createElement(UsagePanel, { usage, loading, error, onRefresh: request, onClose: () => setOpen(false) }) : null,
      );
    }

    function apply(ctx) {
      if (typeof document !== "undefined") {
        const tag = document.createElement("style");
        tag.dataset.plugin = "@yfzhou/dsh-codex-usage";
        tag.dataset.pluginCss = STYLE_ID;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        ctx.effect(() => () => tag.remove(), "codex-usage: styles");
      }
      ctx.inject(["slots", "modelDirectories"], (scope) => {
        const models = scope.modelDirectories;
        scope.slots.inject("conversation.input.left", () => scope.slots.register(
          {
            name: "conversation.input.left",
            id: "codex-usage",
            order: 20,
            label: "Codex usage",
            inject: (sessionId) => {
              if (models === undefined || typeof models.directoryFor !== "function" || sessionId === undefined) return { directory: undefined };
              return { directory: models.directoryFor(sessionId).store };
            },
          },
          UsageControl,
        ));
      });
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
