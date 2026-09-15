# 天台十句 · v2 开发分支

> 分支：`v2/roadmap`。创建于 2026-09-15，代码基线为已通过本地验证的 v1 整合提交 `bb93887f`。本次新增的是 v2 文档与任务清单，不是已完成的 v2 游戏。

## v2 文档入口

[v2 全案与设计基线](docs/v2/README.md) 包含项目章程、世界观、玩法系统、技术架构、Prompt 架构、艾章 Demo 蓝图和路线图。原始 8 份设计文档从本地旧工作树导入，主体保留，文首补充当前状态。

下方原 v1 说明用于运行继承的代码。v1 的已实现规则与 v2 的目标设计必须分开，不能把 v2 文档中的碎片、循环、多 NPC 当成当前可玩功能。v1 稳定版在 master。

## TODO

### 已完成的准备

- [x] 建立全新 v2/roadmap 分支，继承 bb93887f 的代码、测试和文档工具。
- [x] 将原来未提交的 8 份 v2 设计文档纳入版本管理。
- [x] 在分支根 README 建立可勾选 TODO，明确设计/实现边界。

### P0 · 基线与工程收口（M0）

- [ ] 复核 00–06 册的默认决策与范围，确认后记录；不能以未回复自动视为同意。
- [ ] 重排日历：06 册的 2026-08-03 开工及其后日期是原计划，不是进度实绩，需按实际人力重新确认。
- [ ] 统一验收口径：艾章教学时长 15–25 分钟与 M1 的 30–45 分钟存在差异，先确认再测试。
- [ ] 建立 CI：前端 lint/test/build、后端 test/build/vet、文档链接检查。继承的本地通过结果不等于 CI 已上线。
- [ ] 同步前后端 v2 契约和存档版本策略，保留 v1 存档，补兼容与迁移测试。
- [ ] 明确 Prompt/叙事安全规范、Key 与 Base URL 安全边界，加入内容提示与可退出路径。

### P1 · 艾章可玩切片（M1）

- [ ] 实现碎片背包、出示、每周目一次限制，以及 +1/+2/-1 句数规则；每种状态转移有回归测试。
- [ ] 用标注样本比较 embedding/LLM 三档判定，记录阈值、降级路径和准确率，不将文档目标当作测试结果。
- [ ] 实现受控的 v2 艾章 Prompt、状态温度映射与碎片上下文注入，并检查前后端契约。
- [ ] 实现网络流式、即时占位反馈及取消/超时处理，覆盖断流、重试、重复提交。
- [ ] 完成单夜失败/回滚、CG/HUD 接入，开展真实模型和玩家内测后逐项验收 M1。

### P2 · 循环与内容扩展（M2–M5）

- [ ] 周目管理、碎片继承、有损摘要、新旧存档迁移与调用成本预算。
- [ ] 逐章接入周伯、童、夏、镜、苏晚及终章；每章保留自动化与叙事验收证据。
- [ ] 预写受控审查/提示词泄露演出，不暴露真实系统 Prompt 或依赖越狱。
- [ ] 核对美术、音乐授权与风格；完成全流程、移动端、性能和内容安全验收后再发布。

只在有代码、测试或可核对交付物时勾选完成。当前优先 M0 → M1，不提前宣称完整 v2 可玩。详细任务见 [路线图](docs/v2/06_roadmap_milestones.md)。

---

## 继承的 v1 运行说明

> 你只有十句话，去挽回一个站在天台边缘的女孩。

