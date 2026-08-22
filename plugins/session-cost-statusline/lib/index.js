/**
 * Host projection for @yfzhou/dsh-session-cost-statusline.
 *
 * Model and usage accounting are durable session-log facts. Fold them here
 * rather than trying to recover a model from browser presentation nodes.
 */
import { z } from "zod";

const MILLION = 1e6;

const cnyPerMillion = (input, cacheRead, output) => ({
  input: input / MILLION,
  output: output / MILLION,
  cacheRead: cacheRead / MILLION,
  cacheWrite: 0,
});

// Models with fixed rates.
const FIXED_RATES = {
  "gpt-5.6-sol": { input: 5.0 / 0.15 / MILLION, output: 30.0 / 0.15 / MILLION, cacheRead: 0.5 / 0.15 / MILLION, cacheWrite: 6.25 / 0.15 / MILLION },
  "gpt-5.6-terra": { input: 2.0 / 0.15 / MILLION, output: 12.0 / 0.15 / MILLION, cacheRead: 0.2 / 0.15 / MILLION, cacheWrite: 2.5 / 0.15 / MILLION },
  "gpt-5.6-luna": { input: 0.2 / 0.15 / MILLION, output: 1.2 / 0.15 / MILLION, cacheRead: 0.02 / 0.15 / MILLION, cacheWrite: 0.25 / 0.15 / MILLION },
};

// DeepSeek V4 is always counted at the published off-peak/normal rate.
const DEEPSEEK_RATES = {
  "deepseek-v4-flash": cnyPerMillion(1.5, 0.05, 4.5),
  "deepseek-v4-flash-vision-exp": cnyPerMillion(1.5, 0.05, 4.5),
  "deepseek-v4-pro": cnyPerMillion(4.5, 0.15, 13.5),
};

// The projection schema describes the VIEW output (what clients read and what
// restore/checkpoint validate), mirroring dsh-session-stats. Internal fold
// state (model) deliberately stays out of the schema.
const viewSchema = z.object({
  currency: z.string(),
  totalCny: z.number().nonnegative(),
  pricedMessages: z.number().int().nonnegative(),
  unpricedMessages: z.number().int().nonnegative(),
}).strict();

const stateSchema = z.object({
  activeModel: z.string().nullable(),
  openStep: z.object({
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
    model: z.string().nullable(),
  }).nullable(),
  totalCny: z.number().nonnegative(),
  pricedMessages: z.number().int().nonnegative(),
  unpricedMessages: z.number().int().nonnegative(),
}).strict();

const nonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

// DeepSeek model ids can carry a provider/deployment build tag. In particular
// the Ark (ByteDance) deployment id is "deepseek-v4-flash-ga-260731" — the
// same DeepSeek V4 Flash model, with a "-ga-<build>" suffix. Normalize any
// such tag away so every build of a DeepSeek V4 family resolves to the
// published pricing for that family. Non-DeepSeek ids are returned unchanged.
function deepseekFamilyKey(model) {
  return model.replace(/-ga-\d+$/, "");
}

function rateFor(model) {
  const fixed = FIXED_RATES[model];
  if (fixed !== undefined) return fixed;
  return DEEPSEEK_RATES[deepseekFamilyKey(model)];
}

const projection = {
  key: "sessionCost",
  stateSchema,
  wire: {
    viewSchema,
    view: (state) => ({
      currency: "CNY",
      totalCny: state.totalCny,
      pricedMessages: state.pricedMessages,
      unpricedMessages: state.unpricedMessages,
    }),
  },
  init: () => ({
    activeModel: null,
    openStep: null,
    totalCny: 0,
    pricedMessages: 0,
    unpricedMessages: 0,
  }),
  apply: (state, event) => {
    if (event.type === "step/start") {
      return {
        ...state,
        openStep: {
          turn: event.data.turn,
          step: event.data.step,
          model: state.activeModel,
        },
      };
    }

    if (event.type === "request/header") {
      const model = event.data?.header?.config?.model;
      if (typeof model !== "string" || model.length === 0) return state;
      const openStep = state.openStep === null
        ? null
        : { ...state.openStep, model };
      return { ...state, activeModel: model, openStep };
    }

    if (event.type === "step/end" || event.type === "turn/end") {
      return state.openStep === null ? state : { ...state, openStep: null };
    }

    if (event.type !== "assistant/message") return state;

    const usage = event.data.usage;
    const openStep = state.openStep;
    const matchesOpenStep = openStep !== null &&
      openStep.turn === event.data.turn && openStep.step === event.data.step;

    // A step has one assembled assistant message. Closing the matching step
    // prevents a defensive duplicate message from being billed twice.
    if (!matchesOpenStep) {
      return usage === undefined
        ? state
        : { ...state, unpricedMessages: state.unpricedMessages + 1 };
    }

    const next = { ...state, openStep: null };
    if (usage === undefined || usage === null || typeof usage !== "object") {
      return usage === undefined
        ? next
        : { ...next, unpricedMessages: next.unpricedMessages + 1 };
    }

    const rate = rateFor(openStep.model);
    if (rate === undefined) {
      return { ...next, unpricedMessages: next.unpricedMessages + 1 };
    }

    // DSH TokenUsage is DISJOINT: inputTokens is uncached input only; cached
    // input is reported separately as cacheReadTokens/cacheWriteTokens. Billed
    // input = sum of the three. reasoningTokens is a subset of outputTokens.
    const input = nonnegative(usage.inputTokens ?? usage.uncachedInputTokens);
    const cost =
      input * rate.input +
      nonnegative(usage.outputTokens) * rate.output +
      nonnegative(usage.cacheReadTokens) * rate.cacheRead +
      nonnegative(usage.cacheWriteTokens) * rate.cacheWrite;
    if (!Number.isFinite(cost) || !Number.isFinite(next.totalCny + cost)) {
      return { ...next, unpricedMessages: next.unpricedMessages + 1 };
    }

    return {
      ...next,
      totalCny: next.totalCny + cost,
      pricedMessages: next.pricedMessages + 1,
    };
  },
  // Model identity is pinned to each step so usage is priced consistently.
  // New sessions always use static off-peak/normal DeepSeek rates.
  stateVersion: 6,
};

const name = "session-cost-statusline";
const inject = ["sessionProjections"];

function apply(ctx) {
  ctx.sessionProjections.register(projection);
}

export { apply, inject, name, projection };
