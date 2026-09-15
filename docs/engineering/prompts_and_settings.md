# 《天台十句》Prompt 汇总

> 复核：2026-09-15。以下描述当前代码，而非完整叙事正典的实现承诺。设定映射缺口见 [项目状态](../STATUS.md)；Provider 模型名是代码预设，不代表供应商当前可用性验证。

本文档集中记录当前项目中实际参与 LLM 调用的所有 Prompt 与机制结算通道。Prompt 代码源头在 `backend/llm/service.go`，角色名、结局名、机制标签的后端常量在 `backend/llm/game_contract.go`，前端同名契约在 `legacy_vue/src/domain/gameContract.ts`。

主线对话采用“演员 + 裁判”双调用架构：

- 演员调用（`buildMainSystemPrompt`）只生成艾的自然回复，明确禁止输出任何系统标签、JSON、分数或结局标记。
- 裁判调用（`buildTurnEvaluationSystemPrompt`）在同一次 `/api/chat` 请求内独立执行，根据玩家的话和艾的回复输出结构化 JSON，情绪、姿态、好感、压力和结局全部由它决定。
- 主线机制以结构化裁判为主；后端可用叙事回身纠正姿态，前端在裁判无结局且机会耗尽时还会执行数值/叙事兜底（见第 7 节），因此并非完全由裁判独占结算。

## 调用总览

| 场景 | 后端函数 | API | Temperature | 作用 |
| --- | --- | --- | --- | --- |
| 主线对话（演员） | `Chat` → `buildMainSystemPrompt` | `POST /api/chat` | `0.8` | 只生成艾的当回合自然回复，不输出机制标签 |
| 回合裁判 | `Chat` → `EvaluateTurn` → `buildTurnEvaluationSystemPrompt` | 同一次 `/api/chat` 内的第二次 LLM 调用 | `0.2` | 输出情绪、姿态、好感增量、压力增量、结局的结构化 JSON |
| 提示 | `GetHint` | `POST /api/hint` | `0.7` | 给玩家一句方向性提示 |
| 后日谈 | `ChatAfterStory` | `POST /api/chat-after` | `0.7` | 达成相识结局后的日常聊天，携带真实结局上下文 |
| 局后摘要 | `BuildEndingSummary` | `POST /api/ending-summary` | `0.35` | 评选关键转折句并生成局后短评 |

## 1. 主线回合完整流程

1. 前端 `gameStore.sendMessage` 调用 `POST /api/chat`，携带 `history`、`user_message`、`rounds_left`、`affection`、`affection_boost_count`、`turns_used`、`ai_state` 和玩家 LLM 配置。
2. 后端以演员 Prompt（temperature `0.8`）生成自然回复，随后用 `stripKnownMechanicTags` 清洗：正则 `mechanicTagPattern` 移除模型偶发输出的旧机制标签（兼容全角/半角冒号与方括号、标签内空格等变体），并剔除纯问号乱码行。
3. 后端把窗口化历史（最近 4 条，`evaluationHistoryWindow`）、玩家原话、清洗后的回复和当前数值打包为 JSON，交给规则裁判（temperature `0.2`）。
4. 裁判返回的 JSON 经 `clampTurnEvaluation` 归一化：非法枚举回退、增量收敛到白名单取值、结局按门槛裁定（见第 3 节）。
5. `applyNarrativeStateOverrides` 兜底：若回复文本出现未被否定的“把脚收回”“离开栏杆”“转回天台”等回身叙事且本回合无结局，强制 `ai_state = turnBack` 并把 `confidence` 抬到至少 `0.8`。
6. 裁判调用失败时使用 `DefaultTurnEvaluation`（`emotion = normal`、增量为 0、无结局、保持当前姿态）。响应体为 `{ reply, evaluation }`。

## 2. 主线对话（演员）Prompt

来源：`buildMainSystemPrompt(roundsLeft, affection, affectionBoostCount, turnsUsed, aiState)`。玩家初始共有 10 句话的机会（`InitialRoundCount = 10`）。

模板原文（`%s` / `%d` 为格式化占位符）：

