# v2 领域引擎与会话边界

`game` 是重构分支的第一条可执行垂直切片。它只依赖 Go 标准库，接收上一份 `State`、玩家 `SubmitTurn` 和不可信的 `TurnAssessment`，返回确定性的 `TurnResult`。`SessionService` 负责服务端会话、并发预留、幂等收据、降级叙事和事件读取；当前存储是进程内存，后续可替换为 SQLite。

## 允许的依赖方向

```text
handlers/application -> game
narrative/orchestration -> game.TurnAssessment
event store -> game.State / game.Event
game -> Go standard library only
```

`TurnAssessment` 不是状态补丁，也没有 `ending` 字段。模型只能提出文本与证据信号，`ApplyTurn` 负责范围限制、互斥关系、数值门槛、阶段检查、幂等和结局解析。

## 当前已经接入

1. `backend/handlers/v2.go` 提供 `POST /api/v2/sessions`、`GET /api/v2/sessions/{id}`、`POST /api/v2/sessions/{id}/turns`；事件读取是由 `V2_ADMIN_TOKEN` 保护的诊断投影。
2. v2 请求只携带命令身份、期望版本和玩家文本；服务端从会话快照构造上下文，不接受浏览器计数、历史、结局或 API Key。
3. 模型适配器通过 `Narrator` 端口进入；没有服务端 Key 或模型失败时，记录 `narrative.degraded` 并用零触达安全短回复完成合法回合。
4. `Replay` 从不可变事件流重建公开状态，测试覆盖重放、并发预留、错误降级和改变载荷的幂等键。

旧 `/api/chat` 等接口保留在迁移期；它们仍服务 v1 客户端，未被伪装成 v2 的事实来源。v2 的内存会话在进程重启后丢失，这是 SQLite event store 接入前的明确限制。
