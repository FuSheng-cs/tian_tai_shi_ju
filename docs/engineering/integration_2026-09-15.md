# v1 分支整合与验证（2026-09-15）

## 范围与来源

以本地 `347cda06` 为代码/CG 基线，在 `release/consolidate-2026-09-15` 整合，验证后快进合入 master。没有强制推送、删除历史分支或修改密钥配置。

| 分支 / 提交 | 处理 |
| --- | --- |
| refactor/review-fixes：277fa02c、347cda06 | 原始修复及统一 CG 两笔已完整推送，作为本次基线 |
| master：95900d63 | 合入原主分支历史，合并未引入额外文件差异 |
| Client：29ee6f4b | 已包含在基线；设置、主线、后日谈 UI 保留 |
| Web：a65b6874、fc8c9e4e | 合入较新首页、介绍卡和移动布局，冲突中保留 useSaveSlots 及 entry/slot 路由参数修复 |
| codex/4_20：c1a736f4 | 已包含其历史；旧菜单资源以当前版本为准 |
| trae/hanyi-pixel-font、codex/smoke、trae/cai_dan_test02 | 已在当前历史中 |
| trae/0.3.0：8d629303 | git cherry 标记补丁等价；隐藏后日谈滚动条已由 3f9f1cae 包含，不重复引入 |
| trae/save-alert-hidden-before-home-redesign：d32a3fc3 | 对照后确认 GameView/ChatAfterStory 改动已进入 Client，Settings 后续仅继续优化按钮；保留快照不重复合并 |
| trae/solo-agent-FZwhRd：c3c7cd0a | 保留历史参考，不合入旧正文标签协议、旧结局门槛、好感条和与新设定冲突的人物 Prompt；情绪功能已有新版实现 |
| claude/refine-vague-idea-to-project-c82488 工作树 | 8 份未提交 docs/v2 文档转入全新 v2/roadmap 分支，不混入 v1 |

保留旧分支用于追溯，不以“让所有分支看起来 merged”为由覆盖最新内容。后续 v1 改动从 master 派生，v2 从 v2/roadmap 开发。

## 本次补充修复

- ESLint 10 无法读取旧 .eslintrc.cjs：迁移 flat config，沿用现有依赖与质量规则，清理未使用变量/无效禁用注释。
- 新增首页回归：Web 四个菜单入口、成就/设置导航、三栏位、空栏位禁用、关闭存档面板。
- 更新 README、技术说明、客户端说明、产品边界、Prompt 补充、变更记录和文档索引。
- 历史审查保留原始证据并加复核状态，移除索引里不随 Git 发布的旧链接。
- 增加 scripts/check_docs.mjs 检查受跟踪/可提交 Markdown 的本地文件链接，不检查网络或标题锚点。

## 验证结果

环境：Windows / PowerShell，Node v24.14.0、npm 11.9.0、Go 1.25.7。以下命令在本次整合代码上实际执行。

| 检查 | 结果 |
| --- | --- |
| legacy_vue：npm run lint | 通过，0 错误、0 警告 |
| legacy_vue：npm test -- --run | 10 个文件、93 个用例全部通过（原基线 92 个，新增 1 个整合回归） |
| legacy_vue：npm run build | vue-tsc、Vite、PWA 生成通过；22 个预缓存条目 |
| backend：go test -count=1 ./... | config、handlers、llm 三个测试包通过，根包无测试 |
| backend：go build ./... | 通过 |
| backend：go vet ./... | 通过 |
| 根目录：node scripts/check_docs.mjs | 18 个 Markdown 文件、44 个本地文件链接通过 |
| 根目录：git diff --check | 通过，无空白错误 |
| Chromium 浏览器 | 1440×900 首页、390×844 首页/存档面板/开场/主场景检查完成；菜单可进入新游戏，空栏位禁用，开场可跳过，控制台 0 错误 |

浏览器依据 Playwright 技能完成实际导航、快照与截图，首页及存档截图已人工读图检查。截图保存在本机 output/playwright/integration-0915-*.png，属于忽略的检查产物，不随 Git 发布。检查未发送真实模型请求。

构建仍提示 Browserslist 数据约 6 个月未更新；本次不为消除提示额外升级依赖。首页页脚沿用 Web 分支的 v1.7.0 展示文字，package.json 仍为 0.0.0；版本追溯以 Git 提交为准，本次不创建语义版本标签。

本文件不把构建、静态 UI 或 Mock 单测解释为线上/真实模型验收。

## 仍存在的边界

- 网络流式、多模态、v2 碎片与循环尚未实现。
- 音量/显示设置持久化、完整设定投影、线上安全/预算、真实模型体验仍待处理，见 [项目状态](../STATUS.md)。
- 无真实 Key 的浏览器检查不验证模型响应与计费；本次不修改生产部署。
- 旧版 CG 原稿和候选图仍保留，未为了减小体积直接删除。
