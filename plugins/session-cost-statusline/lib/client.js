// Browser client bundle for @yfzhou/dsh-session-cost-statusline.
// Served as a prebuilt module via window.__ModuleLoader__.load (CJS factory
// form). The host owns all pricing and exposes the replayable sessionCost
// projection; this bundle only renders it.
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-session-cost-statusline",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");

    // Cost is computed by the durable host `sessionCost` projection. The
    // browser only renders that replayable, per-model accounting result.

    const EN = {
      "stats.counts": (p) => `${p.turns} turns · ${p.steps} steps`,
      "stats.llm": (p) => `LLM ${p.duration}`,
      "stats.toolCall": (p) => `Tool call ${p.duration}`,
      "stats.ttftAverage": (p) => `TTFT avg ${p.duration}`,
      "stats.tokensPerSecond": (p) => `${p.throughput} tok/s`,
      "stats.cacheHit": (p) => `Cache hit ${p.percent}%`,
      "stats.tokens": (p) => `Input ${p.input} tok · Output ${p.output} tok`,
    };

    const billedInputTokens = (u) => u.uncachedInputTokens + u.cacheReadTokens + u.cacheWriteTokens;
    const cacheHitPercent = (u) => {
      const d = billedInputTokens(u);
      return d === 0 ? null : Math.round((u.cacheReadTokens / d) * 100);
    };
    const formatTokens = (n) => {
      const scaled = (v) => (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
      if (n < 1e3) return String(n);
      if (n < 1e6) return `${scaled(n / 1e3)}K`;
      return `${scaled(n / 1e6)}M`;
    };
    const formatDuration = (ms) => {
      const s = ms / 1e3;
      if (s < 60) return `${Math.round(s * 10) / 10}s`;
      const whole = Math.round(s);
      return `${Math.floor(whole / 60)}m${whole % 60}s`;
    };
    const formatTps = (tps) => {
      const c = Math.max(0, tps);
      return c >= 10 ? String(Math.round(c)) : String(Math.round(c * 10) / 10);
    };

    const rootStyle = {
      textAlign: "center",
      maxWidth: "var(--dsh-chat-content-width)",
      boxSizing: "border-box",
      width: "100%",
      padding: "4px calc(var(--dsh-composer-side-clearance) + 16px) 0",
      color: "var(--dsw-alias-label-tertiary)",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      margin: "0 auto",
      fontSize: 12,
      lineHeight: "20px",
      display: "block",
      overflow: "hidden",
    };
    const sepStyle = { color: "var(--dsw-alias-separator-primary)", margin: "0 10px" };

    const name = "session-cost-statusline";
    const inject = ["slots"];

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;
      slots.inject("conversation.composer.dock", () =>
        slots.register(
          { name: "conversation.composer.dock", id: "stats", priority: -1, order: 0, locale: "conversation" },
          (props) => {
            const useProjection = props.useProjection;
            const t = typeof props.t === "function" ? props.t : null;
            const label = (key, params) => (t ? t(key, params) : EN[key] ? EN[key](params) : "");
            const usage = useProjection("tokenUsage");
            const projected = useProjection("sessionStats");
            const cost = useProjection("sessionCost");
            const groups = [];
            if (cost !== undefined && cost.totalCny > 0) {
              const total = cost.totalCny;
              const amt = total >= 1 ? total.toFixed(2) : total >= 0.01 ? total.toFixed(3) : total.toFixed(4);
              groups.push(React.createElement("span", { key: "cost", style: { fontWeight: 500 } }, "¥" + amt));
            }

             if (projected && projected.steps > 0) {
              groups.push(label("stats.counts", { turns: projected.turns, steps: projected.steps }));
              const durations = [];
              if (projected.llmMs > 0) durations.push(label("stats.llm", { duration: formatDuration(projected.llmMs) }));
              if (projected.toolMs > 0) durations.push(label("stats.toolCall", { duration: formatDuration(projected.toolMs) }));
              if (durations.length) groups.push(durations.join(" · "));
              const speeds = [];
              if (projected.ttftSteps > 0)
                speeds.push(label("stats.ttftAverage", { duration: formatDuration(projected.ttftMs / projected.ttftSteps) }));
              if (projected.decodeMs > 0)
                speeds.push(label("stats.tokensPerSecond", { throughput: formatTps(projected.decodeTokens / (projected.decodeMs / 1e3)) }));
              if (speeds.length) groups.push(speeds.join(" · "));
            }

            if (usage !== undefined && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
              const hit = cacheHitPercent(usage);
              if (hit !== null) groups.push(label("stats.cacheHit", { percent: hit }));
              groups.push(label("stats.tokens", { input: formatTokens(billedInputTokens(usage)), output: formatTokens(usage.outputTokens) }));
            }

            if (groups.length === 0) return null;
            const children = groups.map((g, i) =>
              React.createElement(React.Fragment, { key: i }, i > 0 && React.createElement("span", { style: sepStyle }, "|"), " ", g)
            );
            return React.createElement("div", { style: rootStyle }, children);
          }
        )
      );
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
