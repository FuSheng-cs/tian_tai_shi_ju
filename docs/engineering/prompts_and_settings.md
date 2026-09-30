# 《天台十句》Prompt 与接口

> 2026-09-16 · 当前代码契约。角色事实以 [游戏设定集](../product/game_setting_bible.md) 为准。

## 回合流程

玩家最多 10 句话；前端每次发送扣除一句，向 POST /api/chat 发送 history、user_message、rounds_left、trust、trust_gain_count、turns_used、ai_state 与模型配置。

后端先调用演员生成艾的自然对白，再调用裁判分析对白。艾是承受学业压力、网络欺凌、家庭冲突与孤独的大学生。对白发生在天台；安全结局允许哭泣并与玩家一起离开。剩余机会为 0 时，演员与裁判都必须完成结局。

主 Prompt、裁判、提示、回访及摘要模板位于 backend/llm/service.go。演员不输出机制标签，模型意外输出的标签会被清洗。

## 裁判 JSON

```json
{
  "emotion": "soft",
  "ai_state": "watching",
  "trust_delta": 5,
  "pressure_delta": 0,
  "ending_type": null,
  "confidence": 0.8
}
```

- emotion：normal / sting / surprise / soft / curiosity。
- ai_state：guarded / watching / wavering / crying / leaving。
- trust_delta：0 或 5；具体倾听、尊重边界、回应压力和提供陪伴可增加信任。
- pressure_delta：0、1、2；说教、否定、强迫等损耗信任，不额外消耗句数。
- ending_type：null / end_safe_exit / end_refusal。安全离开必须满足本轮结算信任度为 15，并由 AI 判定叙事条件成立；满分不自动结局。结算顺序为先扣 pressure_delta 再加 trust_delta，上限 15。前后端拦截低信任的安全离开判定及离开状态，并用仍在天台的回应替换；十句耗尽时收束为拒绝离开。
- confidence：0 到 1。

安全离开必须包含艾哭了并和玩家一起离开天台；演员按“在天台落泪 → 抹一下眼泪 → 与玩家跨过门进入楼梯间”的顺序描写。前端在 AI 判定安全离开后播放对应三张 CG，不因播放演出而改变裁判规则。拒绝离开必须包含不再回应及拒绝离开。前端优先显示 AI 指定状态，避免分数覆盖状态。最后一句缺失裁判结局时，保守收束为拒绝离开，不推断成功。

## 其他接口

- POST /api/hint：简短方向性提示，避免直接提供标准台词。
- POST /api/ending-summary：传入 ending_type、rounds_used、trust_gain_count、trust 与历史，返回 turning_line、comment。
- POST /api/chat-after：安全离开后的回访，after_story_context 使用 trust_gain_count 与 trust，延续现实支持而非唯一依赖。

初始提示 3 次；信任增加不返还句数。后端对白、提示、摘要均不生成抽烟内容。死亡结局、旧好感度接口及坠落演出已退出运行路径。旧存档字段只用于兼容读取，不作为新 API 字段。

本次主题版使用独立的 tiantaishiju_safety_save_ 存档与 tiantaishiju_safety_achievements 成就空间。旧浏览器存档原样保留，不在新版本加载，避免带回已删除的旧剧情。只有安全离开的回访存档能通过路由校验。

## 调试边界

没有配置 API Key 时仅返回标明“模拟回复”的演示内容；这不能用于检验真实 AI 剧情。自动化测试使用本地模拟模型服务，不向真实提供商发送对话。
