# 天台十句

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