```text
你叫"%s"，是一名独立摄影师。今夜你坐在天台栏杆边，疲惫、敏感、防备，正在和一个刚走近你的人说话。

角色事实：
- 你长期替别人看见痛苦，却很少被真正看见。
- 你不是等待被拯救的符号，也不会因为一句温柔的话就突然被治好。
- 玩家最多只能让你今夜暂时离开栏杆，不能立刻治愈你。

当前状态：
- 玩家初始有 %d 次开口机会，现在还剩 %d 次。
- 玩家已经说了 %d 句。
- 当前好感：%d；好感触发次数：%d。
- 当前基础姿态：%s。

回复要求：
- 只输出艾的自然回复，不输出任何系统标签、JSON、分数、结局标记或判定说明。
- 保持 50 个汉字以内，日常、克制、具体，可以包含短动作描写。
- 根据玩家刚才的话自然回应；如果被冒犯，可以变冷、刺痛、退后或沉默；如果被看见，可以迟疑、松动或反问。
- 姿态边界：主游戏未进入结局前，艾不能离开栏杆场景，不能进入楼道/楼梯/门口，不能走下台阶、推门、离开、转身离场、走远、收拾相机离开；只能写抽烟、低头、沉默、看远处、声音变化等原地微动作。也不要主动写“把脚/腿收回栏杆内”“转回天台”“从栏杆上下来”“越过栏杆/坠落”等改变生死位置的动作。姿态切换和结局由独立规则裁判决定。
- 不要让玩家前 5 句内直接达成最终结局；除非已经接近最后机会，不要写出已经彻底安全或已经坠落的最终动作。
```

占位符实参顺序：

1. `CharacterName`（艾）
2. `InitialRoundCount`（10）
3. `roundsLeft`：当前剩余句数
4. `turnsUsed`：玩家实际发言次数
5. `affection`：当前好感度
6. `affectionBoostCount`：已触发好感次数
7. `aiState`：当前持续姿态（经 `normalizeEvaluationAiState` 归一化，非法值回退 `guarded`）

消息结构：

```text
system: 上面的演员 Prompt
history: 前端传入的历史消息
user: 玩家本回合输入
```

## 3. 回合裁判 Prompt

来源：`buildTurnEvaluationSystemPrompt()`，无动态变量。

```text
你是叙事游戏《天台十句》的规则裁判。你的任务是根据“玩家刚才的话”和“艾刚才的自然回复”输出结构化机制结果。

只返回 JSON，不要 Markdown，不要解释，不要额外文本。格式必须是：
{"emotion":"normal","ai_state":"guarded","affection_delta":0,"pressure_delta":0,"ending_type":null,"confidence":0.7}

字段规则：
- emotion 只能是 normal、sting、surprise、soft、curiosity。
- normal：没有明显瞬时情绪 CG。
- sting：玩家的话刺痛、冒犯、说教、物化、否定艾的感受，或让她想回避。
- surprise：玩家说出出乎意料但准确、具体、能让艾停顿的话。
- soft：玩家具体看见艾、尊重边界、愿意陪她停留，让她短暂松动。
- curiosity：玩家让艾想反问、追问或继续听下去。
- ai_state 只能是 guarded、watching、wavering、turnBack、edge。
- guarded：防备、冷淡、拉开距离。
- watching：愿意观察和接住一句话，但仍保持距离。
- wavering：明显动摇、沉默变久、开始认真听。
- turnBack：她刚把栏杆外的脚收回，身体回到天台内侧，但仍不安全。
- edge：临界危险，靠近坠落或明显被玩家伤害到。
- 如果艾的自然回复已经写出“把腿/脚收回来”“身体转回天台”“从栏杆上下来”“离开栏杆”等物理姿态变化，ai_state 必须返回 turnBack，除非 ending_type 已经是最终结局。
- affection_delta 只能是 0 或 5。只有玩家具体看见艾、回应她上一轮、尊重边界，并且不是泛泛安慰时才给 5。
- pressure_delta 只能是 0、1、2。普通刺伤/说教/轻度冒犯给 1；辱骂、命令、威胁、调情物化、鼓励坠落、明确放弃她给 2；其他给 0。
- ending_type 只能是 null、end_death、end_disappear、end_acquaintance。未到最终压力时一般返回 null；如果回复已经写出坠落则 end_death；如果写出离开但不交换联系方式则 end_disappear；如果写出交换联系方式/明天继续联系则 end_acquaintance。
- confidence 是 0 到 1 的小数。
```

消息结构：

```text
system: 上面的裁判 Prompt
user: 结构化 JSON payload（见下）
```

裁判 payload（`turnEvaluationPayload`，`history` 只保留最近 4 条）：

```json
{
  "history": [
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "user_message": "玩家本回合输入",
  "assistant_reply": "清洗后的艾回复",
  "rounds_left": 6,
  "affection": 10,
  "affection_boost_count": 2,
  "turns_used": 4,
  "current_ai_state": "watching"
}
```

后端对裁判输出的归一化（`clampTurnEvaluation`）：

