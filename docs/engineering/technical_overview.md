# 技术文档

## 1. 项目概览

项目当前是一个“前端负责交互和状态、后端负责 Prompt 保护与模型转发”的 AI 叙事游戏。

主运行栈：

- 前端：Vue 3 + Vite + TypeScript + Pinia + Tailwind CSS v4 + Howler
- 后端：Go 1.22 + Gin
- AI 接口：OpenAI 兼容 Chat Completions 协议
- 存储：浏览器 `localStorage`
- 部署假设：生产环境前后端同源，由 Nginx 代理 `/api/*`

仓库内同时存在两套前端痕迹：

- `legacy_vue/`：当前真实可运行、与后端配套的主前端
- `next_temp/`：未接管的 Next.js 模板目录，仍是默认脚手架内容

因此，技术上应将 `legacy_vue` 视为当前主工程，将 `next_temp` 视为未清理的迁移/试验残留。

## 2. 目录与职责

### 根目录

- `backend/`：Go 后端，负责配置加载、路由和 LLM 转发
- `legacy_vue/`：Vue 主前端，负责场景渲染、状态管理、存档与设置
- `docs/`：叙事、Prompt、清理记录等文档
- `next_temp/`：未投入使用的 Next.js 模板工程

### `backend/`

- `main.go`：启动 Gin 服务，挂载 CORS 中间件和 API 路由
- `config/config.go`：读取环境变量与 `.env`
- `handlers/game.go`：解析前端请求，构建客户端配置，调用 LLM 服务层
- `llm/service.go`：封装模型请求、保存主线 Prompt / 提示 Prompt / 后日谈 Prompt

### `legacy_vue/src/`

- `views/StartView.vue`：标题页、入口导航
- `views/GameView.vue`：主游戏场景、提示、输入框、结局承接
- `views/SettingsView.vue`：模型配置、音频与显示设置
- `views/AchievementsView.vue`：成就图鉴
- `views/ChatAfterStoryView.vue`：相识结局后的续聊页
- `store/gameStore.ts`：游戏主状态机
- `store/settingsStore.ts`：UI 设置状态
- `modules/LLMService.ts`：前端请求代理层
- `modules/SaveSystem.ts`：本地存档
- `modules/AchievementTracker.ts`：成就追踪
- `modules/AudioManager.ts`：BGM / SFX 控制
- `components/TypewriterText.vue`：打字机效果
- `components/ProgressBar.vue`：顶部剩余回合进度条

## 3. 运行机制

### 3.1 主对话流程

主对话完整链路如下：

1. 玩家在 `GameView.vue` 输入文本。
2. `gameStore.sendMessage()` 先把玩家消息压入本地消息列表，并消耗 1 次回合。
3. 前端通过 `LLMService.chat()` 向 `/api/chat` 发送：
   - 历史消息
   - 当前玩家输入
   - 剩余回合
   - 当前好感度
   - 好感触发次数
   - 玩家已发言次数
   - 当前持续人物状态 `ai_state`
   - 玩家本地保存的模型配置
4. 后端 `handlers.HandleChat()` 调用 `llm.Chat()`。
5. `llm.Chat()` 用当前回合数和好感度拼接系统 Prompt，再转发到外部模型。
6. 模型返回文本后，前端解析其中的系统标签：
   - `[好感度+5]`
   - `[状态:戒备]`
   - `[状态:观察]`
   - `[状态:动摇]`
   - `[状态:临界]`
   - `[情绪:刺痛]`
   - `[情绪:惊讶]`
   - `[情绪:柔软]`
   - `[情绪:好奇]`
   - `[结局:死亡]`
   - `[结局:消失]`
   - `[结局:相识]`
7. 前端根据标签更新：
   - `affection`
   - `roundCount`
   - `lastEmotionTag`
   - `emotionHistory`
   - `lastAiStateTag`
   - `aiStateHistory`
   - `isEnding`
   - `endingType`
8. 最终由 `resolveVisualState()` 统一判定 CG：结局 CG > 临界状态/句数压力 CG > 情绪 CG > 人物状态基础 CG；`GameView.vue` 只消费判定结果。

### 3.2 提示流程

提示按钮会调用 `/api/hint`，后端使用单独的“导演/旁白 Prompt”生成一句方向性建议。提示不会直接给标准答案，而是给一个切入方向。

### 3.3 后日谈流程

“相识”结局后，页面会跳转到 `/chat-after`。这一页调用 `/api/chat-after`，使用更轻松、偏日常聊天的 Prompt，模拟关系建立后的持续交流。

## 4. Prompt 设计

当前项目有四套核心 Prompt，且都放在后端。角色名、结局名、机制标签由后端 `backend/llm/game_contract.go` 和前端 `legacy_vue/src/domain/gameContract.ts` 的契约常量维护，避免 Prompt、UI 和状态解析各自手写。

### 4.1 主线 Prompt

职责：

- 定义“艾”的角色核心设定
- 明确十句话规则
- 要求回复尽量简短
- 通过标签控制好感与结局

