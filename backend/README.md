# DeepSeek 词典代理

本后端使用 DeepSeek 官方 API，模型为 `deepseek-flash`（当前对应 DeepSeek-V4.1-Flash），显式关闭思考模式。Cloudflare Worker 负责代理请求并保护 DeepSeek 密钥，GitHub Pages 托管前端。

生产端点：`https://game-slang-api.zbl1637wddy.workers.dev/api/slang/explain`。2026-10-07 已配置 `LLM_API_KEY` Secret 并部署，真实云端“开黑”查询返回 200，预检、来源限制、非法输入与无证据回退验收通过。发布版 `assets/api-config.json` 已配置此地址；本地开发目录可保持 endpoint 为空以仅使用词库。

## 部署所需配置

1. 准备可用的 DeepSeek API key 与账户额度，以及有部署权限的 Cloudflare 账户。`wrangler.jsonc` 已设定 `LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-flash`，请求地址为 `https://api.deepseek.com/chat/completions`。无需另选模型或申请其他模型平台。账户是否有效仍须实际验证，不能根据文档或配置判断。
2. `ALLOWED_ORIGIN` 是精确浏览器来源，线上为 `https://zbl1637.github.io`，没有仓库路径、没有末尾斜杠。独立本地测试环境可以改为预览的完整 origin，不能为线上配置通配符。
3. `IP_LIMITER` 每个 IP 每 60 秒允许 10 次请求。`namespace_id` 需在同一账户内为本项目预留，避免与其他业务冲突。缺少绑定时后端拒绝调用模型。
4. 在 Worker 的 Variables and Secrets 中新增 **Secret** `LLM_API_KEY`，值为 DeepSeek API key，或使用 `npx wrangler secret put LLM_API_KEY` 的交互式输入。不要放进 `vars`、公开配置、命令参数、页面、日志或 Git。此目录不需要 `.env`，也不能通过 GitHub Pages 保存私钥。
5. 从本目录完成 Wrangler 登录和部署。所需 OAuth 范围为 `account:read user:read workers_scripts:write`（另有必需的 `offline_access`）；仅 `workers:write` 不足以访问脚本发布 API。可用 `npx wrangler deploy --dry-run` 检查构建，真正发布使用 `npx wrangler deploy`。Wrangler 4.148.0 也支持 `--secrets-file` 读取仓库之外的私密 `.env` 文件，同次部署保存 Secret。已有 Secret 会在后续部署中保留。不要把私密文件加入仓库或 Pages 产物。
6. 将部署所得 `/api/slang/explain` 完整 HTTPS URL 写入 `assets/api-config.json` 的 `endpoint`，再发布静态页面。`timeoutMs` 默认 18000（允许 2000–30000），后端上游超时 15000ms。

DeepSeek 请求使用 `thinking: { type: "disabled" }`、`max_tokens: 700`、`stream: false` 和 `response_format: { type: "json_object" }`，系统提示包含 JSON 格式样例。DeepSeek 默认开启思考，故不能省略关闭设置；此接口使用 `max_tokens`，不是其他供应商的 `max_completion_tokens`。JSON 模式可能返回空内容或被 token 上限截断，后端继续检查 `finish_reason === "stop"`、JSON 解析、字段类型与长度，不把 JSON 模式等同于业务 schema 保证。

上游 fetch 使用 `redirect: "manual"`，并拒绝所有非 2xx 响应，避免携带密钥跟随重定向。不要改为 `redirect: "error"`：本次实际 Cloudflare 边缘运行时不支持该取值，会在发出模型请求前抛出异常；Node 模拟测试本身不能发现这个运行时差异。

原 OpenAI 兼容模式仍可复用：服务端修改 `LLM_BASE_URL` 与 `LLM_MODEL`，保留同一 Secret 名；上游需支持 Chat Completions、`json_object` 和 `max_tokens`。仅官方 DeepSeek origin 会收到 `thinking` 参数，其他兼容上游不会被强加该私有字段。前端无法指定模型、基础地址或思考设置。

