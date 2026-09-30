# v2 领域引擎

`game` 是重构分支的第一条可执行垂直切片。它只依赖 Go 标准库，接收上一份 `State`、玩家 `SubmitTurn` 和不可信的 `TurnAssessment`，返回确定性的 `TurnResult`。

## 允许的依赖方向

```text
handlers/application -> game
narrative/orchestration -> game.TurnAssessment
event store -> game.State / game.Event
game -> Go standard library only
```

`TurnAssessment` 不是状态补丁，也没有 `ending` 字段。模型只能提出文本与证据信号，`ApplyTurn` 负责范围限制、互斥关系、数值门槛、阶段检查、幂等和结局解析。

## 下一步接入

1. 在 application 层实现 `SessionRepository`，按 `session_id` 读取和锁定聚合。
2. 在 narrative 层实现 `Actor` 与 `Assessor` 端口，把当前状态投影为有上限的 Prompt 上下文。
3. 在 HTTP 层只接受 `SubmitTurn`，把旧 `/api/chat` 变成兼容适配器，不把旧计数复制进 `game.State`。
4. 为 SQLite event store 增加从事件折叠状态的测试，再把 `ProcessedCommand` 从内存字段迁移成唯一约束。

第一阶段刻意没有把新引擎接到旧 Gin 路由：先用纯函数和不变量测试证明核心边界，再迁移运行时入口，避免把 v1 的客户端权威继续带进 v2。