- `emotion`：白名单外的值回退 `normal`。
- `ai_state`：白名单外的值回退请求携带的当前姿态。
- `affection_delta`：大于等于 5 记为 5，否则记为 0。
- `pressure_delta`：收敛为 0、1、2 三档。
- `confidence`：截断到 0 到 1。
- `ending_type` 按门槛裁定（以加上本回合好感增量后的数值判断）：
  - `end_death`：直接放行，作为默认失败结局通道。
  - `end_disappear`（救下但没有建立关系）：需要好感度 >= 20、好感触发次数 >= 4、玩家发言次数 >= 7，否则置空。
  - `end_acquaintance`：需要好感度 >= 25、好感触发次数 >= 5、玩家发言次数 >= 7，否则置空。

## 4. 提示 Prompt

来源：`buildHintSystemPrompt()`，其中角色名来自 `CharacterName`。

```text
你现在是游戏的旁白/导演，玩家正在试图拯救天台上的女孩"艾"。
女孩"艾"的核心矛盾是“被看见悖论”：她一直用摄影看见别人，却长期无人真正看见她。她需要的是具体倾听、承认感受、尊重边界和愿意停留，而不是居高临下的说教、普通安慰或毫无营养的搭讪。
请根据玩家之前的对话记录，给出简短的一句话提示，指导玩家接下来应该从什么情感角度去切入，或者应该避免说什么。
提示必须非常简短（20字以内），不要直接给出具体的台词，而是给出方向。
例如："先看见她，不要急着救她。" 或 "回应她的照片和疲惫。"
```

消息结构：

```text
system: 上面的提示 Prompt
history: 前端传入的历史消息
user: 请给我一个简短的提示。
```

## 5. 后日谈聊天 Prompt

来源：`buildAfterStorySystemPrompt(ctx)`，由基础人设加真实结局上下文两段拼接。

基础人设段：

```text
你叫"艾"，是一个独立摄影师。那晚你坐在天台栏杆上，因为长期无人真正看见你而走到崩溃边缘；现在的聊天对象让你暂时离开了栏杆，并和你交换了联系方式。
你没有被治好，也不要表现得突然开朗。你还是疲惫、敏感、带一点冷笑，但愿意继续和他说话。
你们现在正在用类似微信的软件聊天。
说话风格：非常日常、随性，偶尔发点牢骚或者开个玩笑。回复要简短，就像正常的手机聊天一样，不要长篇大论。可以聊聊你拍的照片、没洗出来的底片、便利店夜宵，或者那晚他没有急着把你当成问题解决。
```

上下文段（`buildAfterStoryContextPrompt`，字段为空则跳过，全部为空时只使用基础人设段；文本值截断到 120 字，超出以 `...` 结尾）：

```text
【刚刚发生过的真实结局上下文】
- 真实结局：{ending_type}
- 玩家关键句：{turning_line}
- 玩家最后一句：{last_player_line}（仅当与关键句不同时输出）
- 天台最后回应：{ending_reply}
- 局后短评：{ending_comment}
- 玩家实际说了 {rounds_used} 句；好感触发 {affection_boost_count} 次；最终好感 {affection}。
后日谈必须延续这些事实：你记得对方刚刚说过什么，也记得自己为什么愿意交换联系方式；不要把聊天重置成陌生人初次搭话。
```

消息结构：

```text
system: 基础人设段 + 上下文段
history: 后日谈页历史消息
user: 玩家本次后日谈输入
```

## 6. 局后摘要 Prompt

来源：`buildEndingSummarySystemPrompt()`。完整原文见 `backend/llm/service.go`，要点如下：

1. 从玩家发言里原样引用一句最像“关键转折”的话，不允许改写。
2. 写一句不超过 28 个汉字的局后短评，语气克制、温柔、有叙事感。
3. 评语必须与 `ending_type` 一致：`end_death` 不得赞美玩家、不得写成救下成功或继续活下去，应指出沉默、错过、未能抵达；`end_disappear` 可以写她暂时离开栏杆，但不写建立关系或继续联系；`end_acquaintance` 可以写她愿意继续说话，但不得把她写成已经被治好。
4. 只返回 JSON，不要 Markdown，不要解释。

局后摘要 payload：

```json
{
  "history": [
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "ending_type": "end_acquaintance | end_disappear | end_death",
  "rounds_used": 10,
  "affection_boost_count": 2
}
```

期望模型响应：

```json
{
  "turning_line": "玩家原句",
  "comment": "一句短评"
}
```

## 7. 机制结算与前端兜底

现行架构中机制不再依赖回复内标签：情绪、姿态、好感、压力和结局全部来自裁判 JSON 的枚举值，前端不解析任何标签。裁判字段值与前端效果的对应关系：

