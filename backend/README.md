# 可选词典代理

这是可部署的准备代码，尚未部署，也未验证任何真实模型账户。默认 `assets/api-config.json` 的 `endpoint` 为空，网站继续使用原本地词库；GitHub Pages 不运行本后端。

## 部署所需配置

1. 在有权限的 Cloudflare 账户中使用 Wrangler。`wrangler.jsonc` 的 `LLM_BASE_URL` 填模型服务的 HTTPS 基础地址（例如带 `/v1` 的基础地址；不含 `/chat/completions`），`LLM_MODEL` 填该账户实际可用的模型名。服务需支持 Chat Completions、`response_format:json_object`、非流式响应和 `max_tokens`。
2. `ALLOWED_ORIGIN` 是精确浏览器来源，线上为 `https://zbl1637.github.io`，没有仓库路径、没有末尾斜杠。独立本地测试环境可以改为预览的完整 origin，不能为线上配置通配符。
3. `IP_LIMITER` 每个 IP 每 60 秒允许 10 次请求。`namespace_id` 需在同一账户内为本项目预留，避免与其他业务冲突。缺少绑定时后端拒绝调用模型。
4. 在 Worker 的 Variables and Secrets 中新增 **Secret** `LLM_API_KEY`，或通过 Wrangler 的交互式 secret 输入。不要放进 `vars`、公开配置、命令参数、页面、日志或 Git。此目录不需要 `.env`。
5. 配置完成后，从本目录执行 `npx wrangler deploy`；按照工具提示完成账户登录。也可先使用 `npx wrangler deploy --dry-run` 检查构建。这两条命令需要预先安装或允许下载 Wrangler，本任务未执行。
6. 将部署所得 `/api/slang/explain` 完整 HTTPS URL 写入 `assets/api-config.json` 的 `endpoint`，再发布静态页面。`timeoutMs` 默认 18000（允许 2000–30000），后端上游超时 15000ms。

## 接口与回退

请求为 POST JSON：`{ "query": "开黑", "gameId": "all", "locale": "zh", "context": "" }`。`gameId` 可为 `all` 或原词库中的游戏名称，locale 仅接受 zh/en。前端不发送密钥、任意上游 URL、模型、系统提示或自定义证据。服务端打包原中英 JSON，根据词条匹配最多取六条证据；没有证据返回 404，不让模型无依据补写。

成功响应为 `{ source: "ai", result: { term, definition, usage, examples, context, level, synonyms }, sourceIds: [] }`。来源 ID 指向此次提供给模型的词库记录（`zh:数组索引` / `en:数组索引`），表示检索证据，不是自动核实后的逐句引用。例句为辅助解释，不是评论原话。内容最终仍由原页面 HTML 转义后显示。

输入流上限 8 KiB，读取请求体最多 5 秒，超时或访问者取消会关闭读取流；query 最多 80 字符，context 最多 1000 字符。上游响应最多 32 KiB、700 tokens，严格校验输出字段和长度。取消与超时会中止上游 fetch，不自动重试计费请求；供应商是否已产生费用取决于其实际处理状态。错误响应不回传上游原文或密钥。

前端未配置、远程超时、返回非 JSON、结构错误、429 或服务异常时使用原本地结果；已启用代理但失败时，在原“匹配情况”处注明回退。无本地结果时显示原查询错误提示。新查询、语言或游戏切换会取消旧请求，旧响应不能覆盖新状态。配置缺失时会回退本地，修复配置后刷新页面重新加载。

## 公开服务的边界

CORS 仅限制浏览器跨域读取，不能鉴别访问者，也不能阻止伪造 Origin 的脚本。当前适合小规模匿名词典使用；对公众长期开放前应在供应商侧配置费用上限，按流量加登录或 Turnstile 及全局配额。Cloudflare Rate Limiting 按地点执行且最终一致，**不是严格全球日额度**；多地代理可绕过单 IP/单地点约束。这里不声称能够完全防刷或保证固定总费用。

页面发布仅需要 `index.html` 与公开 `assets`；`backend`、测试、报告不属于 Pages 页面资源。即使源码仓库公开，密钥也只能存在 Worker Secret。静态前端不依赖 Wrangler 或任何 Cloudflare SDK。

## 本地自动验证

在站点目录执行 `node --test tests/dictionary-api.test.mjs tests/worker.test.mjs`。测试使用模拟 fetch 和限流绑定，不向供应商发请求，不证明真实账户已接通。部署后还需检查 OPTIONS、空白/超长输入、429、一次经授权的小额真实请求，以及配置错误时的本地回退。

官方资料：[GitHub Pages 静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Workers 部署](https://developers.cloudflare.com/workers/get-started/guide/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[限流及地域边界](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。
