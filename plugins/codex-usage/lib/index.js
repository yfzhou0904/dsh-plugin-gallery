const name = "codex-usage";
const inject = ["settings", "subprocess", "timer", "webServer"];

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

async function readUsage(settings, subprocess, timer) {
  if (subprocess === undefined || timer === undefined) {
    return { status: "error", message: "Codex usage services unavailable" };
  }
  try {
    const node = await subprocess.resolveExecutable("node");
    const authFile = authFileFrom(settings);
    const proxy = proxyFrom(settings);
    const script = `import { readFile } from 'node:fs/promises';
 import os from 'node:os';
 import path from 'node:path';
 const authFile = ${JSON.stringify(authFile)} ?? path.join(process.env[${JSON.stringify(CODEX_HOME_ENV)}] ?? path.join(os.homedir(), '.codex'), ${JSON.stringify(AUTH_FILE_NAME)});
 const auth = JSON.parse(await readFile(authFile, 'utf8'));
 const token = auth?.tokens?.access_token;
 const accountId = auth?.tokens?.account_id;
 if (typeof token !== 'string' || token.length === 0) throw new Error('missing access token');
 const targetUrl = ${JSON.stringify(USAGE_URL)};
 const proxyUrl = ${JSON.stringify(proxy)} ?? process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
 const noProxy = process.env.NO_PROXY ?? process.env.no_proxy ?? '';
 const target = new URL(targetUrl);
 const hostname = target.hostname.toLowerCase();
 const bypassProxy = noProxy.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean).some((item) => item === '*' || item === hostname || (item.startsWith('*') && hostname.endsWith(item.slice(1))) || (item.startsWith('.') && hostname.endsWith(item)));
 const requestInit = { headers: { authorization: 'Bearer ' + token, accept: 'application/json', ...(accountId ? { 'chatgpt-account-id': accountId } : {}) } };
 let response;
 if (proxyUrl && !bypassProxy) {
   const proxyMod = await import('https-proxy-agent');
   const HttpsProxyAgent = proxyMod.HttpsProxyAgent ?? proxyMod.default?.HttpsProxyAgent;
   const { default: nodeFetch } = await import('node-fetch');
   if (typeof HttpsProxyAgent !== 'function' || typeof nodeFetch !== 'function') throw new Error('proxy transport dependencies unavailable');
   response = await nodeFetch(targetUrl, { ...requestInit, agent: new HttpsProxyAgent(proxyUrl) });
 } else {
   response = await fetch(targetUrl, requestInit);
 }
 process.stdout.write(JSON.stringify({ status: response.status, body: await response.text() }));`;
    const child = subprocess.spawn({
      argv: [node, "--input-type=module", "--eval", script],
      cwd: process.cwd(),
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes: 1024 * 1024 },
        stderr: { maxBytes: 64 * 1024 },
      },
      graceMs: 3000,
    });
    const cancelStop = timer.timeout(() => child.terminate(), 30000);
    const result = await child.done;
    cancelStop();
    const output = child.collected.stdout?.readFrom(0).text ?? "";
    const stderr = child.collected.stderr?.readFrom(0).text.trim() ?? "";
    if (result.exitCode !== 0) {
      return {
        status: "error",
        message: `Codex usage request failed (subprocess exit ${String(result.exitCode)}, signal ${String(result.signal)})${stderr ? `: ${stderr.slice(-500)}` : ""}`,
      };
    }
    let envelope;
    try {
      envelope = JSON.parse(output);
    } catch (error) {
      return { status: "error", message: `Codex usage envelope was not JSON (${error?.message ?? "parse error"})` };
    }
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
  const subprocess = ctx.subprocess;
  const timer = ctx.timer;
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
      const result = await readUsage(settings, subprocess, timer);
      res.writeHead(result.status === "ok" ? 200 : 502, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(result));
    },
  }), "codex usage route");
}

export { apply, inject, name };
