# 游戏黑话词典

网站：<https://zbl1637.github.io/game_slang_dic/>

本版延续原站的黑紫配色、文字雨和章节结构，更新了词云、3D 装饰、玩家测试、黑话扫描仪、图表、历史演变和文化翻译互动。

## 本地查看

在项目目录运行 `python -m http.server 8000`，打开 <http://localhost:8000/>。

## 发布

推送到 `main` 后，GitHub Actions 会先运行 `node --test tests/*.test.mjs`，再执行 `node scripts/build-pages.mjs`，仅将首页和 `assets/` 资源发布到 GitHub Pages。后端、测试和文档不会进入网站部署产物。`release.json` 记录线上提交。

## 词典与 API

词典默认可通过本地中英文词库查询。外部模型服务需要单独的后端代理，不能将私有密钥放入 GitHub Pages 或公开仓库。`assets/api-config.json` 只存公开代理地址，当前 endpoint 为空；后端部署与密钥配置见 [backend/README.md](backend/README.md)。客户端已支持超时、取消和本地回退；Worker 已通过独立测试和 Wrangler 构建验证，尚未配置真实账户或上线。API 的启用状态以公开端点配置和实际连接验证为准。

## 数据与资源

- 词库：`assets/combined_game_data.json`、`assets/data_en.json`。
- 图表说明：`CHART_DATA_SOURCES.md`。
- 前端库及其许可证保留在 `assets/vendor/`。
- 部分嵌入图表依赖 Flourish，在线字体依赖 Google Fonts。
