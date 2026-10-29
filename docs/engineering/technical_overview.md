# AIC 竞赛版技术文档

> 更新：2026-10-29（AIC 独立项目，AI × 心理健康沟通特化）。以可执行代码为准；Prompt 与复盘字段见 [AIC Prompt 规范](prompts_and_settings.md)，状态见 [项目状态](../STATUS.md)。

## 1. 工程结构

主前端为 `legacy_vue/`（Vue 3、TypeScript、Pinia、Vite 8、Tailwind CSS、Howler），后端为 `backend/`（Go 1.22 模块、Gin）。仓库已无受跟踪的 `next_temp/` 工程。

| 位置 | 职责 |
| --- | --- |
| `backend/config/` | 环境变量、.env、服务器默认模型 |
| `backend/handlers/` | HTTP 校验、配置选择、错误/无密钥兜底 |
| `backend/llm/` | Provider 适配、五类 Prompt、心理健康沟通裁判、复盘与规则归一化 |
| `legacy_vue/src/views/` | 首页、主线、设置、成就、后日谈 |
| `legacy_vue/src/domain/` | 契约、状态类型、阈值、CG 映射 |
| `legacy_vue/src/store/` | 主线状态机、运行期音量/显示设置 |
| `legacy_vue/src/modules/` | API、音频、存档、成就 |
| `legacy_vue/src/composables/` | 共用存档栏位与开场/结局演出 |

## 2. 主线请求与结算（2026-10-29 AIC 契约）

1. `gameStore.sendMessage()` 记录本句并扣 1 次机会，历史排除重复的本句。
2. `LLMService.chat()` 向 `POST /api/chat` 发送历史、本句、剩余机会、信任、信任增长次数、发言次数、姿态及模型配置。
3. 后端角色调用生成自然回复，独立裁判调用分析本句、回复与状态。两次模型调用顺序执行；模型采样参数按服务商适配，不统一承诺固定温度。
4. 裁判字段为 `emotion`、`ai_state`、`trust_delta`、`pressure_delta`、`ending_type`、`confidence`。裁判用创伤知情、心理急救（PFA）和动机式访谈（MI/OARS）定义“具体倾听、验证感受、尊重选择、协作支持”等可观察证据，但不做临床诊断。前后端归一化字段和枚举。
5. 先扣压力造成的信任损耗（0/1/2），再加信任增量（0/5），上限 15；不返还或额外扣除发言机会。
6. 安全离开需本轮结算信任达到 15，且 AI 判定叙事条件成立；低信任的离开状态和结局被拦截。满分和哭泣都不自动成功。
7. 十句耗尽且缺少有效安全结局时，保守收束为拒绝离开。
8. `resolveVisualState()` 选择状态对应的预制画面；安全离开播放落泪、抹泪、一起进入楼梯间三段 CG。
9. 结局后调用复盘 Prompt，返回关键转折、叙事短评、心理沟通观察、技能 ID、下一步和安全边界；这些字段描述语言行为，现实心理健康问题进入现实支持与专业服务流程。

初始机会 10，提示 3，存档栏位 1—3。当前两个结局为 `end_safe_exit` / `end_refusal`。固定十句和自由语言共同构成玩家斟酌表达的条件，详见[创新机制](innovation_mechanism.md)。

### 2.1 双调用架构的工程边界

角色生成与裁判评价是两个逻辑职责：角色 LLM 只生成自然对白，裁判 LLM 只输出结构化评价，规则守门由 Go/TypeScript 确定性执行。两次调用可以使用同一或不同服务商；职责、Prompt 和响应契约分别维护。

可编辑 UML 图：

- [AIC 双调用组件图](../architecture/aic_dual_call_component.puml)
- [AIC 双调用时序图](../architecture/aic_dual_call_sequence.puml)

这套结构参考《Evaluation-Driven Intelligence》的 evaluator feedback 与模块职责分离思想，将其映射到剧情生成、独立评价和程序规则校验。具体书目见根目录 README 的[参考文献与架构启发](../../README.md#参考文献与架构启发)。

## 3. API 与 Prompt

| API | 用途 |
| --- | --- |
| `GET /api/health` | 健康检查 |
| `POST /api/chat` | 角色 + 裁判双调用 |
| `POST /api/hint` | 方向性提示 |
| `POST /api/chat-after` | 携带真实结局上下文的后日谈 |
| `POST /api/ending-summary` | 关键句和短评 |

五类 Prompt（角色、心理健康沟通裁判、PFA/MI 提示、安全回访、心理沟通复盘）详见 [AIC Prompt 规范](prompts_and_settings.md)。当前是完整响应后本地打字机播放，未实现 SSE/网络流式协议。

## 4. 模型配置与错误边界

- 配置支持 qwen、deepseek、doubao、kimi、zhipu、openai、claude、custom；Provider 的模型与地址由账户配置启用。
- 大部分使用 OpenAI-compatible Chat Completions；Claude 使用独立 Anthropic Messages 适配。
- 玩家有 Key 时使用玩家配置；无 Key 时完整切换服务器 Provider/Key/模型/Base URL，避免混用。
- 两侧都无 Key 时提供标注“模拟回复”的演示，而不是完整 AI 试玩。
- 后端共享 HTTP 客户端单次超时 60 秒；两次顺序调用组成一轮完整交互。
- 裁判失败时保持姿态、零增量、无结局；角色失败时后端返回 HTTP 200、error 和兜底回复，前端按响应契约处理。

## 5. 存档、设置与路由

- `SaveSystem` 使用 localStorage 与 CRC32，区分主线/后日谈栏位。CRC32 是完整性检测，不是密码学签名或安全防作弊。
- 成就本地持久化。后日谈路由守卫要求安全离开状态或可读且符合安全结局条件的后日谈存档。
- Key/Provider/模型/Base URL 已持久化；音量、字号、行高等 settingsStore 设置尚无刷新恢复。
- 后日谈携带关键句、最后一句、结局回复、短评和统计，避免重置为陌生人聊天。
- 局后复盘新增 `psychological_reading`、`support_skills`、`next_step`、`safety_boundary`；旧模型或旧存档缺少这些字段时，前端使用保守的本地复盘兜底。

## 6. 开发与验证

当前验证环境使用 Node.js 24、Go 1.25.7（Go 模块最低声明 1.22）。前端 npm ci 后执行 npm run lint、npm test -- --run、npm run build；后端执行 go test ./...、go build ./...。

ESLint 使用 eslint.config.mjs 的 flat config，保留 Vue essential、TypeScript recommended 和禁止显式 any；格式检查与逻辑 lint 分离，不做全仓库格式重写。迁移依据：[ESLint 官方指南](https://eslint.org/docs/latest/use/configure/migration-guide)。

测试涵盖状态结算、存档校验、API 转换、路由、成就、机会显示、开场/安全离开演出、后日谈、心理沟通复盘和首页回归。

## 7. 部署边界

默认后端 8080、Vite 开发 5173；开发配置 VITE_BACKEND_URL，生产可同源代理 /api/*。刷新子路由需要 SPA history fallback。

部署建设项为限流、认证、服务端会话、调用预算和自定义 Base URL 安全策略，见[项目状态的下一阶段](../STATUS.md#下一阶段)。玩家 Key 会经过后端及模型服务，部署使用 HTTPS，环境文件、真实密钥和敏感原始日志留在本地配置环境。

本地单测和构建覆盖代码契约与程序行为；线上运行由部署环境与真实模型配置共同决定。