这是项目最关键的设计点。它把 LLM 从单纯“生成台词”，提升为“生成带机制语义的状态输出”。

### 4.2 提示 Prompt

职责：

- 站在旁白/导演视角
- 结合历史对话给方向
- 控制输出很短

这套 Prompt 用来降低玩家卡关概率，改善自由输入带来的“无从开口”问题。

### 4.3 后日谈 Prompt

职责：

- 将“艾”从濒临轻生的状态，切换为暂时离开栏杆后的日常聊天状态
- 降低情绪强度，转入更生活化的关系表达

### 4.4 局后摘要 Prompt

职责：

- 从本局玩家发言中评选关键转折句
- 生成一句简短局后评语
- 只返回结构化 JSON，便于前端稳定渲染结局摘要

## 5. 状态与本地数据

### 5.1 游戏状态

`gameStore.ts` 维护核心状态：

- `roundCount`
- `hintCount`
- `affection`
- `messages`
- `isWaiting`
- `waitingText`
- `isEnding`
- `endingType`

这使得前端具备较清晰的状态边界，主场景 UI 不需要自己维护复杂局部状态。

### 5.2 存档

`SaveSystem.ts` 使用 `localStorage` 保存存档，并用 `CRC32` 做完整性校验。当前设计具备基本的防随手篡改能力，适合轻量单机网页游戏。

### 5.3 设置

LLM 配置保存在浏览器本地，主要包括：

- `provider`
- `apiKey`
- `model`
- `baseUrl`

项目设计上支持两种模式：

- 玩家自带 Key
- 服务器提供兜底 Key

这一点对 demo 部署非常重要，因为它决定线上站点能否直接试玩完整 AI 版本。

## 6. 前端表现层设计

项目的前端不是传统表单式聊天页，而是明显按叙事情绪来组织：

- 标题页强调夜景、霓虹、雨幕和高压短句概念
- 游戏页将对话框固定在底部，保留大面积氛围场景
- 用打字机效果增强角色开口时的节奏感
- 用顶部剩余机会条强化“十句话”这一玩法压力
- 用不同背景图和结局按钮收束情绪高潮

从产品实现上看，前端最大优点不是复杂，而是聚焦：所有界面几乎都围绕“深夜天台的一次关键对话”展开，没有把系统层做得过重。

## 7. 后端实现特点

### 优点

- Prompt 放在后端，避免直接暴露在前端
- 支持多 Provider，接口形式统一
- 支持自定义 Base URL，兼容中转或私有代理
- 超时配置明确，结构简单，便于部署

### 当前边界

- 没有做会话裁剪，历史越长，Token 成本越高
- 没有细粒度监控、限流与审计
- 依赖前端传入状态，属于轻后端架构

这说明它目前更像一个高可读、低复杂度的原型后端，而不是一个已经面向大规模公网流量的生产服务。

## 8. 测试与工程状态

### 8.1 前端测试

在 `legacy_vue/` 中执行：

```bash
npm test -- --run
```

结果：

- 2 个测试文件通过
- 4 个测试用例通过

当前测试主要覆盖：

- `gameStore` 的基础初始化与重置
- `SaveSystem` 的保存、读取与篡改校验

### 8.2 前端构建

在 `legacy_vue/` 中执行：

```bash
npm run build
```

结果：

- 构建成功
- PWA 资源生成成功

### 8.3 后端构建

在 `backend/` 中执行：

```bash
go build ./...
```

结果：

- 构建成功





## 9. 当前架构的优点

### 1. 原型价值很高

项目已经清楚证明了一件事：AI 自由对话可以和回合、结局、提示、续聊页结合成一个完整的游戏闭环。

### 2. 架构简单，可读性强

前端和后端都不复杂，阅读成本低，适合快速迭代 Prompt 和交互。

### 3. 产品定位明确

它不是大而全的聊天平台，而是一个围绕单一强情境构建的 AI 叙事游戏，因此技术实现没有被无关功能拖散。

## 11. 当前主要技术债

从技术视角看，当前技术债主要集中在四类：

- 状态与解锁规则仍有遗漏
- 资产和配置存在历史残留
- 工程化工具链没有完全跟上依赖升级
- 仓库里存在未清理的模板目录和过期分支痕迹

这些问题不影响项目“作为可运行原型”的成立，但会影响它向正式可维护版本演进。

## 12. 结论

《天台十句》当前已经完成了一个非常清晰的 AI 叙事游戏原型：

- 玩法闭环成立
- 情绪氛围成立
- 前后端职责清晰
- 构建与基础测试可通过

但它距离更完整、更稳健的正式版本，还需要继续补齐以下能力：

- 线上完整可玩性
- 路由与解锁一致性
- 设置与存档完整性
- 资产与工程配置收口
- 中长期的内容和 Prompt 统一管理

如果后续要继续投入，这个项目最值得保留和继续深化的，不是某个具体页面，而是它已经验证成功的核心命题：

“自由对话本身，可以成为游戏机制，而不只是表现形式。”
