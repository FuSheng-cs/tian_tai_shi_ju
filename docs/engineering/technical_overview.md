# 技术文档

> 更新：2026-09-15。以可执行代码为准；验证见 [整合记录](integration_2026-09-15.md)，待办见 [项目状态](../STATUS.md)。历史审查不等于当前缺陷清单。

## 1. 工程结构

主前端为 `legacy_vue/`（Vue 3、TypeScript、Pinia、Vite 8、Tailwind CSS、Howler），后端为 `backend/`（Go 1.22 模块、Gin）。仓库已无受跟踪的 `next_temp/` 工程。

| 位置 | 职责 |
| --- | --- |
| `backend/config/` | 环境变量、.env、服务器默认模型 |
| `backend/handlers/` | HTTP 校验、配置选择、错误/无密钥兜底 |
| `backend/llm/` | Provider 适配、五类 Prompt、裁判与规则归一化 |
| `legacy_vue/src/views/` | 首页、主线、设置、成就、后日谈 |
| `legacy_vue/src/domain/` | 契约、状态类型、阈值、CG 映射 |
| `legacy_vue/src/store/` | 主线状态机、运行期音量/显示设置 |
| `legacy_vue/src/modules/` | API、音频、存档、成就 |
| `legacy_vue/src/composables/` | 共用存档栏位与开场/结局演出 |

## 2. 主线请求与结算

1. `gameStore.sendMessage()` 写入玩家本句并扣 1 次机会。发送的历史排除本句，避免与 `user_message` 重复。
2. `LLMService.chat()` 请求 `POST /api/chat`，携带历史、本句、剩余机会、好感、触动次数、发言次数、姿态及模型配置。
3. 后端 `Chat()` 先调用角色模型（温度 0.8），只生成自然回复。清理旧机制标签和乱码，空回复使用统一兜底台词。
4. `EvaluateTurn()` 把最近 4 条历史、本句、角色回复和当前数值交给裁判（温度 0.2）。这是同一次 HTTP 请求内的第二次顺序模型调用。
5. JSON 字段为 `emotion`、`ai_state`、`affection_delta`、`pressure_delta`、`ending_type`、`confidence`。后端归一化枚举、增量与结局门槛，未被否定的回身叙事可兜底纠正姿态。
6. 前端将 snake_case 规范化为 camelCase，消费 `{ reply, evaluation }`；正文标签不再是机制事实源。
7. 先额外扣压力（0/1/2 次机会），再处理触动（好感 +5、触动次数 +1、机会 +1）。裁判有结局则采用，否则机会耗尽时执行本地阈值兜底。
8. CG 由 `resolveVisualState()` 和游戏页等待/演出状态协调：结局、临界或回身、瞬时情绪、基础姿态；资源路径在 `gameContract.ts` 中统一管理。

初始机会 10、提示 3、存档栏位 1–3。消失数值门槛为好感 ≥20、触动 ≥4、发言 ≥7；相识为好感 ≥25、触动 ≥5、发言 ≥7。机会耗尽时先按这些门槛判断，再尝试最后回复的叙事关键词推断，仍无结果才默认死亡。因此叙事兜底也可能给出成功结局，数值门槛并非所有路径的硬约束，详见 Prompt 第 7 节。

## 3. API 与 Prompt

| API | 用途 |
| --- | --- |
| `GET /api/health` | 健康检查 |
| `POST /api/chat` | 角色 + 裁判双调用 |
| `POST /api/hint` | 方向性提示 |
| `POST /api/chat-after` | 携带真实结局上下文的后日谈 |
| `POST /api/ending-summary` | 关键句和短评；死亡摘要由前端本地生成 |

五类 Prompt（角色、裁判、提示、后日谈、摘要）详见 [Prompt 说明](prompts_and_settings.md)。当前是完整响应后本地打字机播放，未实现 SSE/网络流式协议。

## 4. 模型配置与错误边界

- 配置支持 qwen、deepseek、doubao、kimi、zhipu、openai、claude、custom。这是代码提供的配置类型，不保证每个预设模型当前可用，需按账户权限核实。
- 大部分使用 OpenAI-compatible Chat Completions；Claude 使用独立 Anthropic Messages 适配。
- 玩家有 Key 时使用玩家配置；无 Key 时完整切换服务器 Provider/Key/模型/Base URL，避免混用。
- 两侧都无 Key 时提供标注“模拟回复”的演示，而不是完整 AI 试玩。
- 后端共享 HTTP 客户端单次超时 60 秒；两次顺序调用不等于整轮最多 60 秒。
- 裁判失败时保持姿态、零增量、无结局；角色失败时后端可返回 HTTP 200 携带 error 与兜底回复，不能只凭状态码判成功。

## 5. 存档、设置与路由

- `SaveSystem` 使用 localStorage 与 CRC32，区分主线/后日谈栏位。CRC32 是完整性检测，不是密码学签名或安全防作弊。
- 成就本地持久化。后日谈路由守卫要求相识结局状态或可读的后日谈存档。
- Key/Provider/模型/Base URL 已持久化；音量、字号、行高等 settingsStore 设置尚无刷新恢复。
- 后日谈携带关键句、最后一句、结局回复、短评和统计，避免重置为陌生人聊天。

## 6. 开发与验证

当前验证环境使用 Node.js 24、Go 1.25.7（Go 模块最低声明 1.22）。前端 npm ci 后执行 npm run lint、npm test -- --run、npm run build；后端执行 go test ./...、go build ./...。

ESLint 使用 eslint.config.mjs 的 flat config，保留 Vue essential、TypeScript recommended 和禁止显式 any；格式检查与逻辑 lint 分离，不做全仓库格式重写。迁移依据：[ESLint 官方指南](https://eslint.org/docs/latest/use/configure/migration-guide)。

测试涵盖状态结算、存档校验、API 转换、路由、成就、烟 HUD、开场/死亡演出、后日谈和首页整合回归。数量、截图及限制见本次整合记录；旧文档“2 文件/4 用例”已过时。

## 7. 部署边界

默认后端 8080、Vite 开发 5173；开发配置 VITE_BACKEND_URL，生产可同源代理 /api/*。刷新子路由需要 SPA history fallback。

尚未具备完整限流、认证、服务端权威会话、调用预算和自定义 Base URL 安全约束。玩家 Key 会经过后端及模型服务，应使用 HTTPS，不提交环境文件、真实密钥或敏感原始日志。

本地单测和构建不等于线上部署、真实模型质量、成本或叙事安全验收。