## 接口与回退

请求为 POST JSON：`{ "query": "开黑", "gameId": "all", "locale": "zh", "context": "" }`。`gameId` 可为 `all` 或原词库中的游戏名称，locale 仅接受 zh/en。前端不发送密钥、任意上游 URL、模型、系统提示或自定义证据。服务端打包原中英 JSON，根据词条匹配最多取六条证据；没有证据返回 404，不让模型无依据补写。

成功响应为 `{ source: "ai", result: { term, definition, usage, examples, context, level, synonyms }, sourceIds: [] }`。来源 ID 指向此次提供给模型的词库记录（`zh:数组索引` / `en:数组索引`），表示检索证据，不是自动核实后的逐句引用。例句为辅助解释，不是评论原话。内容最终仍由原页面 HTML 转义后显示。

输入流上限 8 KiB，读取请求体最多 5 秒，超时或访问者取消会关闭读取流；query 最多 80 字符，context 最多 1000 字符。上游响应最多 32 KiB、700 tokens，严格校验输出字段和长度。配置中的 `enable_request_signal` 使 Worker 能接收浏览器断开信号。取消与超时会中止上游 fetch，不自动重试计费请求；供应商是否已经计算或产生费用取决于其实际处理状态。错误响应不回传上游原文或密钥。

前端未配置、远程超时、返回非 JSON、结构错误、429 或服务异常时使用原本地结果；已启用代理但失败时，在原“匹配情况”处注明回退。无本地结果时显示原查询错误提示。新查询、语言或游戏切换会取消旧请求，旧响应不能覆盖新状态。配置缺失时会回退本地，修复配置后刷新页面重新加载。

## 公开服务的边界

CORS 仅限制浏览器跨域读取，不能鉴别访问者，也不能阻止伪造 Origin 的脚本。当前适合小规模匿名词典使用；对公众长期开放前应在供应商侧配置费用上限，按流量加登录或 Turnstile 及全局配额。Cloudflare Rate Limiting 按地点执行且最终一致，**不是严格全球日额度**；多地代理可绕过单 IP/单地点约束。这里不声称能够完全防刷或保证固定总费用。

页面发布仅需要 `index.html` 与公开 `assets`；`backend`、测试、报告不属于 Pages 页面资源。即使源码仓库公开，密钥也只能存在 Worker Secret。静态前端不依赖 Wrangler 或任何 Cloudflare SDK。

## 本地自动验证

在站点目录执行 `node --test tests/dictionary-api.test.mjs tests/worker.test.mjs`。测试使用模拟 fetch 和限流绑定，不向供应商发请求，不证明真实账户已接通。部署后还需检查 OPTIONS、空白/超长输入、429、一次经授权的小额真实请求，以及配置错误时的本地回退。

DeepSeek 官方错误码包括：400 请求格式错误、401 key 鉴权失败、402 余额不足、422 参数无效、429 限流、500 服务端错误、503 服务繁忙。当前代理仅将上游 429 作为 429 返回，其他上游错误转换为不含原文的 502；前端自动使用本地查询。不要把本地查询正常当作模型成功，也不要通过自动重试掩盖账户错误。

官方资料（2026-10-07 核验）：[DeepSeek 接口地址与模型](https://api-docs.deepseek.com/)、[Chat Completions 参数](https://api-docs.deepseek.com/api/create-chat-completion/)、[JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)、[模型价格](https://api-docs.deepseek.com/quick_start/pricing/)、[错误码](https://api-docs.deepseek.com/quick_start/error_codes/)、[GitHub Pages 静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Workers 部署](https://developers.cloudflare.com/workers/get-started/guide/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[取消信号兼容配置](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#enable-requestsignal-for-incoming-requests)、[限流及地域边界](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。