[![Go](https://img.shields.io/badge/Backend-Go%201.22-00ADD8?logo=go)](https://go.dev/)
[![Vue](https://img.shields.io/badge/Frontend-Vue%203-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite)](https://vite.dev/)

试玩地址（本次未验证部署状态）：http://tiantaishiju.top

> 版本状态（2026-09-15）：v1 核心玩法 Demo 已完成，当前整合了代码审查修复、统一 CG 与 Web 首页。最新检查与待办见 [项目状态](docs/STATUS.md)。v2 单独维护在 `v2/roadmap` 分支，不代表已实现。

## 项目简介

《天台十句》是一款 AI 原生叙事游戏。玩家在深夜天台遇见一个濒临崩溃的女孩“艾”，需要在有限的十句话内与她交流，尝试把她从边缘拉回来。

它不是普通的 AI 对话页。大模型在游戏中同时参与提示生成、角色回复、好感反馈与结局判定；“十句话”既是叙事压力，也是控制 Token 成本的玩法规则；等待文案和抽烟停顿用于消化 LLM 延迟；打字机效果为后续流式输出预留了表现层。

## 核心特性

- **自然语言输入**：玩家不选固定选项，而是直接输入想说的话。
- **AI 参与判定**：LLM 不只生成回复，也参与提示、好感和结局判断。
- **十句话机制**：有限回合制造压力，同时控制自由对话的上下文成本。
- **动态回合奖励**：真正触动角色时，好感提升并获得额外对话机会。
- **多结局**：死亡、消失、相识三种基础结局。
- **后日谈聊天**：达成“相识”后，进入类似微信的后续聊天页面。
- **本地存档与成就**：存档、读档和结局收集均在浏览器本地完成。

## 技术栈

```text
backend/     Go 1.22 + Gin + OpenAI-compatible / Anthropic Messages
legacy_vue/  Vue 3 + Vite + TypeScript + Pinia + Tailwind CSS + Howler
docs/        产品、技术、Prompt 与优化文档
```

## 本地运行

### 环境要求

- Go 1.22+
- Node.js 24（当前验证环境；旧版 Node 20 不一定满足锁定依赖的要求）

### 启动后端

```bash
cd backend
cp .env.example .env
go mod download
go run .
```

后端默认运行在 `http://localhost:8080`。

后端 `.env` 可配置服务器侧兜底模型。玩家未在前端填写自己的 API Key 时，后端会使用服务器侧配置；`.env` 不应提交到 GitHub。

### 启动前端

```bash
cd legacy_vue
npm ci
npm run dev
```

前端默认运行在 `http://localhost:5173`。开发环境中可通过 `legacy_vue/.env.local` 配置：

```env
VITE_BACKEND_URL=http://localhost:8080
```

## 项目结构

```text
.
├── backend/                  # Go 后端与 LLM 转发层
│   ├── config/               # 环境变量与运行配置
│   ├── handlers/             # HTTP API
│   ├── llm/                  # Provider 适配与 Prompt 保护
│   └── main.go
├── legacy_vue/               # 当前主前端
│   ├── public/               # 游戏美术、音频与静态资源
│   └── src/
│       ├── components/       # 通用 UI 组件
│       ├── modules/          # LLM、音频、存档、成就模块
│       ├── router/           # 页面路由
│       ├── store/            # Pinia 状态
│       └── views/            # 页面视图
├── docs/                     # 项目文档
└── README.md
```

## 文档导航

文档入口：[docs/README.md](docs/README.md)

- [项目简介与 AI 原生说明](docs/product/project_overview.md)
- [玩家阅读文档](docs/product/player_guide.md)
- [故事线与世界观](docs/product/storyline_and_lore.md)
- [游戏设定集](docs/product/game_setting_bible.md)
- [技术文档](docs/engineering/technical_overview.md)
- [Prompt 与设定说明](docs/engineering/prompts_and_settings.md)
- [文档与 Prompt 一致性审查](docs/engineering/document_prompt_audit_2026-06-29.md)
- [项目状态与待办](docs/STATUS.md)
- [分支整合与验证记录](docs/engineering/integration_2026-09-15.md)

## 常用命令

```bash
# 前端测试
cd legacy_vue
npm test -- --run

# 前端构建
npm run lint
npm run build

# 后端构建
cd ../backend
go test ./...
go build ./...
```

## 隐私与安全

- 玩家填写的 API Key 持久化在浏览器 `localStorage`，请求时会发送给本项目后端，再由后端调用所选服务商；并非“不会离开浏览器”。部署应使用 HTTPS，勿导出或提交真实密钥。
- 服务器侧兜底 API Key 只通过后端环境变量读取，不暴露给前端。
- 游戏存档和成就均保存在本地浏览器。

## 当前状态

当前版本已完成标题页、主对话、提示、动态回合、三结局、成就、三栏位主线/后日谈存档，以及后日谈路由守卫。主线采用“角色自然回复 + 独立 JSON 裁判”双调用；打字机是本地显示效果，还不是真正网络流式输出。

当前仍需补齐音量/显示设置持久化、设定集到 Prompt 的完整映射、公网安全与成本控制、真实模型端到端验收。多模态、循环叙事和碎片系统不计入已完成范围。