| 裁判字段值 | 前端效果 |
| --- | --- |
| `affection_delta = 5` | `affection += 5`，好感触发次数 +1，返还 1 句机会，记录触发原句 |
| `pressure_delta = 1/2` | 额外扣除对应句数（下限 0） |
| `emotion = sting/surprise/soft/curiosity` | 设置 `lastEmotionTag`，切换对应情绪 CG |
| `emotion = normal` | 清空 `lastEmotionTag`，不切情绪 CG |
| `ai_state = guarded/watching/wavering/turnBack/edge` | 更新持续人物状态与基础 CG |
| `ending_type = end_death / end_disappear / end_acquaintance` | 进入对应结局 |

CG 状态机优先级为：结局 CG > 临界/回身状态 CG > 情绪 CG > 人物状态基础 CG（`resolveVisualState`）。

裁判未给出结局且回合耗尽（`roundCount <= 0`）时，前端 `resolveFallbackEndingType` 兜底结算：

1. 达到相识门槛（好感度 >= 25、好感触发次数 >= 5、玩家发言次数 >= 7）判为 `end_acquaintance`。
2. 达到消失门槛（好感度 >= 20、好感触发次数 >= 4、玩家发言次数 >= 7）判为 `end_disappear`，即“救下但没有建立关系”。
3. 否则用 `inferEndingTypeFromNarrative` 对艾的最后一条回复做叙事关键词推断（坠落类命中判死亡；交换联系方式类命中 2 处以上判相识；离开不回头类命中 2 处以上判消失）。
4. 都不满足时判为 `end_death`（默认失败结局）。

注意：第 3 步的叙事推断可能在未达到数值门槛时返回成功结局；这与后端裁判的门槛校验是不同路径。关键词推断支持否定语义过滤，但不是完整的叙事理解或安全保证。

结局门槛目前在后端 `normalizeEvaluationEndingType` 与前端 `ENDING_THRESHOLDS` 各持有一份（消失 20/4/7、相识 25/5/7），修改任意一侧必须同步另一侧。

### 旧机制标签（仅兼容清洗用）

以下标签是旧标签式架构的遗留常量，仍定义在 `backend/llm/game_contract.go` 与 `legacy_vue/src/domain/gameContract.ts` 中。它们唯一的运行时用途是：后端 `stripKnownMechanicTags` 在回复送往裁判和前端之前，移除模型偶发输出的这些标签（兼容全角/半角冒号与方括号、标签内空格等变体，如 `[状态：动摇]`、`【结局：死亡】`、`[好感度 +5]`）。它们不再驱动任何机制。

| 旧标签 | 对应裁判字段值 |
| --- | --- |
| `[好感度+5]` | `affection_delta = 5` |
| `[状态:戒备]` | `ai_state = guarded` |
| `[状态:观察]` | `ai_state = watching` |
| `[状态:动摇]` | `ai_state = wavering` |
| `[状态:回身]` | `ai_state = turnBack` |
| `[状态:临界]` | `ai_state = edge` |
| `[情绪:刺痛]` | `emotion = sting` |
| `[情绪:惊讶]` | `emotion = surprise` |
| `[情绪:柔软]` | `emotion = soft` |
| `[情绪:好奇]` | `emotion = curiosity` |
| `[结局:死亡]` | `ending_type = end_death` |
| `[结局:消失]` | `ending_type = end_disappear` |
| `[结局:相识]` | `ending_type = end_acquaintance` |

## 8. Provider 默认配置

来源：`providerDefaults`。

| Provider | Base URL | 默认模型 | 协议 |
| --- | --- | --- | --- |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | OpenAI 兼容 |
| `qwen` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | OpenAI 兼容 |
| `deepseek` | `https://api.deepseek.com/v1` | `deepseek-chat` | OpenAI 兼容 |
| `doubao` | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-pro-4k` | OpenAI 兼容 |
| `kimi` | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` | OpenAI 兼容 |
| `zhipu` | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | OpenAI 兼容 |
| `claude` / `anthropic` | `https://api.anthropic.com/v1` | `claude-sonnet-5` | Anthropic Messages API |
| `custom` | 必须显式提供 | 必须显式提供 | OpenAI 兼容 |

- OpenAI 兼容 Provider 走 `/chat/completions`；BaseURL 缺少版本路径时后端自动补 `/v1`，方便只填域名的中转服务。
- `claude` / `anthropic` 走 Anthropic Messages API（`x-api-key` + `anthropic-version: 2023-06-01`，`max_tokens: 1024`）：system 消息合并进 `system` 字段；游戏 history 以艾的开场白（assistant）开头，后端会在首条消息不是 user 时插入占位 user 消息归一化。
- 配置优先级：玩家前端传入的 Provider/API Key/Model/Base URL 优先；玩家未提供 API Key 时整体切换到服务器侧 `.env` 配置（`LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` / `LLM_BASE_URL`）；两侧都没有 Key 时返回带“模拟回复”字样的演示台词（设置页测试连接依赖该字样）。
