import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTransport } from "@yfzhou/dsh-llm-codex-subscription/transport";

const name = "codex-usage";
const inject = ["settings", "webServer"];

const SETTINGS_NS = "llm-codex-subscription";
const CODEX_HOME_ENV = "CODEX_HOME";
const AUTH_FILE_NAME = "auth.json";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

function configFrom(settings) {
  const config = settings?.get(SETTINGS_NS);
  return config !== null && typeof config === "object" ? config : undefined;
}

function authFileFrom(settings) {
  const config = configFrom(settings);
  if (config?.account && config?.accounts?.[config.account]) return config.accounts[config.account];
  if (typeof config?.authFile === "string" && config.authFile.length > 0) return config.authFile;
  return undefined;
}

function proxyFrom(settings) {
  const proxy = configFrom(settings)?.proxy;
  return typeof proxy === "string" && proxy.trim().length > 0 ? proxy.trim() : undefined;
}

async function fetchUsage(settings, authFile) {
  const auth = JSON.parse(await readFile(authFile, "utf8"));
  const token = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  if (typeof token !== "string" || token.length === 0) throw new Error("missing access token");
  const transport = await createTransport({ proxy: proxyFrom(settings) });
  const response = await transport.fetch(USAGE_URL, {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/json",
      ...(accountId ? { "chatgpt-account-id": accountId } : {}),
    },
  });
  return { status: response.status, body: await response.text() };
}

function windowOf(value, fallbackLabel) {
  if (value === null || typeof value !== "object") return undefined;
  const used = typeof value.used_percent === "number"
    ? Math.max(0, Math.min(100, value.used_percent))
    : undefined;
  if (used === undefined) return undefined;
  const seconds = typeof value.limit_window_seconds === "number"
    ? value.limit_window_seconds
    : undefined;
  const label = seconds === 18000 ? "5h" : seconds === 604800 ? "7d" : fallbackLabel;
  const resetAt = typeof value.reset_at === "number" ? value.reset_at : undefined;
  return {
    label,
    usedPercent: used,
    remainingPercent: 100 - used,
    ...(seconds === undefined ? {} : { windowSeconds: seconds }),
    ...(resetAt === undefined ? {} : { resetAt }),
  };
}

function parseUsage(value) {
  if (value === null || typeof value !== "object") {
    return { status: "error", message: "Unrecognized Codex usage response" };
  }
  const rateLimit = value.rate_limit;
  if (rateLimit === null || typeof rateLimit !== "object") {
    return { status: "error", message: "Codex usage response has no rate limit" };
  }
  const windows = [
    windowOf(rateLimit.primary_window, "primary"),
    windowOf(rateLimit.secondary_window, "secondary"),
  ].filter(Boolean);
  if (windows.length === 0) {
    return { status: "error", message: "No Codex usage windows were returned" };
  }
  return {
    status: "ok",
    windows,
    ...(typeof value.plan_type === "string" ? { planType: value.plan_type } : {}),
    fetchedAt: Date.now(),
  };
}

async function readUsage(settings) {
  try {
    const authFile = authFileFrom(settings) ?? path.join(process.env[CODEX_HOME_ENV] ?? path.join(os.homedir(), ".codex"), AUTH_FILE_NAME);
    const envelope = await fetchUsage(settings, authFile);
    if (envelope.status < 200 || envelope.status >= 300) {
      return { status: "error", message: `Codex usage request failed (HTTP ${envelope.status})` };
    }
    let payload;
    try {
      payload = JSON.parse(envelope.body);
    } catch (error) {
      return { status: "error", message: `Codex usage body was not JSON (${error?.message ?? "parse error"})` };
    }
    return parseUsage(payload);
  } catch (error) {
    return { status: "error", message: error?.message ?? "Codex usage request failed" };
  }
}

function apply(ctx) {
  const settings = ctx.settings;
  const webServer = ctx.webServer;
  ctx.effect(() => webServer.register({
    kind: "exact",
    path: "/api/codex-usage",
    handler: async (req, res) => {
      if (req.method !== "GET") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "error", message: "Method not allowed" }));
        return;
      }
      const result = await readUsage(settings);
      res.writeHead(result.status === "ok" ? 200 : 502, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(result));
    },
  }), "codex usage route");
}

export { apply, inject, name };
