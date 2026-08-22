/**
 * Host projection for @yfzhou/dsh-session-cost-statusline.
 *
 * Model, request timing, and usage accounting are durable session-log facts.
 * Fold them here rather than trying to recover a model from browser
 * presentation nodes. DeepSeek V4 pricing is selected using the request's
 * persisted start/header time in Beijing time.
 */
import { z } from "zod";

const MILLION = 1e6;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const cnyPerMillion = (input, cacheRead, output) => ({
  input: input / MILLION,
  output: output / MILLION,
  cacheRead: cacheRead / MILLION,
  cacheWrite: 0,
});

// Models whose prices do not vary by time of day.
const FIXED_RATES = {
  "gpt-5.6-sol": { input: 5.0 / 0.15 / MILLION, output: 30.0 / 0.15 / MILLION, cacheRead: 0.5 / 0.15 / MILLION, cacheWrite: 6.25 / 0.15 / MILLION },
  "gpt-5.6-terra": { input: 2.0 / 0.15 / MILLION, output: 12.0 / 0.15 / MILLION, cacheRead: 0.2 / 0.15 / MILLION, cacheWrite: 2.5 / 0.15 / MILLION },
  "gpt-5.6-luna": { input: 0.2 / 0.15 / MILLION, output: 1.2 / 0.15 / MILLION, cacheRead: 0.02 / 0.15 / MILLION, cacheWrite: 0.25 / 0.15 / MILLION },
};

// DeepSeek V4 uses the published time-of-day schedule: peak hours are
// 09:00–12:00 and 14:00–18:00 Beijing, all other hours off-peak. There is no
// legacy fixed-rate bucket anymore — every request is peak or off-peak.
const DEEPSEEK_RATES = {
  "deepseek-v4-flash": {
    offPeak: cnyPerMillion(1.5, 0.05, 4.5),
    peak: cnyPerMillion(3.0, 0.10, 9.0),
  },
  "deepseek-v4-flash-vision-exp": {
    offPeak: cnyPerMillion(1.5, 0.05, 4.5),
    peak: cnyPerMillion(3.0, 0.10, 9.0),
  },
  "deepseek-v4-pro": {
    offPeak: cnyPerMillion(4.5, 0.15, 13.5),
    peak: cnyPerMillion(9.0, 0.30, 27.0),
  },
};

// The projection schema describes the VIEW output (what clients read and what
// restore/checkpoint validate), mirroring dsh-session-stats. Internal fold
// state (model and request timing) deliberately stays out of the schema.
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
    startTime: z.number().nonnegative(),
    requestTime: z.number().nonnegative().nullable(),
  }).nullable(),
  totalCny: z.number().nonnegative(),
  pricedMessages: z.number().int().nonnegative(),
  unpricedMessages: z.number().int().nonnegative(),
}).strict();

const nonnegative = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

const validTimestamp = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function isPeakBeijing(timestamp) {
  if (!validTimestamp(timestamp)) return false;
  const dayTime = ((timestamp + BEIJING_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
  const minute = Math.floor(dayTime / 60000);
  return (minute >= 9 * 60 && minute < 12 * 60) ||
    (minute >= 14 * 60 && minute < 18 * 60);
}

// DeepSeek model ids can carry a provider/deployment build tag. In particular
// the Ark (ByteDance) deployment id is "deepseek-v4-flash-ga-260731" — the
// same DeepSeek V4 Flash model, with a "-ga-<build>" suffix. Normalize any
// such tag away so every build of a DeepSeek V4 family resolves to the
// published pricing for that family. Non-DeepSeek ids are returned unchanged.
function deepseekFamilyKey(model) {
  return model.replace(/-ga-\d+$/, "");
}

function rateFor(model, timestamp) {
  const fixed = FIXED_RATES[model];
  if (fixed !== undefined) return fixed;

  const schedule = DEEPSEEK_RATES[deepseekFamilyKey(model)];
  if (schedule === undefined || !validTimestamp(timestamp)) return undefined;
  return isPeakBeijing(timestamp) ? schedule.peak : schedule.offPeak;
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
          startTime: event.time,
          requestTime: null,
        },
      };
    }

    if (event.type === "request/header") {
      const model = event.data?.header?.config?.model;
      if (typeof model !== "string" || model.length === 0) return state;
      // request/header is appended inside the step, before dispatch. It is a
      // better billing-time estimate than completion time; if a provider keeps
      // the same header across steps, step/start supplies the per-request time.
      const openStep = state.openStep === null
        ? null
        : { ...state.openStep, model, requestTime: event.time };
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

    const timestamp = openStep.requestTime ?? openStep.startTime;
    const rate = rateFor(openStep.model, timestamp);
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
  // v3 pins the model to each step. This keeps replay correct when another
  // request changes the session header before an earlier message is assembled.
  // Old checkpoints are discarded and replayed by the projection cache.
  // v4 normalizes DeepSeek GA build tags (e.g. ark "deepseek-v4-flash-ga-260731")
  // to their published family pricing; bumping forces cached checkpoints that
  // were priced with the unknown-model path (totalCny 0) to replay.
  // v5 drops the pre-2026-08-17 legacy fixed-rate bucket: every DeepSeek request
  // is now peak or off-peak. Bumping forces checkpoints that were folded with
  // the legacy path to re-fold with peak/off-peak only.
  stateVersion: 5,
};

const name = "session-cost-statusline";
const inject = ["sessionProjections"];

function apply(ctx) {
  ctx.sessionProjections.register(projection);
}

export { apply, inject, name, projection };
