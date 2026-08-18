import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const pluginsDir = join(root, "plugins");
const presetsDir = join(root, "presets");
const dirs = (await readdir(pluginsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const forbidden = ["@deepseek-ai/dsh-mobile-sidebar", "@deepseek-ai/dsh-full-width-chat", "@deepseek-ai/dsh-session-cost-statusline", "@deepseek-ai/dsh-codex-moot-escalation", "/Users/", "/home/", "/root/"];

for (const dir of dirs) {
  const base = join(pluginsDir, dir);
  const packagePath = join(base, "package.json");
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  if (pkg.private) throw new Error(`${pkg.name}: package is private`);
  if (!pkg.name.startsWith("@yfzhou/dsh-")) throw new Error(`${pkg.name}: unexpected package scope or prefix`);
  if (pkg.publishConfig?.access !== "public") throw new Error(`${pkg.name}: publishConfig.access must be public`);
  for (const required of ["README.md", "LICENSE", "lib/index.js"]) await access(join(base, required));
  execFileSync(process.execPath, ["--check", join(base, "lib/index.js")], { stdio: "inherit" });
  if (pkg.dsh?.client) {
    await access(join(base, "lib/client.js"));
    execFileSync(process.execPath, ["--check", join(base, "lib/client.js")], { stdio: "inherit" });
  }
  const files = ["package.json", "README.md", "lib/index.js"];
  if (pkg.dsh?.client) files.push("lib/client.js");
  if (pkg.dsh?.bundle?.patch) {
    if (typeof pkg.dsh.bundle.patch !== "string") throw new Error(`${pkg.name}: dsh.bundle.patch must be a string`);
    await access(join(base, pkg.dsh.bundle.patch));
    files.push(pkg.dsh.bundle.patch);
  }
  for (const file of files) {
    const text = await readFile(join(base, file), "utf8");
    for (const value of forbidden) {
      if (text.includes(value)) throw new Error(`${pkg.name}: forbidden public string ${value} in ${file}`);
    }
  }
  console.log(`ok ${pkg.name}`);
}

const presetDirs = (await readdir(presetsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const presetForbidden = ["/Users/", "/home/", "/root/", "BEGIN OPENSSH PRIVATE KEY", "api_key", "access_token"];
for (const dir of presetDirs) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(dir)) throw new Error(`invalid preset id: ${dir}`);
  const base = join(presetsDir, dir);
  await access(join(base, "agent.cordis.yml"));
  const composition = await readFile(join(base, "agent.cordis.yml"), "utf8");
  if (!/^\s*-\s+id:/m.test(composition)) throw new Error(`${dir}: agent.cordis.yml must contain composition rows`);
  const metadataPath = join(base, "preset.yml");
  try { await access(metadataPath); } catch { /* metadata is optional */ }
  const files = await readdir(base, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;
    const text = await readFile(join(base, file.name), "utf8");
    for (const value of presetForbidden) {
      if (text.toLowerCase().includes(value.toLowerCase())) throw new Error(`${dir}: forbidden private string ${value} in ${file.name}`);
    }
  }
  console.log(`ok preset ${dir}`);
}
