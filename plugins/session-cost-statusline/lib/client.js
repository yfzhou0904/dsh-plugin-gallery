// Browser client bundle for @yfzhou/dsh-session-cost-statusline.
// Served as a prebuilt module via window.__ModuleLoader__.load (CJS factory
// form). This is client-only: it renders the status line and carries the CNY
// rate table embedded (the persistent client module system has no
// host.call/harness RPC bridge, unlike dynamic plugins).
window.__ModuleLoader__.load({
  id: "@yfzhou/dsh-session-cost-statusline",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");

    // ── CNY-per-token rates ────────────────────────────────────────────────
    // Rates are expressed directly in CNY per million tokens. These are fixed
    // midpoint estimates between DeepSeek's peak and off-peak rates; pricing
    // changes over time, so see the package README before treating them as authoritative.
    // Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
    const RATES = {
      "deepseek-v4-flash": {
        input: 2.25 / 1e6,
        output: 6.75 / 1e6,
        cacheRead: 0.08 / 1e6,
        cacheWrite: 0,
      },
      "deepseek-v4-pro": {
        input: 6.75 / 1e6,
        output: 20.25 / 1e6,
        cacheRead: 0.23 / 1e6,
        cacheWrite: 0,
      },
      "gpt-5.6-sol": {
        input: 5.0 / 0.15 / 1e6,
        output: 30.0 / 0.15 / 1e6,
        cacheRead: 0.5 / 0.15 / 1e6,
        cacheWrite: 6.25 / 0.15 / 1e6,
      },
      "gpt-5.6-terra": {
        input: 2.0 / 0.15 / 1e6,
        output: 12.0 / 0.15 / 1e6,
        cacheRead: 0.2 / 0.15 / 1e6,
        cacheWrite: 2.5 / 0.15 / 1e6,
      },
      "gpt-5.6-luna": {
        input: 0.2 / 0.15 / 1e6,
        output: 1.2 / 0.15 / 1e6,
        cacheRead: 0.02 / 0.15 / 1e6,
        cacheWrite: 0.25 / 0.15 / 1e6,
      },
    };
    // Resolve the rate-relevant model for a session: the most recent assistant
    // message reports the model that produced it (`provenance.model`), which is
    // the best available signal for which rate row to bill the cumulative
    // token usage against. Unknown or unavailable models are intentionally not
    // priced rather than being assigned an unrelated fallback rate.
    const activeModel = (nodes) => {
      if (!Array.isArray(nodes)) return undefined;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n && n.provenance && typeof n.provenance.model === "string" && n.provenance.model.length > 0) {
          return n.provenance.model;
        }
      }
      return undefined;
    };

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
            const useSession = props.useSession;
            const t = typeof props.t === "function" ? props.t : null;
            const label = (key, params) => (t ? t(key, params) : EN[key] ? EN[key](params) : "");
            const usage = useProjection("tokenUsage");
            const projected = useProjection("sessionStats");
            const nodes = useSession((s) =>
              s && s.chat && s.chat.legacy ? s.chat.legacy.nodes : undefined
            );
            const groups = [];
             // Cost FIRST in the line, priced at the session's actual model.
             const model = activeModel(nodes);
             const rate = model ? RATES[model] : undefined;
             if (usage !== undefined && rate) {
               const total =
                 (usage.uncachedInputTokens || 0) * rate.input +
                 (usage.outputTokens || 0) * rate.output +
                 (usage.cacheReadTokens || 0) * rate.cacheRead +
                 (usage.cacheWriteTokens || 0) * rate.cacheWrite;
               if (total > 0) {
                 const amt = total >= 1 ? total.toFixed(2) : total >= 0.01 ? total.toFixed(3) : total.toFixed(4);
                 groups.push(React.createElement("span", { key: "cost", style: { fontWeight: 500 } }, "¥" + amt));
               }
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
