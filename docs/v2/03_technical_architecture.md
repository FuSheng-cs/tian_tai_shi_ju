# 03 技术架构

> 本册定义 v2 的前后端模块、数据模型、API、标签协议传输层、存档与流式方案。所有命名与数值基线以 [README](README.md) 为准；标签的**语义**（何时触发、判定规则）由 [04 册](04_prompt_architecture.md) 定义，本册只负责**传输与解析**；数值细节（句数经济、阈值）以 [02 册](02_gameplay_systems.md) 为准；艾章的落地样例见 [05 册](05_demo_ai_blueprint.md)。

写法约定：本册是 **delta 式方案**——每个模块先说清 v1 现状（含文件路径），再说 v2 怎么改。凡标注「默认决策」的条目，均为本册拍板值，实现时可直接采用。

---

## 1. 现状小结与 v2 目标架构

### 1.1 v1 现状（一句话版）

- 前端 `legacy_vue/`（Vue 3 + TS + Pinia + Tailwind v4 + Howler）：`gameStore.ts` 单一状态机管「一局对话」，`LLMService.ts` 走非流式 `fetch` JSON，`SaveSystem.ts` 用 localStorage + CRC32，`TypewriterText.vue` 对完整文本做打字机。
- 后端 `backend/`（Go 1.22 + Gin）：4 个 POST 接口（`/api/chat`、`/api/hint`、`/api/chat-after`、`/api/ending-summary`），Prompt 全部硬编码在 `llm/service.go`，双端契约常量在 `llm/game_contract.go` / `src/domain/gameContract.ts` 手工同步。
- 关键既有资产：**「生成器 + 判定器」两段式**已落地——主回复不带标签，机制结果由独立的规则裁判调用返回结构化 `TurnEvaluation`（`service.go:EvaluateTurn`）。v2 直接在这条通道上扩展，不回到「标签内联在正文」的老路（内联标签仅作降级兜底，见[第 5 节](#5-标签协议-v2传输与解析层)）。

### 1.2 保留 / 改造 / 新增总表

| 类别 | 模块 | 说明 |
| --- | --- | --- |
| 保留 | Gin 路由骨架、`ClientConfig` 多 Provider 抽象、`providerDefaults` | 直接沿用，含 Anthropic 协议转换 |
| 保留 | 契约常量双端同步模式（`game_contract.go` ↔ `gameContract.ts`） | v2 新标签继续走这套 |
| 保留 | `SaveSystem` CRC32 校验、Base64 封包 | 存档 v2 沿用封包格式，只升级 payload |
| 保留 | `TypewriterText.vue`、等待演出文案、`AudioManager`、`AchievementTracker` | 打字机改造为流式消费（[2.5](#25-打字机与流式输出的衔接)） |
| 保留 | 「生成器 + 判定器」两段式、`resolveVisualState` CG 优先级思路 | 判定器输出升级为 `TurnEvaluationV2` |
| 改造 | `/api/chat` | 多 NPC、状态注入、温度映射、流式输出（[3.1](#31-apichat-v2-改造)） |
| 改造 | `gameStore.ts` | 收窄为「当夜状态机」，跨夜状态移交 loopStore（[2.1](#21-store-边界)） |
| 改造 | `buildMainSystemPrompt` | 从硬编码函数改为「NPC 配置 + 内容库」装配器（[3.5](#35-预写内容库)） |
| 改造 | `GameView.vue` | 拆出场景渲染层与烟形句数条（[2.2](#22-场景渲染层)/[2.3](#23-烟形句数条组件)） |
| 新增 | `fragmentStore.ts`、`loopStore.ts` | 碎片背包与周目状态（[2.1](#21-store-边界)） |
| 新增 | `/api/fragment-check`、`/api/night-summary` | 碎片判定与有损摘要（[3.2](#32-apifragment-check)/[3.3](#33-apinight-summary)） |
| 新增 | `backend/embedding/` 包 | Embedding provider 抽象 + LLM 判定器降级（[3.4](#34-embedding-provider-抽象与降级)） |
| 新增 | `backend/content/` 预写内容库 | 幻觉库 / 审查官腔 / 提示词残页 / 情绪锚点（[3.5](#35-预写内容库)） |
| 新增 | SSE 帧流式通道 + 前端 `StreamBuffer` | [第 7 节](#7-流式输出方案) |
| 新增 | 兜底 Key 限流中间件 | [8.3](#83-兜底-key-限流) |
| 删除 | `next_temp/` 目录 | M0 收口清单（[第 10 节](#10-工程收口m0)） |

### 1.3 v2 目标架构图

```
┌──────────────────────────── 浏览器（legacy_vue） ────────────────────────────┐
│                                                                              │
│  Views: StartView / NightView(原GameView) / FragmentView / SettingsView      │
│         LoopTransitionView(周目回滚演出) / FinaleView(终章质子视角)            │
│         ChatAfterStoryView(保留)                                             │
│      │                                                                       │
│  ┌───┴────────── Pinia Stores ──────────────┐   ┌──────── 渲染层 ─────────┐  │
│  │ gameStore    当夜状态机（句数/消息/结局）   │   │ SceneLayers.vue          │  │
│  │ fragmentStore 碎片背包（拥有/出示记录）     │   │  像素图层×3 + CSS 视差    │  │
│  │ loopStore    周目号/继承/全局旗标/夜间摘要  │   │ ParticleCanvas.ts        │  │
│  │ settingsStore UI 设置（保留）              │   │  雨/烟/火星（Canvas 2D）  │  │
│  └───┬──────────────────────────────────────┘   │ CigaretteMeter.vue 烟条   │  │
│      │                                          │ TypewriterText.vue(流式)  │  │
│  Modules: LLMService(流式) / SaveSystem(v2)     └──────────────────────────┘  │
│           StreamBuffer / SaveMigration                                       │
└──────┬───────────────────────────────────────────────────────────────────────┘
       │  POST /api/*   （生产同源，Nginx 代理；/api/chat 为 SSE 帧流）
┌──────┴───────────────────────── Go + Gin（backend） ─────────────────────────┐
│  middleware: CORS / RateLimit(兜底Key限流)                                    │
│  handlers:  chat(流式) / fragment-check / night-summary / hint / chat-after  │
│  llm:       service.go(装配+调用) / stream.go(SSE写出) / judge.go(判定器)     │
│             game_contract.go(契约常量v2)                                     │
│  embedding: provider.go(OpenAI兼容 /v1/embeddings) / fallback.go(LLM降级)    │
│  content:   npc/<id>/{persona,anchors,hallucinations,censor,pages}.json      │
│             （go:embed 编译进二进制，启动时校验）                              │
│  config:    config.go(+embedding与限流环境变量)                               │
└──────┬───────────────────────────────────────────────────────────────────────┘
       │  OpenAI 兼容 Chat Completions（stream=true） / Anthropic Messages
       │  OpenAI 兼容 /v1/embeddings
┌──────┴────────────┐
│  外部 LLM 服务商   │  qwen / deepseek / openai / claude / custom …
└───────────────────┘
```

数据流向纪律（与 v1 一致并强化）：**前端是唯一的游戏状态持有者**，后端无会话、无数据库；后端每次请求从请求体重建上下文。周目与碎片状态也全部存前端 localStorage。这样做的代价是「后端信任前端传来的状态」，对单机叙事游戏可接受；防篡改只到 CRC 防随手改的程度（默认决策：v2 不引入服务端会话存储，理由是保持零运维成本且游戏无排行榜等对抗性系统）。

---

## 2. 前端模块设计

### 2.1 Store 边界

三个 store 的职责切分原则：**gameStore 只知道「今晚」，loopStore 只知道「哪一晚、第几圈」，fragmentStore 只知道「有哪些碎片、给谁看过」**。互相不读对方 state，跨界只通过 action 显式调用。

| Store | 文件 | 生命周期 | 持有状态 | 谁写它 |
| --- | --- | --- | --- | --- |
| gameStore（改造） | `src/store/gameStore.ts` | 一夜（NPC 对话开始→结局） | 句数、消息、NPC 状态标签、情绪、审查态、当夜结局 | NightView 交互、`LLMService` 回包 |
| fragmentStore（新增） | `src/store/fragmentStore.ts` | 全局（跨周目） | 已获得碎片、每碎片对每 NPC 的本周目出示记录、继承选择 | 夜结局发碎片、出示流程、周目结算 |
| loopStore（新增） | `src/store/loopStore.ts` | 全局（跨周目） | 周目号、当前夜索引、各夜有损摘要、全局旗标、终章解锁进度 | `endNight()` 结算、存档载入 |
| settingsStore（保留） | `src/store/settingsStore.ts` | 全局 | 音量、显示、LLM 配置引用 | SettingsView |

关键 action 时序（一夜的生命周期）：

```
StartNight(npcId)                    ── loopStore 给出 npcId/loopNumber/摘要上下文
  └► gameStore.initNight(ctx)        ── 重置句数=10、注入开场白
玩家发言 ×N
  ├► gameStore.sendMessage()         ── 走 /api/chat 流式
  └► fragmentStore.present(fid)      ── 走 /api/fragment-check，结果回调
                                        gameStore.applySentenceDelta(±n)
结局触发
  └► gameStore.finishNight()
       └► loopStore.endNight({npcId, ending, history})
            ├► /api/night-summary 生成有损摘要，写入 loopStore.nightOutcomes
            ├► fragmentStore.grantNightFragments(...)   按结局发碎片
            ├► fragmentStore.resetShownRecords(npcId)   周目内出示记录按规则处理
            └► SaveSystem.saveProfile()                 自动落盘
周目回滚（失败或整环结束）
  └► loopStore.rollbackLoop()
       ├► loopNumber += 1
       ├► fragmentStore.applyInheritance(选中的 ≤3 枚)
       └► gameStore.$reset()
```

「继承上限 3 枚」的选择 UI 在周目回滚演出页（LoopTransitionView）内完成，fragmentStore 只提供 `applyInheritance(ids: string[])` 并做上限校验（超过 3 枚直接抛错，由 UI 层保证不发生）。

### 2.2 场景渲染层

**选型（默认决策）：纯 CSS 动画 + 一个轻量自研 Canvas 2D 粒子层，不引入任何游戏引擎/渲染库（不用 Pixi、Phaser、Three）。**

理由：

1. 场景是固定机位单屏（天台），没有相机、物理、碰撞需求，引擎的 90% 能力用不上，却要付出 300KB+ 体积与学习成本；
2. 视差、霓虹闪烁、呼吸光效都是「少量大图层的变换」，CSS `transform` + `keyframes` 走 GPU 合成层即可 60fps；
3. 唯一 CSS 做不好的，是数百个雨滴/烟雾粒子——给每个粒子建 DOM 节点会打爆样式计算。把**且仅把**粒子收进一个 `<canvas>`，一个 `requestAnimationFrame` 循环统一 tick，代码量约 200–300 行，无依赖。

图层结构（NightView 内的 `SceneLayers.vue`）：

| 层（z 序从低到高） | 内容 | 技术 | 动效 |
| --- | --- | --- | --- |
| L0 远景 | 像素城市天际线、霓虹招牌 | `<img>` + CSS | 视差系数 0.2；霓虹 `keyframes` 闪烁（`opacity`/`filter: drop-shadow`） |
| L1 中景 | 天台地面、NPC 立绘/CG | `<img>`（沿用 `resolveVisualState` 判定结果） | 视差系数 0.5；CG 切换用 CSS cross-fade |
| L2 粒子 | 雨、烟（NPC 烟头 + 烟形句数条挂点）、火星 | `ParticleCanvas.ts`（Canvas 2D） | rAF 统一 tick；每类粒子一个 emitter |
| L3 前景 | 栏杆、雨水反光条 | `<img>` + CSS | 视差系数 1.0 |
| L4 UI | 对话框、烟条、碎片按钮 | Vue 组件 | 不参与视差 |

实现要点：

- 视差输入：桌面端跟随鼠标位移（`pointermove` 节流至 30Hz，位移幅度 ≤ 12px），移动端跟随 `deviceorientation` 或干脆静止（默认决策：移动端静止，理由是陀螺仪权限弹窗破坏氛围）。
- `ParticleCanvas` 接口：`addEmitter(id, config)` / `removeEmitter(id)` / `pause()`；烟形句数条（[2.3](#23-烟形句数条组件)）通过 `addEmitter('cigarette-smoke', {x, y, rate})` 把烟雾挂到自己的火点坐标上。
- 性能护栏：粒子总数硬上限 400；`document.hidden` 时暂停 rAF；`prefers-reduced-motion` 时关闭视差与粒子、保留静态图层（同时满足可访问性）。
- 像素风缩放：所有像素图层容器统一 `image-rendering: pixelated`，按整数倍缩放（设计基准 640×360，×2/×3 适配）。

### 2.3 烟形句数条组件

`CigaretteMeter.vue`，替换 v1 的 `ProgressBar.vue`（顶部剩余回合条）。呼应 Notion 草案「句数 = 烟、烧完即清空」。

| Props / 事件 | 类型 | 说明 |
| --- | --- | --- |
| `sentencesLeft` | `number` | 当前剩余句数 |
| `sentencesMax` | `number` | 本夜句数上限（基础 10 + 已获奖励） |
| `lastDelta` | `-1 \| 0 \| 1 \| 2` | 最近一次句数变化，用于触发演出 |
| `@animation-done` | event | 演出完成，gameStore 据此解锁输入 |

结构与演出（纯 CSS + 粒子挂点）：

- 烟身是一个横向条：`已烧掉部分（烟灰段，灰白抖动纹理） + 火点（橙红辉光，keyframes 呼吸） + 未烧部分（烟纸白）`；烧点位置 = `(max - left) / max`，用 `width` transition（600ms ease-out）推进。
- `+1 句`（语言触动）：烟身末端接长一小段，火点短暂变亮；`+2 句`（碎片命中）：播放「重新点上一根」的两帧像素动画后接长两段；`-1 句`（错误碎片/施压）：火点急烧、烟灰段快进一格并抖落一撮烟灰粒子。
- 火点的世界坐标经 `getBoundingClientRect()` 报给 `ParticleCanvas`，烟雾 emitter 始终从火点冒出；等待 LLM 回复时 emitter `rate` 提高（「她抽了一口」＝思考演出的一部分）。
- 数字兜底：条旁保留 `剩 N 句` 像素字，避免纯图形表意在低视力场景失效。

### 2.4 碎片界面组件

| 组件 | 职责 |
| --- | --- |
| `FragmentView.vue`（路由页） | 碎片背包全览：格子布局，按来源 NPC 分组；周目回滚时复用为「选 3 枚继承」界面（多选态） |
| `FragmentCard.vue` | 单枚碎片：像素图标、名称、一句话摘要、来源夜标记、「本周目已对某人出示」角标 |
| `FragmentPresentSheet.vue` | 对话中的出示抽屉：NightView 底部上滑，仅列出「本周目未对当前 NPC 出示过」的碎片；确认后走出示流程 |
| `FragmentRevealToast.vue` | 判定反馈演出：命中（烟条+2 演出 + NPC 回应）/ 中性 / 偏差（审查或幻觉演出入口） |

出示流程时序（前端视角）：

```
玩家点「出示」→ FragmentPresentSheet 确认
  1. gameStore.isWaiting = true，播放占位反应（0ms）
  2. POST /api/fragment-check（不消耗句数；句数变化由响应决定）
  3. 响应 verdict:
     hit     → gameStore.applySentenceDelta(+2)；把「出示事件」作为一条
               系统消息追加进 history（见 4.5 消息结构），下一轮 /api/chat
               会把碎片内容注入 NPC 上下文
     neutral → 句数不变；NPC 用预写的敷衍反应回应（响应自带 reaction 文本）
     miss    → gameStore.applySentenceDelta(-1)；按响应 performance 字段
               播放审查官腔或记忆幻觉演出（预写内容，见 3.5）
  4. fragmentStore.markShown(fragmentId, npcId)  —— 本周目锁定
```

### 2.5 打字机与流式输出的衔接

v1 的 `TypewriterText.vue` 接收完整字符串后按固定间隔逐字显示。v2 改成「**缓冲区消费者**」：

- 新增 `src/modules/StreamBuffer.ts`：一个环形字符缓冲。`append(chunk)` 由 SSE 消费循环调用；`drain(n)` 由打字机的 tick 调用；`finish()` 标记流结束。
- `TypewriterText.vue` 增加 `mode: 'static' | 'stream'`。stream 模式下不再拿完整文本，而是每 tick 从 StreamBuffer 取 1 字符渲染；缓冲深度自适应节奏见 [7.2](#72-前端缓冲策略)。
- 机制结果（evaluation 帧）到达时**不立刻应用**：先存 `pendingEvaluation`，等打字机把缓冲排空（`finish()` 且 drain 完）后由 gameStore 统一应用——避免「字还没打完，CG/烟条先变了」的剧透。结局标签同理，排空后才触发结局演出。

---

## 3. 后端服务设计

### 3.1 /api/chat v2 改造

v1 的 `HandleChat` 是「单角色（艾）+ 固定 Prompt + 非流式」。v2 改造点有三：

**a) 多 NPC。** 请求体新增 `npc_id`；后端用它从内容库取 `NpcConfig`（[4.4](#44-npcconfig)），装配该 NPC 的 persona prompt。`buildMainSystemPrompt(...)` 重构为 `assembleNpcPrompt(npc NpcConfig, night NightContext) string`，硬编码的艾人设文本全部迁入 `content/npc/ai/persona.json`（艾章即 v1 Prompt 的世界观化改写，见 [05 册](05_demo_ai_blueprint.md)）。

**b) 状态注入。** 请求体新增周目上下文，Prompt 装配时注入三类信息：

| 注入项 | 来源 | 进入 Prompt 的形式 |
| --- | --- | --- |
| 当夜状态 | `night`（句数、NPC 状态标签、审查态、已出示碎片） | 「当前状态」段，同 v1 模式 |
| 跨夜摘要 | `loop.night_summaries`（各 ≤ 200 字的有损摘要） | 「你隐约记得的往夜」段；只注入与当前 NPC 有关的条目 |
| 命中碎片 | history 中的出示事件消息（[4.5](#45-tagprotocolv2-消息结构)） | 保留在消息流里，模型自然读到 |

**c) 温度控制。** 采样温度不再固定 0.8，由后端按 NPC 当前状态标签查 `NpcConfig.temperature_map` 得出（温度=精神状态）。默认映射（具体每 NPC 可在配置里覆写，数值语义归 [02 册](02_gameplay_systems.md)/[04 册](04_prompt_architecture.md)）：

| NPC 状态 | 温度默认值 |
| --- | --- |
| guarded / watching | 0.7 |
| wavering / turnBack | 0.8 |
| edge（临界崩溃） | 1.0 |
| censored（审查接管） | 0.3（官腔要死板） |

判定器（judge）调用保持独立、恒温 0.2，输出 `TurnEvaluationV2`（[4.5](#45-tagprotocolv2-消息结构)）。

**d) 流式。** `/api/chat` 支持 `stream: true`，以 SSE 帧写出（[第 7 节](#7-流式输出方案)）；`stream` 缺省或 false 时保持 v1 的 JSON 响应形态，作为降级与测试通道。流式时序：主回复 token 逐帧推送 → 主回复结束后**同一连接内**追加判定器结果帧 → `done` 帧。判定器在主回复生成完成后才调用（它需要完整回复文本），这段延迟被打字机排空时间天然覆盖。

请求体（v2，snake_case 与 v1 一致）：

```json
{
  "npc_id": "ai",
  "user_message": "你手里的打火机，刻的是谁的名字？",
  "history": [ { "role": "assistant", "content": "……" } ],
  "night": {
    "sentences_left": 6, "sentences_max": 11, "boost_count": 1,
    "npc_state": "watching", "censor_active": false,
    "presented_fragment_ids": ["frag_lighter"]
  },
  "loop": {
    "loop_number": 3,
    "night_summaries": [ { "npc_id": "ai", "summary": "……(≤200字)", "ending": "night_saved" } ],
    "global_flags": ["knows_wan_name"]
  },
  "stream": true,
  "provider": "qwen", "api_key": "", "model": "", "base_url": ""
}
```

### 3.2 /api/fragment-check

新增接口：判定「玩家此刻向该 NPC 出示的碎片」与「NPC 当前情绪锚点」的相关性，返回三档结论与演出指令。**不走流式**（判定快、响应小）。

请求：

```json
{
  "npc_id": "ai",
  "fragment_id": "frag_retention_page",
  "fragment_text": "挽留员系统提示词残页：『……为每位对象分配十句上下文……』",
  "npc_state": "wavering",
  "recent_context": [
    { "role": "assistant", "content": "我有时候分不清，拍过的照片是我的记忆，还是芯片替我记的。" },
    { "role": "user", "content": "那你为什么还在拍？" }
  ],
  "loop_number": 3,
  "provider": "qwen", "api_key": "", "model": "", "base_url": ""
}
```

响应：

```json
{
  "verdict": "hit",
  "method": "embedding",
  "similarity": 0.74,
  "matched_anchor_id": "anchor_ai_memory_loss",
  "sentence_delta": 2,
  "feedback_tag": "[碎片:命中]",
  "reaction": "她盯着那页纸，烟灰忘了弹。「十句……原来不是我数错了。」",
  "performance": null
}
```

miss 时的响应差异：`verdict:"miss"`、`sentence_delta:-1`、`feedback_tag:"[碎片:偏差]"`，且 `performance` 给出演出指令：

```json
{
  "verdict": "miss",
  "method": "embedding",
  "similarity": 0.21,
  "matched_anchor_id": null,
  "sentence_delta": -1,
  "feedback_tag": "[碎片:偏差]",
  "reaction": "",
  "performance": { "kind": "censor", "content_id": "censor_ai_002",
                   "text": "根据缪斯健康协议，该话题不利于当前情绪恢复。我们聊点别的。" }
}
```

判定流程（后端内部）：

1. 取该 NPC 当前状态对应的锚点集合（`content/npc/<id>/anchors.json`，每条锚点是一段 80–150 字的创伤语义文本 + id）；
2. 对 `fragment_text` 与每条锚点取 embedding，算余弦相似度，取最大值 `s`；
3. 双阈值三档：`s ≥ HIT_T` → hit；`s < MISS_T` → miss；其间 → neutral。默认 `HIT_T = 0.62`、`MISS_T = 0.40`（默认决策：以 qwen text-embedding-v3 的分布为基准给初值，M1 用艾章碎片×锚点全组合跑一遍校准表后调参，校准清单见 [05 册](05_demo_ai_blueprint.md)）；
4. `sentence_delta` 由档位直接映射（+2 / 0 / -1，与 [README 句数经济](README.md#句数经济数值基线)一致），`reaction` / `performance` 从内容库按 `matched_anchor_id` 或 miss 类型取预写文本；
5. 「同一碎片对同一 NPC 每周目一次」由前端 fragmentStore 保证，后端不重复校验（无会话）。

### 3.3 /api/night-summary

新增接口：一夜结束后生成「有损摘要」，作为跨周目记忆注入下一夜/下一周目。两段式：先让模型做真实摘要，再由后端按失真等级做受控改写（失真规则与文案语气归 [04 册](04_prompt_architecture.md)）。

请求：

```json
{
  "npc_id": "zhou",
  "loop_number": 3,
  "ending": "night_saved",
  "history": [ { "role": "user", "content": "……" } ],
  "boost_count": 2,
  "distortion_level": 1,
  "provider": "qwen", "api_key": "", "model": "", "base_url": ""
}
```

`distortion_level`：0 = 忠实（当前周目刚结束时展示用）；1 = 轻度失真（隔 1 个周目）；2 = 重度失真（隔 ≥2 周目，镜章/苏晚章会主动利用失真做谜题）。等级由前端 loopStore 按「摘要生成时间距今几个周目」重算并在需要时重新请求改写。

响应：

```json
{
  "summary": "他骂了一整夜公司。你记得他提过一份日志……或者是一张工牌？总之他最后没有跳。",
  "kept_fact_ids": ["zhou_badge", "zhou_no_jump"],
  "distorted_fact_count": 1,
  "distortion_level": 1
}
```

`kept_fact_ids` 用于终章「拼回真相」的比对（前端只存不显）。摘要长度硬上限 200 字，超出由后端截断——这是跨周目上下文成本的天花板（[8.1](#81-上下文裁剪策略)）。

### 3.4 Embedding provider 抽象与降级

新增 `backend/embedding/` 包：

```
embedding/
├── provider.go    // 接口 + OpenAI 兼容实现
├── fallback.go    // LLM 判定器降级
└── cache.go       // 锚点向量进程内缓存
```

接口（Go）：

```go
type Provider interface {
    // Embed 返回每段文本的向量；OpenAI 兼容 POST {base_url}/v1/embeddings
    Embed(texts []string) ([][]float32, error)
    Available() bool
}
```

- 配置走 `config.go` 新增环境变量：`EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL`（默认 `text-embedding-v3`，DashScope OpenAI 兼容端点；默认决策：embedding 只用服务器 Key，不让玩家自带——判定一致性比自由度重要，且 embedding 成本极低）。
- 锚点向量在服务启动时全量预计算并缓存在内存（`cache.go`；锚点总量 < 100 条，冷启动 1 次批量调用即可），每次判定只需对碎片文本取 1 次 embedding。
- **降级路径**：`Available() == false`（未配置）或 Embed 调用失败时，`fragment-check` 自动切到 `fallback.go` 的 LLM 判定器——用对话主模型、温度 0，输入「碎片文本 + 该 NPC 当前锚点列表」，要求只输出 `{"verdict":"hit|neutral|miss","matched_anchor_id":"...|null"}`；解析失败再降一档返回 `neutral`（句数不变，永不因技术故障扣玩家句数）。响应里的 `method` 字段标明 `embedding` / `llm_judge` / `fallback_neutral`，便于调试与埋点。

### 3.5 预写内容库

审查官腔、记忆幻觉、提示词残页都是**预写受控内容**（[README 技术基线](README.md#技术基线)），不依赖模型真实越狱。统一放 `backend/content/`，`go:embed` 编译进二进制（默认决策：选 go:embed 而非运行时读目录，理由是部署仍是单二进制、内容不可被服务器上随手改动；内容更新走代码发版，与「内容即规则」的定位一致）。

```
backend/content/
├── npc/
│   ├── ai/
│   │   ├── persona.json          // 人设 Prompt 分段（世界观段引用 shared/）
│   │   ├── anchors.json          // 情绪锚点：[{id, state_scope, text}]
│   │   ├── hallucinations.json   // 记忆幻觉库：[{id, trigger, text}]
│   │   ├── censor.json           // 审查官腔库：[{id, text}]
│   │   └── config.json           // NpcConfig（4.4）
│   ├── zhou/ … tong/ … xia/ … jing/ … suwan/ … linmo/
│   └── shared/
│       ├── world.json            // 世界观公共段
│       └── pages.json            // 提示词残页（夏章泄露内容等，全局资产）
└── loader.go                     // 启动时 Unmarshal + 校验（缺字段/空锚点直接 panic）
```

- 前端需要展示的碎片图鉴文案（名称、摘要、图标路径）放前端 `src/content/fragments.ts`；后端只关心 `fragment_text`（判定用原文，由前端随请求传上来，避免双端同步碎片正文）。
- `loader.go` 在 `main.go` 启动时执行完整性校验：每个 NPC 必须有 persona + 至少 1 条锚点 + 至少 2 条审查官腔；校验失败拒绝启动，把内容错误挡在部署前。

### 3.6 路由总表（v2）

| 路由 | 方法 | 状态 | 说明 |
| --- | --- | --- | --- |
| `/api/health` | GET | 保留 | 不变 |
| `/api/chat` | POST | 改造 | 多 NPC + 状态注入 + 温度映射 + SSE 流式 |
| `/api/hint` | POST | 改造（小） | 请求体加 `npc_id`，提示 Prompt 按 NPC 装配 |
| `/api/fragment-check` | POST | 新增 | 碎片相关性三档判定 |
| `/api/night-summary` | POST | 新增 | 有损摘要生成与失真改写 |
| `/api/chat-after` | POST | 保留 | 艾章后日谈沿用；其余章节是否有后日谈由 [02 册](02_gameplay_systems.md) 决定 |
| `/api/ending-summary` | POST | 保留 | 局后复盘沿用，请求体加 `npc_id` |

---

## 4. 数据模型

命名约定沿用现状：TS 侧 camelCase，JSON 传输与 Go tag 用 snake_case，双端契约常量分别进 `gameContract.ts` 与 `game_contract.go`。以下为核心五组模型的双份定义（TS 放 `src/domain/`，Go 放 `backend/llm/` 与 `backend/content/`）。

### 4.1 Fragment

碎片分「定义」（静态内容）与「状态」（玩家持有），定义在前端内容文件，状态在 fragmentStore/存档。

```ts
// src/domain/fragment.ts
export interface FragmentDef {
  id: string;                       // 'frag_lighter'
  name: string;                     // 刻字打火机
  kind: 'photo' | 'recording' | 'badge' | 'log' | 'page' | 'data' | 'message';
  sourceNpcId: string;              // 从哪一夜获得
  isKeyFragment: boolean;           // 主线 6 枚之一
  summary: string;                  // 图鉴一句话
  fragmentText: string;             // 出示时送去判定的正文
  iconAsset: string;                // 像素图标路径
}

export interface FragmentState {
  id: string;
  acquiredAtLoop: number;
  acquiredAtNight: string;          // npcId
  shownThisLoop: Record<string, true>;  // 本周目已对哪些 NPC 出示（周目回滚时清空）
}
```

```go
// backend/content/model.go —— 后端只需要判定视角的碎片，不存状态
type FragmentPayload struct {
    FragmentID   string `json:"fragment_id"`
    FragmentText string `json:"fragment_text"`
}
```

### 4.2 NightState

```ts
// src/domain/gameState.ts（改造 GameState 而来）
export interface NightState {
  npcId: string;
  sentencesLeft: number;
  sentencesMax: number;             // 10 + 累计奖励
  boostCount: number;               // 好感事件次数（沿用 affectionBoostCount 语义）
  npcState: NpcStateType;           // 状态标签（集合见 04 册）
  emotion: EmotionType | null;
  censorActive: boolean;
  messages: TaggedMessage[];        // 见 4.5
  presentedFragmentIds: string[];
  isWaiting: boolean;
  isEnding: boolean;
  nightEnding: NightEndingType | null;   // 每夜结局枚举，见 02 册
  endingSummary: EndingSummary | null;
}
```

```go
// backend/handlers/game.go —— 请求体中的当夜上下文
type NightContext struct {
    SentencesLeft         int      `json:"sentences_left"`
    SentencesMax          int      `json:"sentences_max"`
    BoostCount            int      `json:"boost_count"`
    NpcState              string   `json:"npc_state"`
    CensorActive          bool     `json:"censor_active"`
    PresentedFragmentIDs  []string `json:"presented_fragment_ids"`
}
```

### 4.3 LoopState

```ts
// src/domain/loopState.ts
export interface NightOutcome {
  npcId: string;
  loopNumber: number;
  ending: NightEndingType;
  summary: string;                  // 有损摘要（当前失真版本）
  keptFactIds: string[];
  distortionLevel: 0 | 1 | 2;
}

export interface LoopState {
  loopNumber: number;               // 从 1 起
  currentNightIndex: number;        // 0=艾 … 5=苏晚，6=终章
  nightOutcomes: NightOutcome[];    // 只保留摘要，不保留原始对话
  globalFlags: string[];            // 'knows_wan_name' 等跨周目旗标，集合见 02 册
  inheritedFragmentIds: string[];   // 本周目带入的 ≤3 枚
  finaleUnlocked: boolean;
}
```

```go
// backend/handlers/game.go —— 请求体中的周目上下文（后端只读）
type LoopContext struct {
    LoopNumber     int            `json:"loop_number"`
    NightSummaries []NightSummary `json:"night_summaries"`
    GlobalFlags    []string       `json:"global_flags"`
}

type NightSummary struct {
    NpcID   string `json:"npc_id"`
    Summary string `json:"summary"`
    Ending  string `json:"ending"`
}
```

### 4.4 NpcConfig

后端内容库模型（`content/npc/<id>/config.json`）：

```go
// backend/content/model.go
type NpcConfig struct {
    ID             string             `json:"id"`              // "ai"
    Name           string             `json:"name"`            // "艾"
    StageLabel     string             `json:"stage_label"`     // "否认"
    InitialState   string             `json:"initial_state"`   // "guarded"
    PersonaRef     string             `json:"persona_ref"`     // persona.json
    AnchorScopes   map[string][]string `json:"anchor_scopes"`  // state → 锚点id列表
    TemperatureMap map[string]float64 `json:"temperature_map"` // state → 采样温度
    CensorTopics   []string           `json:"censor_topics"`   // 触发审查的话题标签（语义见 04 册）
    OpeningLines   []string           `json:"opening_lines"`   // 开场白池（循环=重新采样）
}
```

```ts
// 前端只需要展示子集，src/content/npcs.ts
export interface NpcView {
  id: string; name: string; stageLabel: string;
  thinkActions: string[];           // 人设化思考动作文案池（占位反应用）
  sceneAssets: { base: string; states: Record<string, string> };
}
```

### 4.5 TagProtocolV2 消息结构

消息在 v1 `Message{role, content}` 基础上扩展一个可选的 `meta`，用于把「出示碎片」等**事件**放进对话流（后端装配 Prompt 时会把事件消息改写成叙述句注入）：

```ts
// src/domain/gameState.ts
export interface TaggedMessage {
  role: 'user' | 'assistant' | 'event';
  content: string;                  // event 时为事件的叙述文本
  meta?: {
    eventType?: 'fragment_present' | 'censor_break' | 'prompt_leak';
    fragmentId?: string;
    tags?: string[];                // 该条回复解析出的标签快照（回放/调试用）
  };
}

export interface TurnEvaluationV2 {
  emotion: TurnEmotionType;
  npcState: NpcStateType;
  sentenceDelta: -1 | 0 | 1 | 2;    // 取代 v1 affectionDelta/pressureDelta 双字段
  boostTriggered: boolean;          // 好感事件（+1 句的来源），沿用 v1 判定语义
  censorEvent: 'none' | 'triggered' | 'lifted';
  fragmentFeedback: 'none' | 'hit' | 'neutral' | 'miss';
  endingType: NightEndingType | null;
  confidence: number;               // 0–1
}
```

```go
// backend/llm/service.go
type TaggedMessage struct {
    Role    string       `json:"role"`
    Content string       `json:"content"`
    Meta    *MessageMeta `json:"meta,omitempty"`
}

type MessageMeta struct {
    EventType  string   `json:"event_type,omitempty"`
    FragmentID string   `json:"fragment_id,omitempty"`
    Tags       []string `json:"tags,omitempty"`
}

type TurnEvaluationV2 struct {
    Emotion          string  `json:"emotion"`
    NpcState         string  `json:"npc_state"`
    SentenceDelta    int     `json:"sentence_delta"`
    BoostTriggered   bool    `json:"boost_triggered"`
    CensorEvent      string  `json:"censor_event"`    // none|triggered|lifted
    FragmentFeedback string  `json:"fragment_feedback"` // none|hit|neutral|miss
    EndingType       *string `json:"ending_type"`
    Confidence       float64 `json:"confidence"`
}
```

后端发给客户端前照旧做 clamp（`sentenceDelta` 只允许 {-1,0,1,2}，结局需过阈值校验），前端照旧做 normalize——**双端都不信任对方**的防御式解析沿用 v1（`clampTurnEvaluation` / `normalizeTurnEvaluation` 各自升级为 v2 版本）。

### 4.6 契约常量同步

沿用现有模式：`backend/llm/game_contract.go` 与 `legacy_vue/src/domain/gameContract.ts` 各持一份、人工同步。v2 追加内容（常量名与标签见[第 5 节](#5-标签协议-v2传输与解析层)）后，在 M0 加一道**契约一致性测试**：Go 测试把契约常量导出为 JSON 快照（`go test` 生成 `contract_snapshot.json`），前端 Vitest 断言 TS 契约与快照逐项相等——把「人工同步」降级为「忘了同步会挂 CI」（默认决策：不做代码生成器，快照比对实现成本 1/10，收益相同）。

---

## 5. 标签协议 v2（传输与解析层）

分工声明：**本节只定义标签的字面形式、传输通道、解析与清洗规则**。每个标签什么时候出、语义边界、Prompt 怎么约束模型，见 [04 册](04_prompt_architecture.md)。

### 5.1 双通道原则

| 通道 | 载体 | 地位 |
| --- | --- | --- |
| 主通道 | 判定器 `TurnEvaluationV2` JSON（SSE 的 `evaluation` 帧） | 唯一权威的机制结果来源 |
| 兼容通道 | 正文内联标签（如 `[状态:动摇]`） | 降级兜底：模型偶发在正文里吐标签时，前端 strip 显示、后端 strip 后再送判定器；内联标签**不驱动**机制 |

即：v2 的标签表首先是「契约常量 + JSON 字段枚举」，字面标签形式保留是为了（a）与 v1 资产/Prompt 兼容，（b）正文清洗有据可查，（c）调试时人类可读。

### 5.2 标签总表

| 类别 | 标签字面形式 | v1/v2 | JSON 权威字段 | 传输说明 |
| --- | --- | --- | --- | --- |
| 状态 | `[状态:戒备]` `[状态:观察]` `[状态:动摇]` `[状态:回身]` `[状态:临界]` | 保留 | `npc_state` | 状态集合按 NPC 可扩展，扩展槽位见 04 册 |
| 情绪 | `[情绪:刺痛]` `[情绪:惊讶]` `[情绪:柔软]` `[情绪:好奇]` | 保留 | `emotion` | 不变 |
| 结局 | `[结局:死亡]` `[结局:消失]` `[结局:相识]` + v2 每夜结局新枚举 | 保留+扩展 | `ending_type` | 每夜结局枚举值由 [02 册](02_gameplay_systems.md) 定，传输层只透传字符串 |
| 句数 | `[句数:+1]` `[句数:+2]` `[句数:-1]` | 新增 | `sentence_delta` | 取代 v1 `[好感度+5]` 的机制职能；`[好感度+5]` 进清洗名单但不再产生机制效果 |
| 好感事件 | `[触动]` | 新增 | `boost_triggered` | 标记「语言真正触动」事件本身（+1 句由 `sentence_delta` 承载，避免双计） |
| 审查 | `[审查:触发]` `[审查:解除]` | 新增 | `censor_event` | 触发时前端切审查演出态（官腔字体/滤镜），解除时还原 |
| 碎片反馈 | `[碎片:命中]` `[碎片:中性]` `[碎片:偏差]` | 新增 | `fragment_feedback`（chat 通道）/ `feedback_tag`（fragment-check 响应） | fragment-check 是主要来源；chat 通道字段用于「上一轮出示的碎片在本轮对话被 NPC 回应」的联动演出 |

### 5.3 解析与清洗规则

1. **清洗名单**：`stripKnownMechanicTags`（Go）与前端正则组升级，覆盖上表全部字面形式 + v1 遗留 `[好感度+5]`；另保留 v1 的通配清洗 `\[状态:.*?\]` / `\[情绪:.*?\]` / `\[结局:.*?\]`，并新增 `\[句数:.*?\]` / `\[审查:.*?\]` / `\[碎片:.*?\]` / `\[触动\]`——模型编造未知标签值时也能洗干净。
2. **流式清洗**：标签可能被 token 边界劈开（如 `[状` + `态:动摇]`）。SSE 消费侧的 StreamBuffer 在 drain 前做**滞留窗口**：遇到未闭合的 `[` 时暂扣该段不渲染，直到闭合 `]`（判断是否标签，是则丢弃）或缓冲超 16 字符（判定不是标签，放行）。后端不做流中清洗（无状态透传），清洗责任在前端；非流式响应仍由后端清洗，双保险。
3. **解析优先级**：`evaluation` 帧到达 → 权威结果；帧缺失（判定器失败）→ 后端已发 `DefaultTurnEvaluationV2`（全零安全值）；连这也没有（网络中断）→ 前端本地构造默认值。任何路径下机制字段都经 normalize 白名单过滤。

---

## 6. 存档 v2

### 6.1 localStorage 结构

沿用 `SaveSystem` 的封包格式（JSON → CRC32 → Base64 → 槽对象），新增键如下：

| Key | 内容 | 写入时机 |
| --- | --- | --- |
| `damo_v2_profile` | `{version: 2, loop: LoopState, fragments: FragmentState[], achievements, checksum}` | 每夜结束、周目回滚、终章推进时自动写；**唯一进度真相** |
| `damo_v2_night_auto` | 当夜 `NightState` 快照（含消息） | 每回合结算后写；夜结束即清除。用于「刷新页面回到当夜当轮」 |
| `damo_save_1..3` | 手动槽，payload `kind` 新增 `'game_v2'`（`{profile快照 + night快照}`） | 玩家手动存档；兼容读取 v1 `kind:'game'` 与 `'chatAfter'` |
| `damo_llm_*` | LLM 配置（不变） | 设置页 |
| `damo_settings_v1` | 音量/显示等 UI 设置统一收口（[第 10 节](#10-工程收口m0)） | 设置页 |

设计要点：

- 进度（profile）与手动槽分离：循环叙事下「读档回到旧周目」会破坏碎片继承逻辑，所以手动槽读档只允许恢复到**该槽所在周目的当夜开头**（快照里存的是夜开头状态，默认决策：不支持回合级手动读档，防 S/L 刷判定，也与「回滚是叙事事件」的世界观一致）。
- CRC32 沿用 `crc-32` 包；`damo_v2_profile` 的 checksum 校验失败时不静默清档，弹「记忆损坏」剧情化提示并提供重置入口。

### 6.2 v1 存档迁移

启动时 `SaveMigration.ts`（新增模块）执行一次：

| v1 数据 | 迁移动作 | 理由 |
| --- | --- | --- |
| `damo_save_*`（kind:game，v1 玩法进度） | 不转换为 v2 进度；重命名为 `damo_v1_archived_*` 保留原文 | v1 的一局对话与 v2 周目结构不同构，硬转必错 |
| v1 存档中 `endingType === 'end_acquaintance'` | 在新 profile 写全局旗标 `v1_ai_acquaintance`，艾章首夜解锁一句彩蛋台词（内容见 [05 册](05_demo_ai_blueprint.md)） | 给老玩家一个「她记得你」的回响，成本一行旗标 |
| `damo_save_*`（kind:chatAfter） | 原样保留、后日谈页继续可读 | 后日谈数据结构 v2 未变 |
| 成就（AchievementTracker 存储） | 原样保留 | 键不冲突 |
| `damo_llm_*` 配置 | 原样保留 | 键不变 |

迁移是幂等的：以 `damo_v2_profile.migratedFromV1` 旗标防重跑。

---

## 7. 流式输出方案

### 7.1 选型：POST fetch 流式 + SSE 帧格式

| 维度 | 原生 SSE（EventSource） | fetch + ReadableStream |
| --- | --- | --- |
| 请求方法 | 仅 GET，状态只能塞 URL | 任意，直接复用现有 POST JSON 请求体 |
| 自定义头 / 请求体 | 不支持 | 支持 |
| 自动重连 | 内建 | 需自写（本场景不需要：断了这轮直接走错误兜底） |
| 浏览器兼容 | 全绿 | 全绿（目标浏览器均支持） |
| Nginx 透传 | 需关缓冲 | 同样需关缓冲 |

**默认决策：客户端用 `fetch` + `ReadableStream` 消费；响应体采用 SSE 帧文法（`text/event-stream`，`event:`/`data:` 行）**。理由：请求侧必须带完整 JSON 状态（EventSource 做不到）；响应侧沿用 SSE 文法可白嫖成熟的逐帧语义、Nginx/中转链路对 `text/event-stream` 的既有处理惯例，且抓包可读。后端 `llm/stream.go` 封装帧写出（`gin` 下 `c.Writer.Flush()` 逐帧刷），响应头带 `X-Accel-Buffering: no` + `Cache-Control: no-cache` 关闭代理缓冲。

帧序列：

```
event: delta        data: {"text":"过去"}          ← 若干帧，text 为增量 token
event: delta        data: {"text":"就像昨天的雨"}
event: evaluation   data: {TurnEvaluationV2 JSON}   ← 主回复结束、判定完成后 1 帧
event: done         data: {}
（异常时）
event: error        data: {"message":"…","fallback_reply":"（她沉默了一会儿…）"}
```

上游调用：对 OpenAI 兼容 Provider 透传 `"stream": true` 并转写 chunk；Anthropic Provider 同理消费其 SSE。**Provider 不支持流式或流式中途失败时**，后端退回非流式调用，把完整回复一次性作为单个 `delta` 帧发出——前端无感知（打字机本来就会慢慢放）。

### 7.2 前端缓冲策略

打字机是天然的「匀速消费者」，把网络的突发抹平：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| 基准 drain 速率 | 45ms/字 | 中文叙事的舒适阅读节奏 |
| 加速阈值 | 缓冲 > 30 字 | 降到 25ms/字（追赶，避免尾部拖沓） |
| 二次加速 | 缓冲 > 80 字 | 降到 12ms/字 |
| 起播门槛 | 首帧到达即起播 | 不做预缓冲——首字上屏时间就是体感延迟 |
| 标签滞留窗口 | 16 字符 | 见 [5.3](#53-解析与清洗规则) |
| 流结束 | `done` 帧后按当前速率排空，排空后应用 pendingEvaluation | 见 [2.5](#25-打字机与流式输出的衔接) |

### 7.3 零延迟占位反应的触发时序

三层叠加（[README 延迟处理优先级](README.md#技术基线)：流式 + 占位 + 人设动作）：

| 时刻 | 动作 | 来源 |
| --- | --- | --- |
| T+0ms（玩家点发送） | 立即上屏一条**非语言占位**：从当前 NPC 的 `thinkActions` 池随机取（艾：「她把烟送到嘴边，火点亮了一下。」）；同时烟条 emitter 加速冒烟 | 前端本地，零请求 |
| T+0ms | 并发发起 `/api/chat` 流式请求 | — |
| 首 delta 帧到达 | 占位文案淡出，打字机起播 | StreamBuffer |
| T+2500ms 仍无首帧 | 追加第二段占位（等待文案池，沿用 v1 `WAITING_TEXTS` 风格、按 NPC 定制） | 前端定时器 |
| T+60s 无帧（超时） | 断流处理：展示 `error` 帧兜底文案或本地兜底句，**不消耗**本轮句数（句数回滚 1） | 前端 |

占位反应永不进入 `history`（它是演出不是对白），也不占句数。

---

## 8. 成本与性能

### 8.1 上下文裁剪策略

v2 的会话结构天然限长，**不需要**通用的滑动窗口裁剪：

1. **每夜独立会话**：history 只含当夜消息，上限 ≈ 15 轮（10 基础 + 5 奖励上界），单夜 history 峰值 ≈ 1200 汉字；
2. **跨夜只传摘要**：夜一结束，原始对话只留在存档供回放，进模型的只有 ≤200 字的有损摘要 × 已完成夜数（≤6 条），峰值 1200 字；
3. **周目回滚即清零**：回滚后 history 清空，摘要按继承规则重算；
4. Prompt 装配器对注入段做硬上限（persona ≤ 1800 字、往夜摘要合计 ≤ 1200 字、状态段 ≤ 300 字），超限截断并打日志——防内容库膨胀导致成本爬坡。

### 8.2 Token 预算估算表

估算口径：1 汉字 ≈ 0.75 token（qwen 系）；单夜 12 轮（含奖励）；每轮 = 1 次主对话 + 1 次判定器；每夜另有 2 次碎片判定、1 次夜摘要、1 次提示。

| 调用 | 输入 token/次 | 输出 token/次 | 次数/夜 | 小计/夜 |
| --- | --- | --- | --- | --- |
| 主对话（persona 1.4k + 状态 0.3k + 摘要 0.6k + history 均值 0.5k + 输入 0.05k） | ≈ 2,850 | ≈ 90 | 12 | 34.2k in / 1.1k out |
| 判定器（裁判 prompt 0.7k + 本轮上下文 0.6k） | ≈ 1,300 | ≈ 60 | 12 | 15.6k in / 0.7k out |
| fragment-check（embedding 路径） | ≈ 200（embedding 计费） | — | 2 | 0.4k |
| night-summary | ≈ 1,600 | ≈ 250 | 1 | 1.6k in / 0.25k out |
| hint | ≈ 900 | ≈ 40 | 1 | 0.9k in |
| **单夜合计** | | | | **≈ 53k in / 2.1k out** |

| 场景 | 夜数（含重玩） | 总量估算 | 参考成本（qwen-plus 档，¥0.8/M in、¥2/M out） |
| --- | --- | --- | --- |
| 单周目（一夜，30–45min） | 1 | ≈ 55k | ≈ ¥0.05 |
| 一整环（6 夜 + 终章） | 7 | ≈ 0.39M | ≈ ¥0.33 |
| 全通关（2–3h，含 1–2 次周目重玩） | ≈ 12 | ≈ 0.66M | **≈ ¥0.55 / 玩家** |

结论：全通关成本按 flash/plus 档模型控制在 1 元人民币以内，兜底 Key 可以放心开放试玩；若上更强模型（×10 价），限流参数相应收紧即可。

### 8.3 兜底 Key 限流

新增 Gin 中间件 `middleware/ratelimit.go`，**只对「玩家未自带 Key、走服务器 Key」的请求生效**（自带 Key 请求不限）：

| 参数 | 默认值 | 环境变量 |
| --- | --- | --- |
| 每 IP 令牌桶 | 容量 4，回填 1 个/4s | `RATE_BURST` / `RATE_REFILL_SECONDS` |
| 每 IP 日配额 | 800 次请求（≈ 3 次全通关） | `RATE_DAILY_CAP` |
| 全局日配额 | 40,000 次（保护账单） | `RATE_GLOBAL_DAILY_CAP` |
| 超限响应 | HTTP 200 + 剧情化兜底（「缪斯网络拥塞，稍等片刻再开口。」）+ `rate_limited: true` 字段 | — |

实现为进程内存（`map[ip]*bucket` + 每日零点重置 goroutine），不引 Redis——后端目前单实例部署，横向扩容时再换存储（默认决策：不为未发生的规模引入组件）。超限走 HTTP 200 剧情化文案是沿用 v1「技术状态不进对白、错误也给兜底回复」的既有约定；`rate_limited` 字段让前端可另行弹「填自己的 Key 解除限制」的引导。

---

## 9. 测试策略

现状：前端 Vitest 2 文件 4 用例（gameStore 初始化/重置、SaveSystem 存/读/篡改），后端无测试。v2 扩展清单：

| # | 测试 | 端 | 覆盖点 |
| --- | --- | --- | --- |
| 1 | 判定器解析单测 | Go `llm/judge_test.go` | `TurnEvaluationV2` 的 parse/clamp：非法枚举、越界 delta、markdown 包裹 JSON、劣质输出降级到 Default |
| 2 | 碎片判定阈值单测 | Go `embedding/provider_test.go` | 双阈值三档分界（含边界值 s=HIT_T、s=MISS_T）；余弦计算正确性 |
| 3 | 判定降级路径单测 | Go `embedding/fallback_test.go` | embedding 不可用→LLM 判定器；LLM 输出不可解析→neutral 兜底（永不扣句） |
| 4 | 内容库加载校验 | Go `content/loader_test.go` | 全 NPC 配置可解析、必填段齐全、锚点非空——内容错误在 CI 挡下 |
| 5 | 限流中间件单测 | Go `middleware/ratelimit_test.go` | 桶回填、日配额、自带 Key 豁免、剧情化响应体 |
| 6 | SSE 帧写出/解析 | Go + 前端 | 后端帧文法正确；前端 StreamBuffer 对劈开的标签滞留清洗、加速档位切换 |
| 7 | 标签解析测试 | 前端 `tagProtocol.spec.ts` | 5.2 全表标签的 strip 与通配清洗、未知标签值不泄漏到 UI |
| 8 | 契约一致性测试 | 双端（[4.6](#46-契约常量同步)） | Go 快照 ↔ TS 契约逐项相等 |
| 9 | 存档迁移测试 | 前端 `saveMigration.spec.ts` | v1 game 槽归档、acquaintance 旗标提取、chatAfter 原样保留、幂等重跑 |
| 10 | 存档 v2 读写测试 | 前端（扩展现有 SaveSystem 用例） | profile/night_auto/手动槽 v2 payload、CRC 篡改拒载、损坏不静默清档 |
| 11 | loopStore 结算测试 | 前端 `loopStore.spec.ts` | endNight 摘要入库、rollbackLoop 周目号递增、继承 ≤3 校验、出示记录清空 |
| 12 | fragmentStore 测试 | 前端 `fragmentStore.spec.ts` | markShown 周目内锁定、grant 去重、继承筛选 |

优先级：1/3/7/9 在 M0（改造存量必须先兜底），2/4/8/10/11/12 随对应模块在 M1 落地，5/6 在流式与部署联调期（里程碑对应关系见 [06 册](06_roadmap_milestones.md)）。

---

## 10. 工程收口（M0）

v1 技术债在动手写 v2 功能**之前**的 M0 里程碑内统一处理，避免在烂地基上加楼：

| # | 事项 | 动作 | 验收 |
| --- | --- | --- | --- |
| 1 | `next_temp/` 未接管的 Next.js 模板 | 整目录删除（git 可追溯，无需备份） | 仓库无 `next_temp/`；README 不再提及 |
| 2 | 路由守卫缺失（`/chat-after`、成就页可直链进入） | Vue Router 加全局守卫：`/chat-after` 需存在合法 chatAfter 存档或 acquaintance 结局态；游戏页需入口 session 标记，否则重定向 StartView | 直链访问被正确重定向 |
| 3 | 设置持久化分散 | settingsStore 的音量/显示项统一收口到 `damo_settings_v1`（LLM 配置键保持不动） | 刷新后设置全量保留；旧散键一次性迁移 |
| 4 | `buildMainSystemPrompt` 存在 unreachable 死代码（`service.go` 中第一个 `return` 后还有整段旧 Prompt 的第二个 `return`） | 删除死代码段；保留的 Prompt 文本随 3.5 迁入内容库 | `go vet` 无告警；service.go 不含 Prompt 长文本 |
| 5 | Prompt 硬编码 | 迁移到 `backend/content/`（为多 NPC 铺路） | 艾的 persona 从 JSON 装配，输出与迁移前逐字一致（快照测试） |
| 6 | CORS 全开 `*` | 加 `ALLOWED_ORIGINS` 环境变量，生产收敛到同源/白名单，开发默认放开 | 生产响应头不再是 `*` |
| 7 | 后端零测试、无 CI | 加 GitHub Actions：`go build ./... && go test ./...` + `npm test -- --run && npm run build` | PR 必须绿 |
| 8 | `.env` 无样例 | 提交 `backend/.env.example`（含 LLM_*、EMBEDDING_*、RATE_* 全量键与注释） | 新人按样例可起服务 |
| 9 | 状态/解锁规则遗漏与资产残留（v1 技术文档第 11 节所列） | 逐项开 issue 清点；能 5 分钟修的随手修，其余标记进 M1 | issue 列表存在且分类完毕 |

---

## 附：v2 新增/改动文件清单（速查）

```
backend/
├── main.go                  改：挂 ratelimit、注册新路由、启动 content 校验
├── config/config.go         改：+EMBEDDING_* / RATE_* / ALLOWED_ORIGINS
├── middleware/ratelimit.go  新
├── handlers/game.go         改：chat v2 请求体；+fragment-check / night-summary
├── llm/service.go           改：assembleNpcPrompt、温度映射、去死代码
├── llm/stream.go            新：SSE 帧写出、上游流式消费
├── llm/judge.go             新：判定器拆出（TurnEvaluationV2）
├── llm/game_contract.go     改：v2 标签与枚举常量
├── embedding/{provider,fallback,cache}.go   新
└── content/…                新：NPC 内容库 + loader

legacy_vue/src/
├── store/gameStore.ts       改：收窄为当夜状态机
├── store/{fragmentStore,loopStore}.ts       新
├── modules/LLMService.ts    改：流式消费
├── modules/{StreamBuffer,SaveMigration}.ts  新
├── modules/SaveSystem.ts    改：v2 payload 与 profile 键
├── domain/gameContract.ts   改：v2 契约
├── domain/{fragment,loopState}.ts           新
├── components/CigaretteMeter.vue            新（替换 ProgressBar）
├── components/{SceneLayers,FragmentCard,FragmentPresentSheet,FragmentRevealToast}.vue  新
├── components/TypewriterText.vue            改：stream 模式
├── modules/ParticleCanvas.ts                新
└── views/{FragmentView,LoopTransitionView,FinaleView}.vue          新
```
