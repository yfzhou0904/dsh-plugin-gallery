# `@yfzhou/dsh-llm-codex-subscription`

> 📦 npm:[@yfzhou/dsh-llm-codex-subscription](https://www.npmjs.com/package/@yfzhou%2Fdsh-llm-codex-subscription)
> · 📚 GitHub:[yfzhou0904/dsh-plugin-gallery](https://github.com/yfzhou0904/dsh-plugin-gallery/tree/main/plugins/codex-subscription)
> · 🏷️ 属于 [dsh-plugin](https://github.com/topics/dsh-plugin) 插件话题

DSH(DeepSeek Harness)LLM 适配器插件:**直接复用 Codex CLI 的本地登录凭证**,在 DSH 中
使用 ChatGPT 订阅模型(gpt-5.6-sol 等),不需要 API Key。

这是一个标准的 **dsh 插件包**:包内 `dsh.bundle.patch` 声明使其成为 profile 层,
通过官方 `dsh plugin` 命令安装后**自动激活**,无需手工编辑任何 composition 文件。

## 原理

Codex CLI(`codex login`)会把 ChatGPT 订阅的 OAuth 令牌写入 `~/.codex/auth.json`(或
`CODEX_HOME`)。本插件与 codex CLI **同源读取该文件**,并参照两个成熟实现
(参考实现:你的 [oh-my-pi-cn](https://github.com/yequ172672/oh-my-pi-cn) 与
[opencodex](https://www.npmjs.com/package/@bitkyc08/opencodex))的 wire 细节:

| 凭证形态 | 端点 | 认证 |
| --- | --- | --- |
| `tokens`(auth_mode: chatgpt,订阅) | `https://chatgpt.com/backend-api/codex/responses` | `Authorization: Bearer <access_token>` + `chatgpt-account-id` + `OpenAI-Beta: responses=experimental` + `originator: pi` + `version` |
| `OPENAI_API_KEY`(auth_mode: apikey) | `https://api.openai.com/v1/responses` | `Authorization: Bearer <api_key>` |

- **凭证热跟随**:每次请求都重新读 `auth.json`,CLI 登录/换号/登出,DSH 下一次请求自动生效。
- **令牌刷新**:access_token 过期(HTTP 401)时用 `refresh_token` 走
  `auth.openai.com/oauth/token` 刷新并自动重试一次;刷新成功后默认**原子写回**
  auth.json(`writeBack: false` 可关闭),与 codex CLI 行为一致,两边凭证永远同步。
- **模型目录**:优先实时拉取 `GET {base}/codex/models`,失败时回退
  `~/.codex/models_cache.json`,再回退内置静态列表。
- **协议**:OpenAI Responses API(`stream: true` SSE),推理摘要、正文、工具调用分别映射为
  DSH 的 reasoning / text / tool-call 块,usage 从 `response.completed` 提取。

## 目录结构

```
lib/
  index.js      插件入口(注册 provider "codex" + 可配置 provider 目录 + 设置段)
  adapter.js    CodexAdapter:fetch + SSE → StreamChunk(仿 dsh-llm-deepseek)
  auth.js       auth.json 读取 / 订阅令牌刷新 / 原子写回
  serialize.js  harness 消息 → Responses API 请求体
  translate.js  Responses SSE 事件 → StreamChunk
  sse.js        SSE 字节流解析(Responses 协议无 [DONE])
  models.js     模型目录:实时发现 → models_cache.json → 静态兜底
  transport.js  可选 HTTP CONNECT 代理(https-proxy-agent + node-fetch)
  constants.js  wire 常量(端点/头/上下文窗口)
cordis.bundle.yml  dsh.bundle 声明的 profile 层(插件行;安装后自动挂载)
test/smoke.mjs  端到端冒烟测试(只读,绝不写 auth.json)
```

## 安装(dsh 官方插件命令)

本机已安装 pnpm(`dsh plugin` 会转发给它)。安装已发布的包:

```powershell
dsh plugin --profile web add @yfzhou/dsh-llm-codex-subscription
```

本地开发直接加路径(pnpm 会以 `link:` 链接,改动即时生效):

```powershell
dsh plugin --profile web add D:\CODE\dsh\dsh-llm-codex
```

`dsh plugin` 做了什么:在 profile 目录里执行 `pnpm add <spec>`,然后把安装结果与
`dsh.profile.bundles` 层栈**自动 reconcile** —— 任何声明了 `dsh.bundle.patch` 的依赖
自动成为 profile 层,`update` 时新版本获得 bundle 声明也会自动激活,`remove` 后自动
移除。**无需手工编辑 cordis.patch.yml。**

验证组合结果(不启动服务):

```powershell
dsh --profile web --dump-config   # 应看到 "# == @yfzhou/dsh-llm-codex-subscription" 与 llm-codex 行
```

重启 dsh 后,Web 模型选择器出现 **Codex (ChatGPT 订阅)** provider,插件清单页
(设置 → 插件)也会列出 `llm-codex-subscription` 条目。

## 机器相关配置(settings.yaml,不进包)

ChatGPT 后端通常需要走本地代理;Node 原生 fetch 不读系统代理,在
`$DSH_HOME/settings.yaml` 配置:

```yaml
llm-codex-subscription:
  proxy: http://127.0.0.1:7890
  account: personal
  accounts:
    personal: ~/.codex-personal/auth.json
    work: ~/.codex-work/auth.json
```

也可用环境变量 `HTTPS_PROXY`(优先级:显式 `proxy` 配置 > `HTTPS_PROXY` >
`HTTP_PROXY`;`NO_PROXY` 命中的主机直连)。其他可选字段:`clientVersion`(默认
`0.144.1`)、`writeBack`(默认 `true`)、`authFile`、`modelsCacheFile`、
`staticModels`(显式模型目录)。设置段热更新,无需重启。

### 多账户切换

可以为每个 ChatGPT/Codex 账户保存一份独立的 `auth.json`，然后通过 `account` 选择当前账户：

```yaml
llm-codex-subscription:
  account: personal
  accounts:
    personal: ~/.codex-personal/auth.json
    work: ~/.codex-work/auth.json
```

每次请求都会读取所选文件；切换 `account` 后新的请求使用新账户，不需要复制回
`~/.codex/auth.json`。令牌刷新只会写回当前选中的文件。若未配置 `accounts`，仍兼容原来的
`authFile` 或默认 `~/.codex/auth.json`。

注意：这里的 `account` 是配置别名，不是 OpenAI 的 `account_id`；后者仍从所选 auth.json
的 `tokens.account_id` 读取。

选用 codex 作为默认模型(settings.yaml):

```yaml
agent-default-model:
  provider: codex
  model: gpt-5.6-sol
  reasoningEffort: medium
```

## 发布到 npm(dsh 插件库)

dsh 的"插件库"即 npm registry:`dsh.bundle.patch` 声明就是插件身份。

```powershell
npm login
npm publish            # 仓库目录内执行
# 任何机器上:
dsh plugin --profile web add @yfzhou/dsh-llm-codex-subscription
dsh plugin --profile web update          # 升级所有 profile 插件
dsh plugin --profile web remove @yfzhou/dsh-llm-codex-subscription   # 移除
```

发布前检查:`files` 字段含 `lib` 与 `cordis.bundle.yml`;`dsh.bundle.patch` 指向的
patch 文件只含插件行,不含任何机器相关的配置。

## 冒烟测试(真实凭证,只读)

```powershell
node test\smoke.mjs                  # 文本对话(默认模型 gpt-5.6-sol)
node test\smoke.mjs gpt-5.5          # 指定模型
node test\smoke.mjs gpt-5.6-sol --tools   # 额外验证工具调用路径
```

输出凭证形态、模型目录(实时拉取)、一次真实流式对话的结果与 usage。
测试默认只读(`writeBack: false`),绝不改写 auth.json;需要走代理时设置
`HTTPS_PROXY`(如 `http://127.0.0.1:7890`)。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| `MISSING_CREDENTIAL:无法读取 Codex 凭证文件` | 先运行 `codex login` 登录 |
| `TRANSPORT:Connect Timeout` | 本机直连 ChatGPT 后端被墙;配置 `proxy`(见上文) |
| HTTP 401 且刷新失败 | 订阅过期或被风控;运行 `codex login` 重新登录 |
| HTTP 429 | 订阅额度/限流,稍后重试 |
| `INVALID_REQUEST:System messages are not allowed` | 系统提示已自动改走 `instructions` 字段,不应出现;如出现请升级插件 |
| `INVALID_REQUEST:Unsupported parameter` | 订阅后端拒绝 `max_output_tokens`/`temperature`/`stop`,适配器已自动剥离;如仍出现请升级插件 |
| 模型列表为空 | 实时发现失败且本地无 models_cache.json 时使用内置静态列表 |

## 注意事项

- 本插件会读取并(在刷新时)改写 `~/.codex/auth.json`,与 codex CLI 行为一致;如不希望
  写回,设置 `writeBack: false`(届时过期令牌只在内存中刷新,重启 dsh 后重新刷新)。
- 实验性多模态分支支持 DSH 图片附件，并将其编码为 Responses API `input_image` data URL。
- 本分支把本地 `attachment-local` 的 `maxImagePixels` 提高到 200,000,000；上游服务商仍可能有独立的像素、尺寸和文件大小限制。
- 订阅额度由 OpenAI 按账号计量,与 codex CLI 共用同一配额。
