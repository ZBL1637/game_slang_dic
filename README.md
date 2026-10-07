# 游戏黑话词典

网站：<https://zbl1637.github.io/game_slang_dic/>

本版延续原站的黑紫配色、文字雨和章节结构，更新了词云、3D 装饰、玩家测试、黑话扫描仪、图表、历史演变和文化翻译互动。

## 本地查看

在项目目录运行 `python -m http.server 8000`，打开 <http://localhost:8000/>。

## 发布

推送到 `main` 后，GitHub Actions 会先运行 `node --test tests/*.test.mjs`，再执行 `node scripts/build-pages.mjs`，仅将首页和 `assets/` 资源发布到 GitHub Pages。后端、测试和文档不会进入网站部署产物。`release.json` 记录线上提交。

## 词典与 API

线上智能词典已接入 DeepSeek 官方 API（`deepseek-flash`）。Cloudflare Worker 根据原词库证据生成解释，密钥保存为后端 Secret；`assets/api-config.json` 只保存公开代理地址。查询失败、超时或限流时自动回退到本地中英文词库，页面会注明回退状态。后端配置与维护见 [backend/README.md](backend/README.md)。

线上代理只接受 `https://zbl1637.github.io` 来源。本地预览仍可使用本地词库；要在本地测试模型，请使用单独开发 Worker 并配置对应的本地来源。

## 数据与资源

- 词库：`assets/combined_game_data.json`、`assets/data_en.json`。
- 图表说明：`CHART_DATA_SOURCES.md`。
- 前端库及其许可证保留在 `assets/vendor/`。
- 部分嵌入图表依赖 Flourish，在线字体依赖 Google Fonts。
